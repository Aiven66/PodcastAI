"""
语音克隆微服务 v14 — CosyVoice2 + IndexTTS2 + F5-TTS + GPT-SoVITS 四引擎
================================================
引擎优先级：
  0. CosyVoice2 — 零样本声音克隆（首选，稳定省内存，配合本地 Whisper ASR 确保 ref_text 正确）
  1. IndexTTS2 — B站开源零样本声音克隆（备选，CPU模式，效果好但较慢）
  2. F5-TTS — 零样本声音克隆（降级方案）
  3. GPT-SoVITS — 零样本声音克隆（仅女声，男声会生成女声）
  4. edge-tts — 最终降级方案
"""

import os
import sys
import re
import json
import uuid
import time
import logging
import subprocess
from pathlib import Path
from typing import Optional

# 修复 Apple Silicon MPS 内存不足问题：禁用 MPS 高水位线限制
# IndexTTS2 模型较大，默认 20GB MPS 上限不够用
os.environ.setdefault("PYTORCH_MPS_HIGH_WATERMARK_RATIO", "0.0")
# 避免 tokenizers 并行 fork 警告
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import numpy as np
import soundfile as sf
from scipy.signal import resample as scipy_resample
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ─── 日志 ───
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("voice-service")

# ─── 禁用系统代理（避免 urllib 通过代理连接本地服务） ───
import urllib.request
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
os.environ["no_proxy"] = "localhost,127.0.0.1"
os.environ["NO_PROXY"] = "localhost,127.0.0.1"


# ─── 常量 ───
DATA_DIR = Path(os.environ.get("VOICE_DATA_DIR", str(Path(__file__).parent / "voice-data")))
CLONES_DIR = DATA_DIR / "clones"
OUTPUT_DIR = DATA_DIR / "output"
SCRIPT_DIR = Path(__file__).parent
GPT_SOVITS_DIR = SCRIPT_DIR / "GPT-SoVITS"

for d in [CLONES_DIR, OUTPUT_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ─── TTS 引擎状态 ───
fishspeech_available = False
FISH_SPEECH_URL = os.environ.get("FISH_SPEECH_URL", "http://127.0.0.1:8908")
gptsovits_loaded = False
f5tts_model = None
f5tts_loaded = False
cosyvoice_model = None
cosyvoice_loaded = False
indextts_model = None
indextts_loaded = False
INDEXTTS_DIR = SCRIPT_DIR / "index-tts"

# ─── Edge TTS 中文声音映射 ───
EDGE_VOICES = {
    "female": ["zh-CN-XiaoxiaoNeural", "zh-CN-XiaoyiNeural", "zh-CN-XiaozhenNeural"],
    "male": ["zh-CN-YunxiNeural", "zh-CN-YunjianNeural", "zh-CN-YunyangNeural"],
}
_UNAVAILABLE_VOICES = {"zh-CN-XiaohanNeural", "zh-CN-XiaomengNeural", "zh-CN-YunhaoNeural"}


# ═══════════════════════════════════════════════════════════════
# 音频预处理
# ═══════════════════════════════════════════════════════════════

def preprocess_audio(input_path: str, output_path: str, target_sr: int = 32000) -> bool:
    """将上传的音频转换为兼容格式（WAV, 32kHz, mono）"""
    # GPT-SoVITS 推荐 32kHz
    for method in [_preprocess_ffmpeg, _preprocess_torchaudio, _preprocess_soundfile]:
        try:
            if method(input_path, output_path, target_sr):
                logger.info(f"Audio preprocessed: {input_path} -> {output_path}")
                return True
        except Exception as e:
            logger.warning(f"Preprocess method {method.__name__} failed: {e}")

    # 降级：直接复制
    try:
        import shutil
        shutil.copy2(input_path, output_path)
        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            return True
    except Exception:
        pass
    return False


def _preprocess_ffmpeg(input_path, output_path, target_sr):
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", input_path, "-ar", str(target_sr), "-ac", "1", "-sample_fmt", "s16", output_path],
        capture_output=True, text=True, timeout=30,
    )
    return result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1000


def _preprocess_torchaudio(input_path, output_path, target_sr):
    import torchaudio
    waveform, sr = torchaudio.load(input_path)
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sr != target_sr:
        resampler = torchaudio.transforms.Resample(sr, target_sr)
        waveform = resampler(waveform)
    torchaudio.save(output_path, waveform, target_sr)
    return os.path.exists(output_path) and os.path.getsize(output_path) > 1000


def _preprocess_soundfile(input_path, output_path, target_sr):
    data, sr = sf.read(input_path)
    if data.ndim > 1:
        data = data.mean(axis=1)
    if sr != target_sr:
        ratio = target_sr / sr
        n_samples = int(len(data) * ratio)
        indices = np.linspace(0, len(data) - 1, n_samples).astype(int)
        data = data[indices]
    sf.write(output_path, data.astype(np.float32), target_sr)
    return os.path.exists(output_path) and os.path.getsize(output_path) > 1000


# ═══════════════════════════════════════════════════════════════
# F0 分析
# ═══════════════════════════════════════════════════════════════

def estimate_f0(signal: np.ndarray, sr: int) -> float:
    """估计基频 F0（优先使用 librosa pyin）"""
    try:
        import librosa
        f0_values, voiced, _ = librosa.pyin(signal.astype(np.float32), fmin=65, fmax=500, sr=sr)
        voiced_f0 = f0_values[voiced & ~np.isnan(f0_values)]
        if len(voiced_f0) > 0:
            return float(np.clip(np.median(voiced_f0), 50, 500))
    except Exception:
        pass
    return _estimate_f0_autocorr(signal, sr)


def _estimate_f0_autocorr(signal, sr):
    try:
        start = max(0, len(signal) // 2 - sr // 2)
        end = min(len(signal), start + sr)
        segment = signal[start:end]
        if len(segment) < sr // 10:
            return 0.0
        segment = np.append(segment[0], segment[1:] - 0.97 * segment[:-1])
        corr = np.correlate(segment, segment, mode="full")
        corr = corr[len(corr) // 2:]
        peak_idx = np.argmax(corr[int(sr / 500):int(sr / 50)]) + int(sr / 500)
        return float(np.clip(sr / peak_idx, 50, 500)) if peak_idx > 0 else 0.0
    except Exception:
        return 0.0


def estimate_f0_from_file(audio_path: str) -> float:
    try:
        data, sr = sf.read(audio_path)
        if data.ndim > 1:
            data = data.mean(axis=1)
        return estimate_f0(data, sr)
    except Exception:
        return 0.0


def analyze_audio(audio_path: str) -> dict:
    try:
        data, sr = sf.read(audio_path)
        if data.ndim > 1:
            data = data.mean(axis=1)
        f0 = estimate_f0(data, sr)
        duration = len(data) / sr
        return {"f0": round(f0, 1), "duration": round(duration, 2), "sample_rate": sr}
    except Exception as e:
        logger.error(f"Audio analysis error: {e}")
        return {"f0": 0, "duration": 0, "sample_rate": 32000}


# ═══════════════════════════════════════════════════════════════
# GPT-SoVITS — 零样本声音克隆（主引擎）
# ═══════════════════════════════════════════════════════════════

def load_gptsovits():
    """加载 GPT-SoVITS 预训练模型"""
    global gptsovits_loaded
    try:
        # 将 GPT-SoVITS 目录添加到 Python 路径
        gptsovits_root = str(GPT_SOVITS_DIR)
        gptsovits_pkg = str(GPT_SOVITS_DIR / "GPT_SoVITS")
        gptsovits_eres2net = str(GPT_SOVITS_DIR / "GPT_SoVITS" / "eres2net")
        for p in [gptsovits_root, gptsovits_pkg, gptsovits_eres2net]:
            if p not in sys.path:
                sys.path.insert(0, p)

        # 设置环境变量，让 inference_webui.py 使用绝对路径
        pretrained_dir = str(GPT_SOVITS_DIR / "GPT_SoVITS" / "pretrained_models")
        os.environ['bert_path'] = os.path.join(pretrained_dir, "chinese-roberta-wwm-ext-large")
        os.environ['cnhubert_base_path'] = os.path.join(pretrained_dir, "chinese-hubert-base")
        os.environ['is_half'] = 'False'

        from inference_webui import change_gpt_weights, change_sovits_weights

        gpt_path = str(GPT_SOVITS_DIR / "GPT_SoVITS" / "pretrained_models" /
                       "gsv-v2final-pretrained" / "s1bert25hz-5kh-longer-epoch=12-step=369668.ckpt")
        sovits_path = str(GPT_SOVITS_DIR / "GPT_SoVITS" / "pretrained_models" /
                          "gsv-v2final-pretrained" / "s2G2333k.pth")

        if not os.path.exists(gpt_path) or not os.path.exists(sovits_path):
            logger.error(f"GPT-SoVITS model files not found: gpt={os.path.exists(gpt_path)}, sovits={os.path.exists(sovits_path)}")
            return

        os.environ['is_half'] = 'False'
        logger.info("Loading GPT-SoVITS models...")

        # change_sovits_weights 是生成器函数（包含 yield），必须消费生成器才能执行代码
        # hps 全局变量在生成器内部赋值，不消费生成器 hps 就不会初始化
        # 必须传入 prompt_language 和 text_language，否则第二个 yield 引用未定义变量会报错
        logger.info("Loading SoVITS weights (consuming generator)...")
        try:
            for _ in change_sovits_weights(
                sovits_path=sovits_path,
                prompt_language="中文",
                text_language="中文",
            ):
                pass  # 消费所有 yield，确保 hps 被正确赋值
        except Exception as e:
            logger.warning(f"change_sovits_weights generator error (may be harmless): {e}")
            # 如果生成器消费失败，hps 可能已经部分初始化，继续尝试

        # change_gpt_weights 是普通函数，直接调用即可
        logger.info("Loading GPT weights...")
        change_gpt_weights(gpt_path=gpt_path)

        # 验证 hps 是否正确初始化
        import inference_webui as iw
        if hasattr(iw, 'hps') and iw.hps is not None:
            logger.info(f"GPT-SoVITS hps initialized: sampling_rate={iw.hps.data.sampling_rate}")
        else:
            logger.warning("GPT-SoVITS hps not initialized after loading, attempting manual init...")
            # 手动初始化 hps 作为降级方案
            from inference_webui import load_sovits_new, DictToAttrRecursive
            dict_s2 = load_sovits_new(sovits_path)
            iw.hps = DictToAttrRecursive(dict_s2["config"])
            iw.hps.model.semantic_frame_rate = "25hz"
            iw.hps.model.version = "v2"
            logger.info(f"GPT-SoVITS hps manually initialized: sampling_rate={iw.hps.data.sampling_rate}")

        gptsovits_loaded = True
        logger.info("GPT-SoVITS loaded successfully!")
    except Exception as e:
        logger.error(f"GPT-SoVITS load failed: {e}")
        import traceback
        traceback.print_exc()


def _normalize_audio_file(path: str) -> None:
    """对音频文件做归一化处理（Fish Speech 输出音量极低，需要归一化到 -3dB）"""
    try:
        import soundfile as sf
        data, sr = sf.read(path)
        if len(data) == 0:
            return
        peak = np.max(np.abs(data))
        if peak > 0.001:
            # 归一化到 -3dB (0.707)
            data = data * (0.707 / peak)
        # 淡入淡出
        fade = min(int(0.01 * sr), len(data) // 4)
        if fade > 0:
            data[:fade] *= np.linspace(0, 1, fade)
            data[-fade:] *= np.linspace(1, 0, fade)
        # 限幅
        data = np.clip(data, -0.95, 0.95)
        sf.write(path, data.astype(np.float32), sr, subtype='PCM_16')
        logger.info(f"Audio normalized: {path} (peak was {peak:.4f})")
    except Exception as e:
        logger.warning(f"Audio normalization failed: {e}")


def _postprocess_audio(audio: np.ndarray, sr: int) -> tuple[np.ndarray, int]:
    """音频后处理：归一化、降噪、音量均衡、上采样到 44.1kHz"""
    if len(audio) == 0:
        return audio, sr

    # 1. 去除直流偏移
    audio = audio - np.mean(audio)

    # 2. 归一化到 -3dB（约 0.707 的振幅）
    peak = np.max(np.abs(audio))
    if peak > 0:
        target_peak = 0.707  # -3dB
        audio = audio * (target_peak / peak)

    # 3. 柔和噪声门：仅对极低振幅采样点做轻微衰减
    frame_length = int(sr * 0.02)  # 20ms帧
    if len(audio) > frame_length:
        rms = np.sqrt(np.mean(audio ** 2))
        threshold = rms * 0.02  # 噪声门阈值为RMS的2%
        mask = np.abs(audio) < threshold
        # 使用渐变衰减而非硬衰减，避免音质损失
        audio[mask] *= 0.3

    # 4. 淡入淡出（避免首尾爆音）
    fade_samples = min(int(sr * 0.01), len(audio) // 10)  # 10ms
    if fade_samples > 0:
        fade_in = np.linspace(0, 1, fade_samples)
        fade_out = np.linspace(1, 0, fade_samples)
        audio[:fade_samples] *= fade_in
        audio[-fade_samples:] *= fade_out

    # 5. 限幅保护
    audio = np.clip(audio, -0.95, 0.95)

    # 6. 上采样到 44100Hz（CD 音质），提升音频清晰度
    target_sr = 44100
    if sr < target_sr:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(target_sr, sr)
        audio = resample_poly(audio, target_sr // g, sr // g)
        sr = target_sr

    return audio.astype(np.float32), sr


def _prepare_reference_audio(ref_audio: str) -> str:
    """
    参考音频预处理：截取最佳片段、归一化、去除静音
    GPT-SoVITS 对参考音频质量非常敏感，好的参考音频 = 好的音色克隆
    """
    try:
        data, sr = sf.read(ref_audio)
        if data.ndim > 1:
            data = data.mean(axis=1)

        duration = len(data) / sr

        # 1. 去除前后静音（基于能量阈值）
        frame_len = int(sr * 0.02)  # 20ms 帧
        rms_values = []
        for i in range(0, len(data) - frame_len, frame_len):
            frame = data[i:i + frame_len]
            rms_values.append(np.sqrt(np.mean(frame ** 2)))

        if rms_values:
            rms_arr = np.array(rms_values)
            overall_rms = np.mean(rms_arr)
            # 找到第一个超过 10% RMS 的帧
            threshold = overall_rms * 0.1
            start_frame = 0
            for i, r in enumerate(rms_values):
                if r > threshold:
                    start_frame = i
                    break
            # 找到最后一个超过 10% RMS 的帧
            end_frame = len(rms_values) - 1
            for i in range(len(rms_values) - 1, -1, -1):
                if rms_values[i] > threshold:
                    end_frame = i
                    break

            start_sample = start_frame * frame_len
            end_sample = min((end_frame + 1) * frame_len, len(data))
            data = data[start_sample:end_sample]
            duration = len(data) / sr

        # 2. 截取到 3-10 秒范围
        if duration > 10:
            # 智能截取：选择能量最高、最稳定的 8 秒片段
            frame_len = int(sr * 0.5)
            step = int(sr * 0.25)
            target_len = 8 * sr

            best_start = 0
            best_score = -1

            for start in range(0, len(data) - target_len + 1, step):
                segment = data[start:start + target_len]
                rms = np.sqrt(np.mean(segment ** 2))
                sub_rms = []
                for sub_start in range(0, len(segment), frame_len):
                    sub = segment[sub_start:sub_start + frame_len]
                    if len(sub) > 0:
                        sub_rms.append(np.sqrt(np.mean(sub ** 2)))
                stability = 1.0 / (1.0 + np.std(sub_rms) / (np.mean(sub_rms) + 1e-8))
                score = rms * stability
                if score > best_score:
                    best_score = score
                    best_start = start

            data = data[best_start:best_start + target_len]
            logger.info(f"Reference audio: selected best 8s segment at {best_start/sr:.1f}s (score={best_score:.4f})")
        elif duration < 3:
            # 参考音频太短，重复拼接至 3 秒以上
            min_samples = 3 * sr
            while len(data) < min_samples:
                data = np.concatenate([data, data])
            data = data[:min_samples]
            logger.info(f"Reference audio: extended from {duration:.1f}s to 3s")

        # 3. 归一化参考音频（-3dB）
        peak = np.max(np.abs(data))
        if peak > 0:
            data = data * (0.707 / peak)

        # 4. 去除直流偏移
        data = data - np.mean(data)

        # 5. 淡入淡出（5ms，避免爆音）
        fade = min(int(sr * 0.005), len(data) // 20)
        if fade > 0:
            data[:fade] *= np.linspace(0, 1, fade)
            data[-fade:] *= np.linspace(1, 0, fade)

        # 6. 写入临时文件（保持原始采样率，GPT-SoVITS 会内部重采样到 16kHz）
        prepared_path = ref_audio + ".prepared.wav"
        sf.write(prepared_path, data.astype(np.float32), sr, subtype='PCM_16')

        logger.info(f"Reference audio prepared: {len(data)/sr:.1f}s, sr={sr}, peak={np.max(np.abs(data)):.3f}")
        return prepared_path

    except Exception as e:
        logger.warning(f"Reference audio preparation failed, using original: {e}")
        return ref_audio


def synthesize_with_gptsovits(text: str, ref_audio: str, ref_text: str, output_path: str, gender: str = "female") -> bool:
    """使用 GPT-SoVITS 零样本声音克隆（高质量版）"""
    global gptsovits_loaded
    if not gptsovits_loaded:
        return False
    try:
        from inference_webui import get_tts_wav

        if not ref_text:
            ref_text = "大家好，欢迎收听今天的节目。"

        # ── 参考音频预处理：确保音频质量最优 ──
        # GPT-SoVITS 对参考音频质量非常敏感，好的参考音频 = 好的音色克隆
        ref_audio = _prepare_reference_audio(ref_audio)

        # ── 根据性别调整合成参数 ──
        # 男声关键优化：适中的温度和 top_p，既跟随参考音频音色又避免提前停止
        # temperature 太低会导致 GPT-SoVITS 提前停止生成（<2秒）
        # temperature 太高会偏向预训练的女声特征
        if gender == "male":
            top_k = 12
            top_p = 0.6
            temperature = 0.5
        else:
            top_k = 15
            top_p = 0.6
            temperature = 0.6

        # ── 文本分段：长文本按句子分段合成，提升质量 ──
        import re
        sentences = re.split(r'([。！？；\n])', text)
        # 将分隔符重新拼接到句子中
        merged_sentences = []
        for i in range(0, len(sentences) - 1, 2):
            s = sentences[i] + (sentences[i + 1] if i + 1 < len(sentences) else '')
            if s.strip():
                merged_sentences.append(s.strip())
        if len(sentences) % 2 == 1 and sentences[-1].strip():
            merged_sentences.append(sentences[-1].strip())

        if not merged_sentences:
            merged_sentences = [text]

        # 如果只有1-2个短句，直接合成；否则分段合成
        total_chars = sum(len(s) for s in merged_sentences)
        if total_chars <= 80:
            # 短文本直接合成
            segments_to_synthesize = [text]
        else:
            # 长文本分段合成，每段不超过 80 字
            segments_to_synthesize = []
            current_segment = ""
            for s in merged_sentences:
                if len(current_segment) + len(s) <= 80:
                    current_segment += s
                else:
                    if current_segment:
                        segments_to_synthesize.append(current_segment)
                    current_segment = s
            if current_segment:
                segments_to_synthesize.append(current_segment)

        logger.info(f"GPT-SoVITS: synthesizing {len(segments_to_synthesize)} segment(s), total {total_chars} chars, gender={gender}, top_k={top_k}, top_p={top_p}, temp={temperature}")

        all_audio = []
        result_sr = 32000

        for seg_idx, seg_text in enumerate(segments_to_synthesize):
            if not seg_text.strip():
                continue

            logger.info(f"  Segment {seg_idx + 1}/{len(segments_to_synthesize)}: '{seg_text[:30]}...'")

            result = get_tts_wav(
                ref_wav_path=ref_audio,
                prompt_text=ref_text,
                prompt_language="Chinese",
                text=seg_text,
                text_language="Chinese",
                top_k=top_k,
                top_p=top_p,
                temperature=temperature,
            )

            for sr, audio_data in result:
                all_audio.append(audio_data)
                result_sr = sr

            # 段间添加短暂停顿（0.15秒静音，减少卡顿感）
            if seg_idx < len(segments_to_synthesize) - 1:
                all_audio.append(np.zeros(int(result_sr * 0.15)))

        if all_audio:
            final_audio = np.concatenate(all_audio)

            # 检查音频长度 — 如果太短（< 1 秒），可能是 GPT-SoVITS 提前停止
            if len(final_audio) / result_sr < 1.0:
                logger.warning(f"GPT-SoVITS generated too short audio: {len(final_audio)/result_sr:.2f}s, falling back")
                return False

            # ── 音频后处理（含上采样到 44.1kHz） ──
            final_audio, output_sr = _postprocess_audio(final_audio, result_sr)

            # 写入 PCM16 WAV（标准 CD 音质格式）
            sf.write(output_path, final_audio, output_sr, subtype='PCM_16')
            if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
                # 检查生成音频时长是否合理（至少应为文本字数/5秒）
                min_duration = max(1.0, total_chars / 5.0)
                actual_duration = len(final_audio) / output_sr
                if actual_duration < min_duration * 0.5:
                    logger.warning(f"GPT-SoVITS audio too short for text: {actual_duration:.1f}s < {min_duration:.1f}s expected, retrying with higher temperature")
                    # 重试一次，使用更高的 temperature
                    all_audio2 = []
                    for seg_idx, seg_text in enumerate(segments_to_synthesize):
                        if not seg_text.strip():
                            continue
                        result2 = get_tts_wav(
                            ref_wav_path=ref_audio,
                            prompt_text=ref_text,
                            prompt_language="Chinese",
                            text=seg_text,
                            text_language="Chinese",
                            top_k=15,
                            top_p=0.7,
                            temperature=0.7,
                        )
                        for sr2, audio_data2 in result2:
                            all_audio2.append(audio_data2)
                            result_sr = sr2
                        if seg_idx < len(segments_to_synthesize) - 1:
                            all_audio2.append(np.zeros(int(result_sr * 0.15)))
                    if all_audio2:
                        final_audio2 = np.concatenate(all_audio2)
                        if len(final_audio2) / result_sr > actual_duration:
                            final_audio2, output_sr = _postprocess_audio(final_audio2, result_sr)
                            sf.write(output_path, final_audio2, output_sr, subtype='PCM_16')
                            logger.info(f"GPT-SoVITS retry successful: {len(final_audio2)/output_sr:.1f}s")
                logger.info(f"GPT-SoVITS synthesis successful: {output_path} ({os.path.getsize(output_path)} bytes, sr={output_sr})")
                return True

        logger.error("GPT-SoVITS: no audio generated")
        return False
    except Exception as e:
        logger.error(f"GPT-SoVITS synthesis failed: {e}")
        import traceback
        traceback.print_exc()
        return False


# ═══════════════════════════════════════════════════════════════
# 语音识别（ASR）— 自动从参考音频中提取文本
# CosyVoice2 要求参考音频的文本必须与音频内容精确匹配，
# 否则克隆效果极差（音色不匹配，男声变女声）。
# 优先使用本地 Whisper ASR（离线、稳定），Google ASR 作为降级。
# ═══════════════════════════════════════════════════════════════

_whisper_model = None

def _get_whisper_model():
    """懒加载 Whisper 模型（仅在需要时加载）"""
    global _whisper_model
    if _whisper_model is None:
        try:
            import whisper
            logger.info("Loading Whisper base model for local ASR...")
            _whisper_model = whisper.load_model("base")
            logger.info("Whisper base model loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load Whisper model: {e}")
    return _whisper_model

def _transcribe_audio(audio_path: str) -> str:
    """从音频中自动提取文本

    返回转录文本，失败时返回空字符串。
    优先使用本地 Whisper ASR（离线稳定），Google ASR 作为降级。
    截取前 30 秒音频用于转录（与 CosyVoice2 的最大参考音频长度一致）。
    """
    import tempfile

    # 先准备 16kHz mono WAV（截取前 30 秒，与 CosyVoice2 的最大参考音频长度一致）
    temp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    temp_wav.close()
    wav_path = temp_wav.name
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", audio_path, "-ar", "16000", "-ac", "1", "-sample_fmt", "s16", "-t", "30", wav_path],
            capture_output=True, text=True, timeout=30,
        )
    except Exception as e:
        logger.warning(f"FFmpeg preprocessing failed: {e}")
        if os.path.exists(wav_path):
            os.unlink(wav_path)
        return ""

    # ── 方案1：本地 Whisper ASR（首选，离线稳定） ──
    try:
        model = _get_whisper_model()
        if model is not None:
            logger.info("Transcribing with local Whisper ASR...")
            result = model.transcribe(wav_path, language="zh", fp16=False, beam_size=5, best_of=5)
            text = result.get("text", "").strip()
            if text:
                text = re.sub(r'\s+', '', text)
                # 繁体转简体（Whisper 有时会返回繁体字，影响 CosyVoice2 文本匹配）
                try:
                    import opencc
                    converter = opencc.OpenCC('t2s')
                    text = converter.convert(text)
                except Exception:
                    pass  # opencc 不可用时跳过，不影响核心功能
                logger.info(f"Whisper ASR transcribed: '{text[:80]}...' (len={len(text)})")
                if os.path.exists(wav_path):
                    os.unlink(wav_path)
                return text
            else:
                logger.warning("Whisper ASR returned empty text")
    except Exception as e:
        logger.warning(f"Whisper ASR failed: {e}")

    # ── 方案2：Google 免费 ASR API（降级方案，需联网） ──
    try:
        import speech_recognition as sr
        r = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            r.adjust_for_ambient_noise(source, duration=0.5)
            audio = r.record(source)
        text = r.recognize_google(audio, language="zh-CN")
        logger.info(f"Google ASR transcribed: '{text[:80]}...' (len={len(text)})")
        if os.path.exists(wav_path):
            os.unlink(wav_path)
        return text.strip()
    except Exception as e:
        logger.warning(f"Google ASR failed: {e}")

    # 清理临时文件
    if os.path.exists(wav_path):
        os.unlink(wav_path)

    return ""


# ═══════════════════════════════════════════════════════════════
# Fish Speech — 业内领先的声音克隆引擎（最高优先级）
# ═══════════════════════════════════════════════════════════════

def check_fish_speech():
    """检查 Fish Speech 服务是否可用"""
    global fishspeech_available
    try:
        import urllib.request
        url = f"{FISH_SPEECH_URL}/v1/health"
        logger.info(f"Checking Fish Speech availability at {url}...")
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            fishspeech_available = data.get("status") == "ok"
            if fishspeech_available:
                logger.info("Fish Speech service is available!")
            else:
                logger.warning(f"Fish Speech returned unexpected status: {data}")
            return fishspeech_available
    except Exception as e:
        logger.warning(f"Fish Speech check failed: {e}")
        fishspeech_available = False
        return False


# 已注册到 Fish Speech 的参考音频缓存 {clone_id: reference_id}
_fish_ref_cache: dict[str, str] = {}


def _register_fish_reference(clone_id: str, ref_audio: str, ref_text: str) -> str | None:
    """将参考音频注册到 Fish Speech 服务，返回 reference_id

    注意：每次调用都会重新上传参考音频，确保使用最新的音频和文本。
    如果同名参考已存在，先删除旧参考目录避免 409 Conflict。

    关键：参考文本不能太长（>30字会导致 MPS 上 Fish Speech 只生成 2 个 tokens）。
    如果 ref_text 太长，截取前 30 字并截取对应长度的音频。
    """
    # 生成合法的 reference_id（只允许字母数字、连字符、下划线、空格）
    ref_id = f"clone-{clone_id}"

    # 删除旧的参考目录（避免 409 Conflict）
    import shutil
    old_ref_dir = Path(__file__).parent / "fish-speech" / "references" / ref_id
    if old_ref_dir.exists():
        shutil.rmtree(str(old_ref_dir))
        logger.info(f"Deleted old Fish Speech reference: {ref_id}")

    try:
        import urllib.request

        # 预处理参考音频
        import soundfile as sf
        audio_data, audio_sr = sf.read(ref_audio)

        # 如果音频是立体声，转为单声道
        if audio_data.ndim > 1:
            audio_data = audio_data.mean(axis=1)

        # 关键修复：截取参考文本和音频为短段（≤30字 / ≤10秒）
        # Fish Speech 在 MPS+float32 上对长参考文本有 bug（只生成 2 个 tokens）
        # 之前的测试确认：ref_text=12字时成功生成 233KB 音频，
        # ref_text=60+字时只生成 4KB（失败）
        MAX_REF_TEXT_LEN = 30
        MAX_REF_AUDIO_SEC = 10

        if len(ref_text) > MAX_REF_TEXT_LEN:
            # 截取前 30 字的参考文本
            original_text = ref_text
            ref_text = ref_text[:MAX_REF_TEXT_LEN]
            logger.info(f"Reference text truncated: {len(original_text)} -> {len(ref_text)} chars ('{ref_text}')")

        # 截取音频到最多 10 秒（与短文本匹配）
        max_samples = MAX_REF_AUDIO_SEC * audio_sr
        if len(audio_data) > max_samples:
            audio_data = audio_data[:max_samples]
            logger.info(f"Reference audio truncated to {MAX_REF_AUDIO_SEC}s for Fish Speech (matched with short text)")

        # 重采样到 44100Hz（Fish Speech 推荐采样率）
        if audio_sr != 44100:
            from scipy.signal import resample_poly
            from math import gcd
            g = gcd(44100, audio_sr)
            audio_data = resample_poly(audio_data, 44100 // g, audio_sr // g)
            audio_sr = 44100
            logger.info(f"Reference audio resampled to 44100Hz for Fish Speech")

        # 轻量归一化：只调整峰值，不改变音色特征
        peak = np.max(np.abs(audio_data))
        if peak > 0:
            audio_data = audio_data * (0.9 / peak)

        # 淡入淡出（避免开头和结尾的爆音）
        fade = min(int(0.05 * audio_sr), len(audio_data) // 4)
        if fade > 0:
            audio_data[:fade] *= np.linspace(0, 1, fade)
            audio_data[-fade:] *= np.linspace(1, 0, fade)

        # 保存到临时文件
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
        sf.write(tmp_path, audio_data, audio_sr, subtype='PCM_16')

        # 使用 multipart/form-data 上传参考音频
        import mimetypes
        boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
        filename = os.path.basename(tmp_path)
        mime_type = "audio/wav"

        with open(tmp_path, "rb") as f:
            audio_bytes = f.read()

        # 清理临时文件
        try:
            os.unlink(tmp_path)
        except:
            pass

        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="id"\r\n\r\n{ref_id}\r\n'
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="text"\r\n\r\n{ref_text}\r\n'
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="audio"; filename="{filename}"\r\n'
            f"Content-Type: {mime_type}\r\n\r\n"
        ).encode("utf-8")
        body += audio_bytes
        body += f"\r\n--{boundary}--\r\n".encode("utf-8")

        req = urllib.request.Request(
            f"{FISH_SPEECH_URL}/v1/references/add?format=json",
            data=body,
            method="POST",
        )
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        req.add_header("Accept", "application/json")

        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            try:
                result = json.loads(raw.decode("utf-8"))
            except UnicodeDecodeError:
                # Fish Speech 可能返回 msgpack，尝试解码
                import ormsgpack
                result = ormsgpack.unpackb(raw)

        if result.get("success"):
            _fish_ref_cache[clone_id] = ref_id
            logger.info(f"Fish Speech reference registered: {ref_id} (text='{ref_text[:30]}', audio_len={len(audio_data)/audio_sr:.1f}s)")
            return ref_id
        else:
            logger.warning(f"Fish Speech reference registration failed: {result.get('message')}")
            return None
    except Exception as e:
        logger.warning(f"Fish Speech reference registration error: {e}")
        return None


def synthesize_with_fishspeech(text: str, ref_audio: str, ref_text: str, output_path: str, clone_id: str = "") -> bool:
    """使用 Fish Speech 进行高质量声音克隆（优先使用 reference_id 方式）
    
    Fish Speech 在 Apple M1 上对长文本（>60字）推理有 bug（只生成2个tokens就停止），
    因此当文本较长时，自动切分为短文本分段合成，再拼接。
    """
    global fishspeech_available
    if not fishspeech_available:
        return False
    try:
        import base64
        import urllib.request

        # 如果没有提供 ref_text，尝试从克隆元数据中获取，或自动转录
        if not ref_text or ref_text == "大家好，欢迎收听今天的节目。":
            if clone_id and clone_id in clones_meta:
                stored_text = clones_meta[clone_id].get("prompt_text", "")
                if stored_text and stored_text != "大家好，欢迎收听今天的节目。":
                    ref_text = stored_text
                    logger.info(f"Using stored prompt_text from clone metadata (len={len(ref_text)})")
                else:
                    # 自动转录音频
                    logger.info(f"ref_text is default/empty, auto-transcribing reference audio...")
                    asr_text = _transcribe_audio(ref_audio)
                    if asr_text:
                        ref_text = asr_text
                        # 更新克隆元数据
                        clones_meta[clone_id]["prompt_text"] = asr_text
                        save_clones_meta()
                        logger.info(f"Auto-transcribed ref_text saved to clone metadata (len={len(ref_text)})")
            if not ref_text:
                ref_text = "大家好，欢迎收听今天的节目。"

        # 方案A：使用 reference_id（推荐，音频质量更好）
        # 每次都重新注册参考音频，确保使用最新的音频和文本
        ref_id = None
        if clone_id:
            ref_id = _register_fish_reference(clone_id, ref_audio, ref_text)

        # 截取 ref_text 为短文本（≤30字），避免 Fish Speech MPS bug
        # 这个截取对 reference_id 方式和 base64 内联方式都适用
        effective_ref_text = ref_text
        if len(effective_ref_text) > 30:
            effective_ref_text = effective_ref_text[:30]
            logger.info(f"Fish Speech: ref_text truncated to 30 chars for synthesis: '{effective_ref_text}'")

        # 如果文本超过 50 字，切分为短文本分段合成再拼接
        # Fish Speech 在 Apple M1 上对长文本推理有 bug，必须切短
        MAX_TEXT_LEN = 50
        if len(text) > MAX_TEXT_LEN:
            logger.info(f"Fish Speech: text too long ({len(text)} chars), splitting into segments <= {MAX_TEXT_LEN} chars")
            return _fishspeech_synthesize_long_text(text, ref_audio, effective_ref_text, output_path, clone_id, ref_id)

        # 根据文本长度动态计算 max_new_tokens
        # Fish Speech 语义 token 约为每秒 21.6 tokens（44100Hz）
        # 中文语速约 4-5 字/秒，所以每字约 4-5 tokens
        # 使用 text_len * 5 作为上限，避免生成过长音频
        # 之前 text_len * 20 导致 40字生成了 37 秒音频（应约 8 秒）
        text_len = len(text)
        estimated_tokens = max(200, min(2048, text_len * 5))
        logger.info(f"Fish Speech: text_len={text_len}, estimated_tokens={estimated_tokens}")

        if ref_id:
            request_data = {
                "text": text,
                "reference_id": ref_id,
                "top_p": 0.8,
                "temperature": 0.5,
                "repetition_penalty": 1.2,
                "max_new_tokens": estimated_tokens,
                "format": "wav",
                "normalize": True,
                "chunk_length": 100,
            }
        else:
            # 方案B：使用 base64 内联参考音频（降级方案）
            # 使用截取后的 ref_text 和截取后的音频（前10秒）
            import soundfile as sf
            import tempfile
            audio_data_b64, audio_sr_b64 = sf.read(ref_audio)
            if audio_data_b64.ndim > 1:
                audio_data_b64 = audio_data_b64.mean(axis=1)
            # 截取前 10 秒
            max_samples_b64 = 10 * audio_sr_b64
            if len(audio_data_b64) > max_samples_b64:
                audio_data_b64 = audio_data_b64[:max_samples_b64]
            # 归一化
            peak_b64 = np.max(np.abs(audio_data_b64))
            if peak_b64 > 0:
                audio_data_b64 = audio_data_b64 * (0.9 / peak_b64)
            # 保存到临时文件并编码为 base64
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_b64:
                tmp_b64_path = tmp_b64.name
            sf.write(tmp_b64_path, audio_data_b64, audio_sr_b64, subtype='PCM_16')
            with open(tmp_b64_path, "rb") as f:
                audio_bytes = f.read()
            os.unlink(tmp_b64_path)
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

            request_data = {
                "text": text,
                "references": [
                    {
                        "audio": audio_b64,
                        "text": effective_ref_text,
                    }
                ],
                "top_p": 0.8,
                "temperature": 0.5,
                "repetition_penalty": 1.2,
                "max_new_tokens": estimated_tokens,
                "format": "wav",
                "normalize": True,
                "chunk_length": 100,
            }

        # 最多重试 2 次
        last_error = None
        for attempt in range(2):
            try:
                req = urllib.request.Request(
                    f"{FISH_SPEECH_URL}/v1/tts",
                    data=json.dumps(request_data).encode("utf-8"),
                    method="POST",
                )
                req.add_header("Content-Type", "application/json")

                with urllib.request.urlopen(req, timeout=1200) as resp:
                    audio_data = resp.read()

                # Fish Speech 正常生成至少应有 10KB 数据
                if len(audio_data) > 10000:
                    with open(output_path, "wb") as f:
                        f.write(audio_data)

                    # Fish Speech 输出音量极低，需要归一化
                    _normalize_audio_file(output_path)

                    logger.info(f"Fish Speech synthesis successful: {output_path} ({len(audio_data)} bytes, ref_mode={'id' if ref_id else 'b64'})")
                    return True
                else:
                    logger.warning(f"Fish Speech returned too little data: {len(audio_data)} bytes (attempt {attempt+1})")
                    last_error = f"Audio too short: {len(audio_data)} bytes"
            except urllib.error.URLError as e:
                logger.warning(f"Fish Speech request failed (attempt {attempt+1}): {e}")
                last_error = str(e)
                if attempt < 1:
                    import time
                    time.sleep(2)

        logger.warning(f"Fish Speech synthesis failed after retries: {last_error}")
        return False
    except Exception as e:
        logger.warning(f"Fish Speech synthesis failed: {e}")
        # 不再标记为不可用，单次失败不应禁用整个引擎
        return False


def _fishspeech_synthesize_long_text(text: str, ref_audio: str, ref_text: str, output_path: str, clone_id: str, ref_id: str | None) -> bool:
    """将长文本切分为短文本，逐段用 Fish Speech 合成，再拼接为完整音频"""
    import re as _re
    import soundfile as sf
    import tempfile
    import shutil

    # 按标点切分，合并为不超过 50 字的段
    sentences = _re.split(r'([。！？；\n，、：])', text)
    merged = []
    for i in range(0, len(sentences) - 1, 2):
        s = sentences[i] + (sentences[i + 1] if i + 1 < len(sentences) else '')
        if s.strip():
            merged.append(s.strip())
    if len(sentences) % 2 == 1 and sentences[-1].strip():
        merged.append(sentences[-1].strip())

    # 合并为不超过 50 字的段
    segments = []
    current = ""
    for s in merged:
        if len(current) + len(s) <= 50:
            current += s
        else:
            if current:
                segments.append(current)
            current = s
    if current:
        segments.append(current)

    logger.info(f"Fish Speech long text: split into {len(segments)} segments")

    # 逐段合成
    all_audio = []
    target_sr = 44100
    success_count = 0

    for i, seg_text in enumerate(segments):
        logger.info(f"Fish Speech segment {i+1}/{len(segments)}: '{seg_text}' ({len(seg_text)} chars)")

        # 临时输出文件
        tmp_path = output_path + f".seg{i}.wav"

        # 直接调用 Fish Speech API
        try:
            import urllib.request

            text_len = len(seg_text)
            estimated_tokens = max(200, min(1024, text_len * 5))

            if ref_id:
                request_data = {
                    "text": seg_text,
                    "reference_id": ref_id,
                    "top_p": 0.8,
                    "temperature": 0.5,
                    "repetition_penalty": 1.2,
                    "max_new_tokens": estimated_tokens,
                    "format": "wav",
                    "normalize": True,
                    "chunk_length": 100,
                }
            else:
                import base64
                with open(ref_audio, "rb") as f:
                    audio_bytes = f.read()
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                request_data = {
                    "text": seg_text,
                    "references": [{"audio": audio_b64, "text": ref_text}],
                    "top_p": 0.8,
                    "temperature": 0.5,
                    "repetition_penalty": 1.2,
                    "max_new_tokens": estimated_tokens,
                    "format": "wav",
                    "normalize": True,
                    "chunk_length": 100,
                }

            req = urllib.request.Request(
                f"{FISH_SPEECH_URL}/v1/tts",
                data=json.dumps(request_data).encode("utf-8"),
                method="POST",
            )
            req.add_header("Content-Type", "application/json")

            with urllib.request.urlopen(req, timeout=1200) as resp:
                audio_data = resp.read()

            if len(audio_data) > 10000:
                with open(tmp_path, "wb") as f:
                    f.write(audio_data)
                _normalize_audio_file(tmp_path)

                # 读取音频数据
                data, sr = sf.read(tmp_path)
                if data.ndim > 1:
                    data = data.mean(axis=1)
                if sr != target_sr:
                    from scipy.signal import resample_poly
                    from math import gcd
                    g = gcd(target_sr, sr)
                    data = resample_poly(data, target_sr // g, sr // g)
                all_audio.append(data)
                success_count += 1

                # 清理临时文件
                try: os.remove(tmp_path)
                except: pass
            else:
                logger.warning(f"Fish Speech segment {i+1} returned too little data: {len(audio_data)} bytes, skipping")
                try: os.remove(tmp_path)
                except: pass
        except Exception as e:
            logger.warning(f"Fish Speech segment {i+1} failed: {e}")
            try: os.remove(tmp_path)
            except: pass

    if not all_audio:
        logger.warning("Fish Speech: all segments failed for long text")
        return False

        # 拼接所有段（优化双人模式真人感）
        final_path = str(OUTPUT_DIR / f"{output_id}.wav")
        if audio_chunks:
            all_audio_arrays = []
            target_sr = 44100
            for chunk_path in audio_chunks:
                try:
                    data, sr = sf.read(chunk_path)
                    if data.ndim > 1:
                        data = data.mean(axis=1)
                    if sr != target_sr:
                        from scipy.signal import resample_poly
                        from math import gcd
                        g = gcd(target_sr, sr)
                        data = resample_poly(data, target_sr // g, sr // g)
                    all_audio_arrays.append(data)
                except Exception as e:
                    logger.error(f"Error reading chunk: {e}")

            if all_audio_arrays:
                import random
                random.seed(hash(output_id) % (2**32))

                def generate_breath(duration=0.15, volume=0.08, sr=target_sr):
                    n = int(sr * duration)
                    noise = np.random.randn(n) * volume
                    env = np.ones(n)
                    fade_len = min(int(n * 0.3), 500)
                    env[:fade_len] = np.linspace(0, 1, fade_len)
                    env[-fade_len:] = np.linspace(1, 0, fade_len)
                    return noise * env

                merged = all_audio_arrays[0]
                for i in range(1, len(all_audio_arrays)):
                    chunk = all_audio_arrays[i]
                    prev_chunk = all_audio_arrays[i - 1]

                    prev_duration = len(prev_chunk) / target_sr
                    curr_duration = len(chunk) / target_sr
                    is_short_prev = prev_duration < 0.8
                    is_short_curr = curr_duration < 0.8

                    if is_short_prev or is_short_curr:
                        base_pause = 0.08
                        pause_var = 0.05
                    else:
                        base_pause = 0.2
                        pause_var = 0.15

                    pause_time = base_pause + random.uniform(-pause_var * 0.5, pause_var)
                    pause_time = max(0.03, pause_time)
                    pause_samples = int(target_sr * pause_time)

                    overlap_ratio = 0.15
                    if is_short_prev or is_short_curr:
                        overlap_ratio = 0.25

                    crossfade_samples = int(min(len(prev_chunk), len(chunk)) * overlap_ratio)
                    crossfade_samples = min(crossfade_samples, int(target_sr * 0.08))
                    crossfade_samples = max(crossfade_samples, int(target_sr * 0.02))

                    if crossfade_samples > 0 and len(merged) >= crossfade_samples and len(chunk) >= crossfade_samples:
                        fade_out = np.linspace(1, 0, crossfade_samples)
                        fade_in = np.linspace(0, 1, crossfade_samples)
                        merged = np.concatenate([merged, np.zeros(pause_samples)])
                        overlap_end = merged[-crossfade_samples:]
                        chunk_start = chunk[:crossfade_samples]
                        blended = overlap_end * fade_out + chunk_start * fade_in
                        merged = np.concatenate([merged[:-crossfade_samples], blended, chunk[crossfade_samples:]])
                    else:
                        merged = np.concatenate([merged, np.zeros(pause_samples), chunk])

                    if not is_short_curr and random.random() < 0.3:
                        breath = generate_breath(
                            duration=random.uniform(0.08, 0.18),
                            volume=random.uniform(0.03, 0.08)
                        )
                        if len(merged) > len(breath):
                            insert_pos = len(merged) - int(target_sr * 0.1)
                            insert_pos = max(0, insert_pos)
                            breath_len = min(len(breath), len(merged) - insert_pos)
                            if breath_len > 0:
                                merged[insert_pos:insert_pos + breath_len] += breath[:breath_len] * 0.5

                peak = np.max(np.abs(merged))
                if peak > 0.001:
                    merged = merged * (0.707 / peak)
                merged = np.clip(merged, -0.95, 0.95)

                sf.write(final_path, merged.astype(np.float32), target_sr, subtype='PCM_16')
            else:
                sf.write(final_path, np.zeros(44100, dtype=np.float32), 44100, subtype='PCM_16')

        # 计算总时长
        total_duration = 0
        try:
            import soundfile as sf_final
            data, sr = sf_final.read(final_path)
            total_duration = len(data) / sr
        except Exception:
            total_duration = sum(len(seg["text"]) for seg in segments) / 4

        # 发送完成事件
        yield (_json.dumps({
            "type": "done",
            "total_segments": len(audio_chunks),
            "duration": round(total_duration, 1),
        }) + "\n").encode("utf-8")

        # 发送分隔标记：后面是音频二进制数据
        yield b"---AUDIO_DATA_START---\n"

        # 最后发送完整的 wav 文件
        with open(final_path, "rb") as f:
            yield f.read()

        # 清理临时文件
        try: os.remove(final_path)
        except: pass
        for chunk_path in audio_chunks:
            try: os.remove(chunk_path)
            except: pass

        logger.info(f"Podcast synthesis complete: {len(audio_chunks)} segments, {total_duration:.1f}s")

    # 在后台线程中运行同步的合成逻辑，避免阻塞事件循环
    # 这样 health 接口和其他请求就能快速响应，不会因为正在合成而卡住
    import asyncio
    import queue
    import threading

    q: "queue.Queue[bytes | None]" = queue.Queue(maxsize=100)

    def _run_sync():
        try:
            for chunk in generate_podcast():
                q.put(chunk)
        except Exception as e:
            logger.error(f"Podcast synthesis thread error: {e}")
        finally:
            q.put(None)  # 哨兵值表示结束

    thread = threading.Thread(target=_run_sync, daemon=True)
    thread.start()

    async def _async_generator():
        loop = asyncio.get_event_loop()
        while True:
            chunk = await loop.run_in_executor(None, q.get)
            if chunk is None:
                break
            yield chunk

    from fastapi.responses import StreamingResponse
    return StreamingResponse(_async_generator(), media_type="application/x-ndjson")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("VOICE_SERVICE_PORT", 8907))
    logger.info(f"Starting Voice Cloning Service v13 on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
