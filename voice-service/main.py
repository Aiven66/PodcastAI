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
from fastapi.staticfiles import StaticFiles
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
    """将上传的音频转换为兼容格式（WAV, 32kHz, mono）
    并进行质量优化：去除静音、音量归一化、降噪，提升克隆效果。
    """
    # 第一步：基础格式转换（使用 ffmpeg，质量最好）
    temp_path = output_path + ".tmp.wav"
    basic_ok = False
    for method in [_preprocess_ffmpeg, _preprocess_torchaudio, _preprocess_soundfile]:
        try:
            if method(input_path, temp_path, target_sr):
                basic_ok = True
                break
        except Exception as e:
            logger.warning(f"Preprocess method {method.__name__} failed: {e}")

    if not basic_ok:
        # 降级：直接复制
        try:
            import shutil
            shutil.copy2(input_path, temp_path)
            if os.path.exists(temp_path) and os.path.getsize(temp_path) > 1000:
                basic_ok = True
        except Exception:
            pass

    if not basic_ok:
        return False

    # 第二步：质量优化（去除静音、音量归一化、降噪）
    try:
        _optimize_reference_audio(temp_path, output_path, target_sr)
        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            logger.info(f"Audio preprocessed and optimized: {input_path} -> {output_path}")
            # 清理临时文件
            if os.path.exists(temp_path) and temp_path != output_path:
                os.unlink(temp_path)
            return True
    except Exception as e:
        logger.warning(f"Audio optimization failed, using basic preprocess: {e}")

    # 降级：使用基础预处理结果
    try:
        import shutil
        shutil.move(temp_path, output_path)
        logger.info(f"Audio preprocessed (basic): {input_path} -> {output_path}")
        return os.path.exists(output_path) and os.path.getsize(output_path) > 1000
    except Exception:
        return False


def _optimize_reference_audio(input_path: str, output_path: str, target_sr: int):
    """优化参考音频质量，提升克隆相似度：
    1. 去除首尾静音
    2. 音量归一化到 -16dB LUFS（广播级标准）
    3. 轻度降噪（afftdn 滤波器）
    4. 截取最佳 8-15 秒片段（优先选择有连续语音的部分）
    """
    import tempfile

    # 阶段1：去除静音 + 音量归一化 + 降噪
    stage1 = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    stage1.close()

    # 使用 ffmpeg 进行高质量音频优化
    # - silenceremove: 去除首尾静音（停止阈值 -30dB，持续 0.5 秒）
    # - loudnorm: 音量归一化到 -16dB LUFS
    # - afftdn: 轻度降噪（噪声抑制 -12dB）
    try:
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-af",
            "silenceremove=start_periods=1:start_duration=0.3:start_threshold=-35dB:"
            "stop_periods=-1:stop_duration=0.5:stop_threshold=-35dB,"
            "loudnorm=I=-16:TP=-1.5:LRA=11,"
            "afftdn=nf=-12",
            "-ar", str(target_sr),
            "-ac", "1",
            "-sample_fmt", "s16",
            stage1.name
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0 or not os.path.exists(stage1.name) or os.path.getsize(stage1.name) < 1000:
            logger.warning(f"FFmpeg audio optimization failed: {result.stderr[:200]}")
            # 降级：只做格式转换
            _simple_format_convert(input_path, output_path, target_sr)
            _cleanup_temp(stage1.name)
            return
    except Exception as e:
        logger.warning(f"FFmpeg audio optimization error: {e}")
        _simple_format_convert(input_path, output_path, target_sr)
        _cleanup_temp(stage1.name)
        return

    # 阶段2：检测音频时长，截取最佳片段
    try:
        duration = _get_audio_duration(stage1.name)
        logger.info(f"Reference audio duration after optimization: {duration:.1f}s")

        if duration <= 3:
            # 太短了，直接用（可能影响质量，但至少能用）
            import shutil
            shutil.move(stage1.name, output_path)
            return

        if duration <= 15:
            # 时长合适，直接使用
            import shutil
            shutil.move(stage1.name, output_path)
            return

        # 超过 15 秒，截取最佳片段（优先选择中间 10-15 秒，避免开头结尾可能的不清晰）
        # 使用 ffmpeg 的 volumedetect 找到音量最稳定的片段
        best_start = _find_best_segment_start(stage1.name, duration, target_duration=12)
        logger.info(f"Trimming reference audio: start={best_start:.1f}s, duration=12s")

        cmd = [
            "ffmpeg", "-y", "-i", stage1.name,
            "-ss", f"{best_start:.2f}",
            "-t", "12",
            "-acodec", "copy",
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        _cleanup_temp(stage1.name)

        if result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            logger.info(f"Reference audio trimmed to best 12s segment")
            return

        # 降级：直接取中间 12 秒
        start = max(0, (duration - 12) / 2)
        cmd = [
            "ffmpeg", "-y", "-i", stage1.name,
            "-ss", f"{start:.2f}",
            "-t", "12",
            "-acodec", "copy",
            output_path
        ]
        subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except Exception as e:
        logger.warning(f"Audio trimming failed: {e}")
        # 降级：直接使用优化后的音频
        import shutil
        if os.path.exists(stage1.name):
            shutil.move(stage1.name, output_path)
        _cleanup_temp(stage1.name)


def _simple_format_convert(input_path: str, output_path: str, target_sr: int):
    """简单的格式转换（降级方案）"""
    subprocess.run(
        ["ffmpeg", "-y", "-i", input_path, "-ar", str(target_sr), "-ac", "1", "-sample_fmt", "s16", output_path],
        capture_output=True, text=True, timeout=30,
    )


def _get_audio_duration(audio_path: str) -> float:
    """获取音频时长（秒）"""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
            capture_output=True, text=True, timeout=10,
        )
        return float(result.stdout.strip())
    except Exception:
        # 降级：用 soundfile 读取
        try:
            data, sr = sf.read(audio_path)
            return len(data) / sr
        except Exception:
            return 0.0


def _find_best_segment_start(audio_path: str, duration: float, target_duration: float = 12) -> float:
    """找到最佳片段起始点（音量最稳定、RMS 最高的连续片段）"""
    import tempfile

    # 使用 1 秒窗口，步长 0.5 秒，计算每个窗口的 RMS
    # 找到 RMS 最高且最稳定的连续 target_duration 秒
    temp_txt = tempfile.NamedTemporaryFile(suffix=".txt", delete=False)
    temp_txt.close()

    try:
        # 使用 ffmpeg 的 astats 或 volumedetect 获取音量信息
        # 简单方案：将音频分成 1 秒块，计算每个块的 RMS
        cmd = [
            "ffmpeg", "-i", audio_path,
            "-af", "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=" + temp_txt.name,
            "-f", "null", "-"
        ]
        subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        # 解析 RMS 数据
        rms_values = []
        if os.path.exists(temp_txt.name):
            with open(temp_txt.name, "r") as f:
                for line in f:
                    if "lavfi.astats.Overall.RMS_level" in line:
                        try:
                            val = float(line.strip().split("=")[-1])
                            rms_values.append(val)
                        except:
                            pass
        _cleanup_temp(temp_txt.name)

        if len(rms_values) < 3:
            # 数据不足，返回中间位置
            return max(0, (duration - target_duration) / 2)

        # 计算滑动窗口内的平均 RMS，找到最高的窗口
        window_size = max(1, int(target_duration))  # 约 target_duration 个数据点
        if len(rms_values) <= window_size:
            return 1.0  # 从第 1 秒开始

        best_start = 1.0
        best_avg_rms = -100.0

        for i in range(len(rms_values) - window_size + 1):
            window = rms_values[i:i + window_size]
            avg_rms = sum(window) / len(window)
            # 同时考虑稳定性（标准差小更好）
            variance = sum((x - avg_rms) ** 2 for x in window) / len(window)
            # 评分：音量越大越好，同时不要太不稳定
            score = avg_rms - variance * 0.5
            if score > best_avg_rms:
                best_avg_rms = score
                best_start = float(i + 1)  # +1 因为从第 1 秒开始

        # 确保不超出范围
        best_start = max(0.5, min(best_start, duration - target_duration - 0.5))
        return best_start

    except Exception as e:
        logger.warning(f"Finding best segment failed: {e}")
        _cleanup_temp(temp_txt.name)
        return max(0, (duration - target_duration) / 2)


def _cleanup_temp(path: str):
    """安全清理临时文件"""
    try:
        if os.path.exists(path):
            os.unlink(path)
    except Exception:
        pass


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
    """懒加载 Whisper 模型（仅在需要时加载）
    使用 small 模型以获得更高的转录准确率（base 模型准确率较低，
    转录错误会导致 CosyVoice2 克隆音色严重偏离）。
    """
    global _whisper_model
    if _whisper_model is None:
        try:
            import whisper
            logger.info("Loading Whisper small model for local ASR (higher accuracy)...")
            _whisper_model = whisper.load_model("small")
            logger.info("Whisper small model loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load Whisper small model, falling back to base: {e}")
            try:
                import whisper
                _whisper_model = whisper.load_model("base")
                logger.info("Whisper base model loaded (fallback)")
            except Exception as e2:
                logger.warning(f"Failed to load Whisper base model: {e2}")
    return _whisper_model

def _is_chinese_text(text: str) -> bool:
    """检测文本是否主要为中文（中文字符占比 > 30%）"""
    if not text:
        return False
    chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    return chinese_chars / len(text) > 0.3


def _detect_text_language(text: str) -> str:
    """检测文本的主要语言
    返回 'zh'（中文）、'en'（英文）或 'mixed'（混合/其他）
    """
    if not text:
        return 'zh'
    chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    # 英文字符：a-zA-Z
    english_chars = sum(1 for c in text if c.isascii() and c.isalpha())
    total_alpha = chinese_chars + english_chars
    if total_alpha == 0:
        return 'zh'
    zh_ratio = chinese_chars / total_alpha
    en_ratio = english_chars / total_alpha
    if zh_ratio > 0.6:
        return 'zh'
    elif en_ratio > 0.6:
        return 'en'
    else:
        return 'mixed'


def _preprocess_english_text(text: str) -> str:
    """英文文本预处理，提升 CosyVoice2 英文发音的自然度

    1. 常见缩写展开（don't → do not），让模型更容易正确发音
    2. 数字转英文单词（1 → one），避免数字误读
    3. 标点优化：添加适当停顿
    4. 首字母缩略词处理（AI → A I），避免整体误读
    """
    import re

    # 1. 常见英文缩写展开
    contractions = {
        r"\bdon't\b": "do not",
        r"\bdoesn't\b": "does not",
        r"\bdidn't\b": "did not",
        r"\bcan't\b": "cannot",
        r"\bwon't\b": "will not",
        r"\bwouldn't\b": "would not",
        r"\bshouldn't\b": "should not",
        r"\bcouldn't\b": "could not",
        r"\bisn't\b": "is not",
        r"\baren't\b": "are not",
        r"\bwasn't\b": "was not",
        r"\bweren't\b": "were not",
        r"\bhasn't\b": "has not",
        r"\bhaven't\b": "have not",
        r"\bhadn't\b": "had not",
        r"\bI'm\b": "I am",
        r"\byou're\b": "you are",
        r"\bwe're\b": "we are",
        r"\bthey're\b": "they are",
        r"\bit's\b": "it is",
        r"\bthat's\b": "that is",
        r"\bwhat's\b": "what is",
        r"\bhere's\b": "here is",
        r"\bthere's\b": "there is",
        r"\bI've\b": "I have",
        r"\byou've\b": "you have",
        r"\bwe've\b": "we have",
        r"\bthey've\b": "they have",
        r"\bI'll\b": "I will",
        r"\byou'll\b": "you will",
        r"\bhe'll\b": "he will",
        r"\bshe'll\b": "she will",
        r"\bwe'll\b": "we will",
        r"\bthey'll\b": "they will",
        r"\bI'd\b": "I would",
        r"\byou'd\b": "you would",
        r"\bhe'd\b": "he would",
        r"\bshe'd\b": "she would",
        r"\bwe'd\b": "we would",
        r"\bthey'd\b": "they would",
        r"\blet's\b": "let us",
    }
    for pattern, replacement in contractions.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

    # 2. 简单数字转英文（仅 0-20，避免引入 num2words 依赖）
    number_words = {
        '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
        '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
        '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
        '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
        '18': 'eighteen', '19': 'nineteen', '20': 'twenty',
    }
    # 仅替换独立数字（前后非字母数字），避免误改版本号、日期等
    for num, word in number_words.items():
        text = re.sub(rf'(?<!\w){num}(?!\w)', word, text)

    # 3. 标点优化：句子末尾确保有停顿标点
    # 如果句子以单词结尾但没有标点，添加句号
    text = re.sub(r'(\w)(\s+[A-Z])', r'\1.\2', text)
    # 多余空格压缩
    text = re.sub(r'\s+', ' ', text).strip()

    return text


def _preprocess_text_for_synthesis(text: str) -> str:
    """根据文本语言进行预处理，优化 TTS 合成效果

    - 中文：保持原样（CosyVoice2 对中文支持好）
    - 英文：应用英文预处理（缩写展开、数字转换）
    - 混合：英文部分应用预处理，保留中文
    """
    if not text:
        return text
    lang = _detect_text_language(text)
    if lang == 'en':
        return _preprocess_english_text(text)
    elif lang == 'mixed':
        # 混合文本：仅处理英文片段（保持中文部分不变）
        # 简单策略：对整个文本应用英文预处理，但保留中文字符
        return _preprocess_english_text(text)
    else:
        # 中文：保持原样
        return text


def _transcribe_audio(audio_path: str, language: Optional[str] = None) -> str:
    """从音频中自动提取文本

    返回转录文本，失败时返回空字符串。
    优先使用本地 Whisper ASR（离线稳定），Google ASR 作为降级。
    截取前 30 秒音频用于转录（与 CosyVoice2 的最大参考音频长度一致）。

    Args:
        audio_path: 音频文件路径
        language: 指定语言代码（如 'zh', 'en'）。None 时自动检测，
                  推荐 None，让 Whisper 自动识别中英文。
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
            logger.info(f"Transcribing with local Whisper ASR (language={language or 'auto'})...")
            # 构建转录参数
            transcribe_kwargs = {
                'fp16': False,
                'beam_size': 10,
                'best_of': 10,
                'temperature': [0.0, 0.2, 0.4, 0.6, 0.8],
                'condition_on_previous_text': True,
                'compression_ratio_threshold': 2.4,
                'logprob_threshold': -1.0,
                'no_speech_threshold': 0.6,
            }
            if language:
                # 指定语言模式（兼容旧调用）
                transcribe_kwargs['language'] = language
                if language == 'zh':
                    transcribe_kwargs['initial_prompt'] = "以下是普通话的句子。"
                elif language == 'en':
                    transcribe_kwargs['initial_prompt'] = "The following is an English sentence."
            else:
                # 自动语言检测模式：让 Whisper 自行判断中英文
                # 不设置 language 和 initial_prompt，避免误导模型
                pass

            result = model.transcribe(wav_path, **transcribe_kwargs)
            text = result.get("text", "").strip()
            detected_lang = result.get("language", "unknown")
            if text:
                # 语言处理：中文需要去空格+繁简转换；英文保留空格
                is_chinese = (detected_lang.startswith('zh') if detected_lang != "unknown"
                              else _is_chinese_text(text))
                if is_chinese:
                    text = re.sub(r'\s+', '', text)
                    # 繁体转简体（Whisper 有时会返回繁体字，影响 CosyVoice2 文本匹配）
                    try:
                        import opencc
                        converter = opencc.OpenCC('t2s')
                        text = converter.convert(text)
                    except Exception:
                        pass  # opencc 不可用时跳过，不影响核心功能
                else:
                    # 英文/其他语言：规范空格，去除多余空白
                    text = re.sub(r'\s+', ' ', text).strip()

                logger.info(f"Whisper ASR transcribed (lang={detected_lang}): '{text[:80]}...' (len={len(text)})")
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
        # Google ASR：自动检测语言（不指定 language 参数时尝试中文+英文）
        try:
            text = r.recognize_google(audio, language="zh-CN")
        except Exception:
            text = r.recognize_google(audio, language="en-US")
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


# ==================== CosyVoice2 合成 ====================

_cosyvoice_model = None
_cosyvoice_device = None
_cosyvoice_samplerate = 22050
_cosyvoice_load_failed = False
import threading
import asyncio
_cosyvoice_load_lock = threading.Lock()
_cosyvoice_synth_lock = threading.Lock()  # CosyVoice2 推理锁，防止并发请求导致死锁

# 预览音频后台生成任务追踪
# {clone_id: {"status": "generating"|"done"|"failed", "started_at": timestamp}}
_preview_task_store = {}
_preview_task_lock = threading.Lock()


def load_cosyvoice():
    global _cosyvoice_model, _cosyvoice_device, _cosyvoice_samplerate, _cosyvoice_load_failed
    if _cosyvoice_model is not None:
        return True
    if _cosyvoice_load_failed:
        return False
    with _cosyvoice_load_lock:
        if _cosyvoice_model is not None:
            return True
        if _cosyvoice_load_failed:
            return False
        try:
            import torch
            # 将 CosyVoice 目录添加到 Python 路径
            cosyvoice_root = str(Path(__file__).parent / "CosyVoice")
            if cosyvoice_root not in sys.path:
                sys.path.insert(0, cosyvoice_root)
            from cosyvoice.cli.cosyvoice import CosyVoice2
            model_dir = str(Path(__file__).parent / "CosyVoice" / "pretrained_models" / "CosyVoice2-0.5B")
            _cosyvoice_device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
            logger.info(f"Loading CosyVoice2 from {model_dir} on {_cosyvoice_device}")
            _cosyvoice_model = CosyVoice2(model_dir)
            _cosyvoice_samplerate = 22050
            logger.info("CosyVoice2 loaded successfully")
            return True
        except Exception as e:
            _cosyvoice_load_failed = True
            logger.warning(f"Failed to load CosyVoice2: {e}")
            import traceback
            logger.warning(traceback.format_exc())
            return False


def _truncate_ref_audio(ref_audio_path: str, max_sec: float = 8.0) -> str:
    """截断参考音频到指定时长，避免过长音频导致推理变慢。
    如果音频已短于 max_sec，直接返回原路径。
    否则截取前 max_sec 秒保存到临时文件并返回新路径。
    支持 wav、mp3 等任意音频格式。
    """
    try:
        duration = _get_audio_duration(ref_audio_path)
        if duration <= max_sec:
            return ref_audio_path
        # 截取前 max_sec 秒，输出为 wav 格式（兼容性最好）
        # 使用临时文件，避免覆盖原文件；正确处理 .mp3 等非 wav 格式
        import tempfile
        base_name = os.path.basename(ref_audio_path).replace(os.path.splitext(ref_audio_path)[1], '')
        truncated_path = str(Path(tempfile.gettempdir()) / f"{base_name}_trim{int(max_sec)}s.wav")
        # 不用 -acodec copy（格式转换时需要重新编码），统一输出为 wav
        cmd = ["ffmpeg", "-y", "-i", ref_audio_path, "-t", str(max_sec), "-ar", "32000", "-ac", "1", "-sample_fmt", "s16", truncated_path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if result.returncode == 0 and os.path.exists(truncated_path) and os.path.getsize(truncated_path) > 1000:
            logger.info(f"Reference audio truncated: {duration:.1f}s -> {max_sec}s ({truncated_path})")
            return truncated_path
        logger.warning(f"Failed to truncate ref audio: {result.stderr[:200]}")
        return ref_audio_path
    except Exception as e:
        logger.warning(f"ref audio truncation error: {e}")
        return ref_audio_path


def synthesize_with_cosyvoice(text, ref_audio, ref_text, output_path, strict_clone=False, clone_id=None, speed=1.15):
    if not load_cosyvoice():
        return False
    try:
        import torch

        # ── 语言检测与文本预处理 ──
        # 检测合成文本的语言，对英文/混合文本应用预处理以提升发音自然度
        text_lang = _detect_text_language(text)
        original_text = text
        text = _preprocess_text_for_synthesis(text)
        if text != original_text:
            logger.info(f"Text preprocessed for {text_lang}: {len(original_text)} -> {len(text)} chars")
        # 英文/混合文本：适当降低语速（英文需要更慢的节奏才能发音清晰）
        # 中文保持原速，英文 speed × 0.85
        effective_speed = speed
        if text_lang in ('en', 'mixed'):
            effective_speed = max(0.8, speed * 0.85)
            logger.info(f"English/mixed text detected, adjusting speed: {speed} -> {effective_speed}")

        if strict_clone:
            if not ref_text or not ref_text.strip():
                logger.warning(f"ref_text is empty for strict clone, running ASR to auto-extract...")
                # 自动语言检测：不强制中文，让 Whisper 自行识别参考音频的语言
                ref_text = _transcribe_audio(ref_audio, language=None)
                if not ref_text:
                    logger.warning(f"ASR also failed for strict clone, skipping to avoid wrong voice")
                    return False
                logger.info(f"ASR extracted ref_text: {len(ref_text)} chars, content: '{ref_text[:60]}'")
                # 自动保存 ref_text 到克隆数据中，避免下次再 ASR
                if clone_id and clone_id in _clone_store:
                    try:
                        _clone_store[clone_id]["ref_text"] = ref_text
                        _save_clones()
                        logger.info(f"Saved ASR ref_text to clone {clone_id}")
                    except Exception as save_err:
                        logger.warning(f"Failed to save ASR ref_text: {save_err}")
            logger.info(f"CosyVoice2 strict_clone: text_lang={text_lang}, text='{text[:40]}...', ref_text='{ref_text[:40]}...', ref_audio={ref_audio}, speed={effective_speed}")
            # 截断 ref_text 到 45 字以内（与参考音频时长匹配，避免性能严重下降）
            # 注意：英文按字符数截断，中文按字符数截断（中英文都按 len 计算）
            # 项目经验：ref_text 过长会导致 RTF 从 19 飙升到 41+
            if len(ref_text) > 45:
                original_ref_len = len(ref_text)
                ref_text = ref_text[:45]
                logger.info(f"ref_text truncated for performance: {original_ref_len} -> {len(ref_text)} chars")
            # 截断参考音频到 8 秒以内（避免每次推理处理过多 prompt token，RTF 飙升）
            # 项目经验：29 秒参考音频 → RTF=72；8 秒参考音频 → RTF≈19
            ref_audio = _truncate_ref_audio(ref_audio, max_sec=8)
            # 使用推理锁，防止并发请求导致模型死锁
            # 超时 300 秒：如果锁被持有超过 5 分钟，说明前一个请求卡住了，强制获取
            if not _cosyvoice_synth_lock.acquire(timeout=300):
                logger.error("CosyVoice2 synth lock timeout (300s), forcing release and retry")
                try:
                    _cosyvoice_synth_lock.release()
                except:
                    pass
                _cosyvoice_synth_lock.acquire(timeout=10)
            try:
                gen = _cosyvoice_model.inference_zero_shot(text, ref_text, ref_audio, '', speed=effective_speed)
            finally:
                _cosyvoice_synth_lock.release()
        else:
            logger.info(f"CosyVoice2 non-strict: text_lang={text_lang}, text='{text[:40]}...', ref_audio={ref_audio}, speed={effective_speed}")
            if not _cosyvoice_synth_lock.acquire(timeout=300):
                logger.error("CosyVoice2 synth lock timeout (300s), forcing release and retry")
                try:
                    _cosyvoice_synth_lock.release()
                except:
                    pass
                _cosyvoice_synth_lock.acquire(timeout=10)
            try:
                if hasattr(_cosyvoice_model, 'inference_instruct2'):
                    # 英文文本使用英文指令，中文使用中文指令
                    if text_lang == 'en':
                        instruction = 'Read in a natural and fluent tone.'
                    else:
                        instruction = '用自然流畅的语气朗读'
                    gen = _cosyvoice_model.inference_instruct2(text, instruction, ref_audio, '', speed=effective_speed)
                else:
                    gen = _cosyvoice_model.inference_zero_shot(text, ref_text or text, ref_audio, '', speed=effective_speed)
            finally:
                _cosyvoice_synth_lock.release()

        audio_chunks_list = []
        for result in gen:
            chunk = result['tts_speech'].squeeze().cpu().numpy()
            if chunk is not None and len(chunk) > 0:
                audio_chunks_list.append(chunk)

        if audio_chunks_list:
            audio_data = np.concatenate(audio_chunks_list)
            target_sr = 44100
            from scipy.signal import resample_poly
            from math import gcd
            g = gcd(target_sr, _cosyvoice_samplerate)
            audio_data = resample_poly(audio_data, target_sr // g, _cosyvoice_samplerate // g)
            audio_data = _postprocess_audio(audio_data, target_sr)[0]
            sf.write(output_path, audio_data.astype(np.float32), target_sr, subtype='PCM_16')
            return True
        return False
    except Exception as e:
        logger.error(f"CosyVoice2 synthesis error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


# ==================== edge-tts 合成 ====================

def synthesize_with_edge_tts(text, voice, output_path, max_retries=3):
    """使用 Edge TTS 合成语音
    支持自动重试，提高系统声音生成的稳定性。
    """
    import asyncio

    async def _synthesize_async():
        import edge_tts

        mp3_path = output_path.replace('.wav', '_tmp.mp3')

        # 尝试多次，每次可能选择不同的 voice（如果有备选）
        last_error = None
        for attempt in range(max_retries):
            try:
                communicate = edge_tts.Communicate(text, voice)
                await communicate.save(mp3_path)

                if not os.path.exists(mp3_path) or os.path.getsize(mp3_path) < 1000:
                    raise Exception("Generated MP3 file is too small or empty")

                # 转换为 WAV 格式
                try:
                    result = subprocess.run(
                        ['ffmpeg', '-y', '-i', mp3_path, '-ar', '44100', '-ac', '1', '-sample_fmt', 's16', output_path],
                        check=True, capture_output=True, text=True, timeout=60
                    )
                    if os.path.exists(mp3_path):
                        try:
                            os.remove(mp3_path)
                        except:
                            pass

                    # 验证输出文件
                    if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
                        return True
                    else:
                        raise Exception("Output WAV file is invalid")

                except Exception as e:
                    logger.warning(f"Edge TTS ffmpeg convert error (attempt {attempt+1}): {e}")
                    last_error = e
                    if os.path.exists(mp3_path):
                        try:
                            os.remove(mp3_path)
                        except:
                            pass
                    continue

            except Exception as e:
                logger.warning(f"Edge TTS synthesis error (attempt {attempt+1}): {e}")
                last_error = e
                # 重试前等待一小段时间
                if attempt < max_retries - 1:
                    import time
                    time.sleep(1 + attempt)
                continue

        if last_error:
            logger.error(f"Edge TTS all {max_retries} attempts failed: {last_error}")
        return False

    # 检测是否已有运行中的事件循环
    try:
        loop = asyncio.get_running_loop()
        # 在已有事件循环中运行（使用线程池避免阻塞）
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            result = pool.submit(asyncio.run, _synthesize_async()).result()
            return result
    except RuntimeError:
        # 没有运行中的事件循环，直接用 asyncio.run
        return asyncio.run(_synthesize_async())


# ==================== 统一合成入口 ====================

def synthesize_audio(text, output_path, meta, strict_clone=True, speed=1.15):
    ref_audio = meta.get("ref_audio", "")
    ref_text = meta.get("ref_text", "")
    clone_id = meta.get("id", "") or meta.get("clone_id", "")

    # 优先 CosyVoice2
    if load_cosyvoice() and ref_audio and os.path.exists(ref_audio):
        if synthesize_with_cosyvoice(text, ref_audio, ref_text, output_path, strict_clone=strict_clone, clone_id=clone_id, speed=speed):
            return True

    # strict_clone 模式下，如果 CosyVoice2 失败，不再尝试其他引擎
    # 避免输出非克隆音色（如默认女声）
    if strict_clone:
        return False

    # 其次 Fish Speech
    clone_id = meta.get("clone_id", "")
    if check_fish_speech() and clone_id:
        if synthesize_with_fishspeech(text, ref_audio, ref_text, output_path, clone_id):
            return True

    # 最后 GPT-SoVITS
    if load_gptsovits() and ref_audio and os.path.exists(ref_audio):
        gender = meta.get("gender", "female")
        if synthesize_with_gptsovits(text, ref_audio, ref_text, output_path, gender):
            return True

    return False




# ==================== 全局变量与初始化 ====================

_gptsovits_model = None
_fish_speech_model = None
_clone_store = {}


def _load_clones():
    global _clone_store
    clones_file = CLONES_DIR / "clones.json"
    meta_file = CLONES_DIR / "clones-meta.json"
    loaded = False

    # 优先尝试加载新格式 clones.json
    if clones_file.exists():
        try:
            with open(clones_file, "r") as f:
                data = json.load(f)
                # 检查是否为字典格式（新格式直接是 dict）
                if isinstance(data, dict):
                    _clone_store = data
                    loaded = True
                elif isinstance(data, list):
                    # 列表格式，转换为字典
                    for item in data:
                        cid = item.get("id")
                        if cid:
                            _clone_store[cid] = item
                    loaded = True
        except Exception as e:
            logger.warning(f"Failed to load clones.json: {e}")

    # 如果新格式加载失败，尝试加载旧格式 clones-meta.json
    if not loaded and meta_file.exists():
        try:
            with open(meta_file, "r") as f:
                meta_list = json.load(f)
            if isinstance(meta_list, list):
                for item in meta_list:
                    cid = item.get("id")
                    if not cid:
                        continue
                    # 转换为标准格式
                    audio_path = item.get("audio_path") or item.get("ref_audio") or ""
                    if audio_path and not os.path.exists(audio_path):
                        # 尝试在 CLONES_DIR 中查找
                        fname = os.path.basename(audio_path)
                        candidate = str(CLONES_DIR / fname)
                        if os.path.exists(candidate):
                            audio_path = candidate
                    clone_data = {
                        "id": cid,
                        "name": item.get("name", cid[:8]),
                        "gender": item.get("gender", "female"),
                        "description": item.get("description", ""),
                        "ref_audio": audio_path,
                        "ref_text": item.get("ref_text", "") or item.get("prompt_text", "") or "",
                        "features": item.get("features", {}),
                        "created_at": item.get("created_at", time.time()),
                        "status": "ready",
                    }
                    _clone_store[cid] = clone_data
                loaded = True
                logger.info(f"Loaded {len(_clone_store)} clones from clones-meta.json")
        except Exception as e:
            logger.warning(f"Failed to load clones-meta.json: {e}")

    if not loaded:
        _clone_store = {}


def _save_clones():
    clones_file = CLONES_DIR / "clones.json"
    try:
        with open(clones_file, "w") as f:
            json.dump(_clone_store, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Failed to save clones: {e}")


def get_disk_usage():
    try:
        stat = os.statvfs(str(DATA_DIR))
        total = stat.f_frsize * stat.f_blocks / (1024**3)
        free = stat.f_frsize * stat.f_bavail / (1024**3)
        used = total - free
        return total, used, free
    except Exception:
        return 100.0, 50.0, 50.0


# 初始化克隆数据
_load_clones()

# 创建 FastAPI 应用
app = FastAPI(title="Voice Cloning Service", version="13.0.0")


@app.on_event("startup")
async def startup_event():
    import asyncio
    loop = asyncio.get_running_loop()

    def _preload():
        logger.info("Preloading CosyVoice2 model on startup...")
        if load_cosyvoice():
            logger.info("CosyVoice2 preloaded successfully")
        else:
            logger.warning("CosyVoice2 preload failed, will retry on first use")

    await loop.run_in_executor(None, _preload)


# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件：output 目录（播客合成输出）
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")

# ==================== API 路由 ====================

@app.get("/health")
async def health():
    gptsovits_ok = _gptsovits_model is not None
    fish_ok = _fish_speech_model is not None
    cosy_ok = _cosyvoice_model is not None
    total, used, free = get_disk_usage()
    clone_count = len(_clone_store)
    # 检查 CosyVoice2 推理锁是否被持有（有正在进行的合成任务）
    cosyvoice_busy = False
    try:
        cosyvoice_busy = not _cosyvoice_synth_lock.acquire(blocking=False)
        if not cosyvoice_busy:
            _cosyvoice_synth_lock.release()
    except:
        pass
    return {
        "status": "ok",
        "models": {
            "gptsovits": gptsovits_ok,
            "fish_speech": fish_ok,
            "cosyvoice": cosy_ok,
        },
        "cosyvoice_busy": cosyvoice_busy,
        "clone_voices": clone_count,
        "disk_total_gb": round(total, 2),
        "disk_used_gb": round(used, 2),
        "disk_free_gb": round(free, 2),
    }


@app.post("/clone")
async def create_clone(
    name: str = Form(...),
    gender: str = Form("female"),
    description: str = Form(""),
    prompt_text: str = Form(""),
    audio: UploadFile = File(...),
):
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")

    clone_id = str(uuid.uuid4())
    ref_dir = CLONES_DIR / clone_id
    ref_dir.mkdir(parents=True, exist_ok=True)

    audio_path = ref_dir / "original.wav"
    content = await audio.read()
    with open(audio_path, "wb") as f:
        f.write(content)

    processed_path = ref_dir / "reference.wav"
    preprocess_audio(str(audio_path), str(processed_path), target_sr=32000)

    ref_text = ""
    # 如果用户提供了 prompt_text，优先使用（比 ASR 更准确，直接决定克隆相似度）
    if prompt_text and prompt_text.strip():
        ref_text = prompt_text.strip()
        logger.info(f"Using user-provided prompt_text ({len(ref_text)} chars): '{ref_text[:60]}'")
    else:
        # 否则使用 ASR 自动转录
        try:
            ref_text = _transcribe_audio(str(processed_path)) or ""
            if ref_text:
                logger.info(f"ASR transcribed ref_text ({len(ref_text)} chars): '{ref_text[:60]}'")
            else:
                logger.warning("ASR returned empty ref_text - clone quality will be degraded!")
        except Exception as e:
            logger.warning(f"Transcription failed: {e}")

    # 使用 F0 基频分析自动检测性别（纠正用户可能错误的选择）
    try:
        audio_features = analyze_audio(str(processed_path))
        f0 = audio_features.get("f0", 0)
        detected_gender = "male" if f0 < 180 else "female"
        logger.info(f"Audio analysis: f0={f0}Hz, detected_gender={detected_gender}, user_gender={gender}")
        # 如果 F0 检测结果与用户选择不一致，以 F0 检测为准
        if f0 > 0 and detected_gender != gender.lower():
            logger.warning(f"Gender mismatch: user selected '{gender}' but F0={f0}Hz indicates '{detected_gender}'. Using F0 detection.")
            gender = detected_gender
    except Exception as e:
        logger.warning(f"Audio analysis failed: {e}")

    ref_id = None
    if check_fish_speech():
        try:
            ref_id = _register_fish_reference(clone_id, str(processed_path), ref_text)
        except Exception as e:
            logger.warning(f"Fish Speech reference registration failed: {e}")

    clone_data = {
        "id": clone_id,
        "name": name,
        "gender": gender,
        "description": description,
        "ref_audio": str(processed_path),
        "ref_text": ref_text,
        "prompt_text": prompt_text,
        "fish_ref_id": ref_id,
        "created_at": time.time(),
        "status": "ready",
    }
    _clone_store[clone_id] = clone_data
    _save_clones()

    # 克隆完成后，立即同步合成预览音频
    # 这样用户点击"试听"时可以直接从缓存返回，无需等待
    preview_cache_path = str(OUTPUT_DIR / f"clone_{clone_id}_preview.wav")
    preview_text = "Hello, nice to meet you. Here is a preview of my voice."  # Standard preview text
    # 截断 ref_text，使其长度与 preview_text 接近，避免 "too short" 警告导致性能下降
    truncated_ref_text = ref_text[:max(len(preview_text) * 2, 20)] if ref_text else ""
    logger.info(f"Generating preview audio during clone (text='{preview_text}', ref_text_len={len(truncated_ref_text)})...")
    preview_ready = False
    try:
        preview_clone = dict(clone_data)
        preview_clone["ref_text"] = truncated_ref_text
        preview_success = synthesize_audio(preview_text, preview_cache_path, preview_clone, strict_clone=True)
        if preview_success and os.path.exists(preview_cache_path) and os.path.getsize(preview_cache_path) > 1000:
            logger.info(f"Preview audio generated successfully: {os.path.getsize(preview_cache_path)} bytes")
            preview_ready = True
        else:
            logger.warning("Preview audio generation failed, will retry on preview request")
    except Exception as e:
        logger.error(f"Preview audio generation error: {e}")

    clone_data["preview_ready"] = preview_ready
    return clone_data


@app.get("/clones")
async def list_clones():
    return list(_clone_store.values())


def _generate_preview_background(clone_id: str):
    """后台生成预览音频（在线程池中执行）"""
    clone = _clone_store.get(clone_id)
    if not clone:
        with _preview_task_lock:
            _preview_task_store[clone_id] = {"status": "failed", "started_at": time.time()}
        return

    cache_path = str(OUTPUT_DIR / f"clone_{clone_id}_preview.wav")
    # 缓存已存在则跳过
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 1000:
        with _preview_task_lock:
            _preview_task_store[clone_id] = {"status": "done", "started_at": time.time()}
        return

    clone_name = clone.get("name", "克隆声音")
    ref_text = clone.get("ref_text", "")
    preview_text = "Hello, nice to meet you. Here is a preview of my voice."  # Standard preview text
    truncated_ref_text = ref_text[:max(len(preview_text) * 2, 20)] if ref_text else ""

    preview_clone = dict(clone)
    preview_clone["ref_text"] = truncated_ref_text

    logger.info(f"[PreviewBG] Start generating preview for clone {clone_id} (text='{preview_text}')")
    try:
        success = synthesize_audio(preview_text, cache_path, preview_clone, strict_clone=True)
        if success and os.path.exists(cache_path) and os.path.getsize(cache_path) > 1000:
            logger.info(f"[PreviewBG] Preview generated for clone {clone_id}: {os.path.getsize(cache_path)} bytes")
            with _preview_task_lock:
                _preview_task_store[clone_id] = {"status": "done", "started_at": time.time()}
        else:
            logger.warning(f"[PreviewBG] Preview generation failed for clone {clone_id}")
            with _preview_task_lock:
                _preview_task_store[clone_id] = {"status": "failed", "started_at": time.time()}
    except Exception as e:
        logger.error(f"[PreviewBG] Preview generation error for clone {clone_id}: {e}")
        with _preview_task_lock:
            _preview_task_store[clone_id] = {"status": "failed", "started_at": time.time()}


@app.get("/preview/{clone_id}")
async def get_clone_preview(clone_id: str):
    clone = _clone_store.get(clone_id)
    if not clone:
        raise HTTPException(status_code=404, detail=f"Clone '{clone_id}' not found")

    # 检查缓存 — 命中则直接返回音频（秒回）
    cache_path = str(OUTPUT_DIR / f"clone_{clone_id}_preview.wav")
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 1000:
        return FileResponse(
            cache_path,
            media_type="audio/wav",
            filename=f"{clone_id}_preview.wav",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"},
        )

    # 缓存未命中 — 检查是否已有后台生成任务
    with _preview_task_lock:
        task = _preview_task_store.get(clone_id)
        # 如果任务已超时（超过 5 分钟），清除并重新启动
        if task and task["status"] == "generating" and (time.time() - task["started_at"]) > 300:
            logger.warning(f"[Preview] Task for {clone_id} timed out, restarting")
            task = None
        # 如果任务失败，清除以便重试
        if task and task["status"] == "failed":
            task = None

        if not task or task["status"] not in ("generating", "done"):
            # 启动后台生成任务
            _preview_task_store[clone_id] = {"status": "generating", "started_at": time.time()}
            try:
                loop = asyncio.get_running_loop()
                loop.run_in_executor(None, _generate_preview_background, clone_id)
            except RuntimeError:
                # 没有事件循环，直接用线程
                threading.Thread(target=_generate_preview_background, args=(clone_id,), daemon=True).start()
            logger.info(f"[Preview] Started background generation for clone {clone_id}")

    # 返回 202 — 前端轮询直到缓存命中
    return JSONResponse(
        status_code=202,
        content={"status": "generating", "clone_id": clone_id, "message": "Preview audio is being generated. Please retry in a few seconds."},
    )


@app.get("/system-voice-preview/{voice_id}")
async def get_system_voice_preview(voice_id: str):
    SYSTEM_VOICE_TO_EDGE = {
        # 中文声音
        "female-professional": "zh-CN-XiaoxiaoNeural",
        "female-friendly":    "zh-CN-XiaoyiNeural",
        "female-northeast":   "zh-CN-liaoning-XiaobeiNeural",
        "female-shaanxi":     "zh-CN-shaanxi-XiaoniNeural",
        "male-narrator":      "zh-CN-YunxiNeural",
        "male-deep":          "zh-CN-YunjianNeural",
        "male-sunny":         "zh-CN-YunyangNeural",
        "male-youth":         "zh-CN-YunxiaNeural",
        # 英文声音（海外）
        "en-female-jenny":    "en-US-JennyNeural",
        "en-female-ariana":   "en-US-AriaNeural",
        "en-female-sarah":    "en-GB-SoniaNeural",
        "en-male-guy":        "en-US-GuyNeural",
        "en-male-ryan":       "en-US-RyanNeural",
        "en-male-james":      "en-GB-RyanNeural",
    }

    edge_voice = SYSTEM_VOICE_TO_EDGE.get(voice_id)
    if not edge_voice:
        raise HTTPException(status_code=404, detail=f"System voice '{voice_id}' not found")

    cache_path = str(OUTPUT_DIR / f"system_{voice_id}_preview.wav")
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 1000:
        return FileResponse(
            cache_path,
            media_type="audio/wav",
            filename=f"{voice_id}_preview.wav",
            headers={"Cache-Control": "public, max-age=3600"},
        )

    template_names = {
        # 中文声音
        "female-professional": "Sarah 晓晓",
        "female-friendly":    "Emma 晓伊",
        "female-northeast":   "Beibei 小北",
        "female-shaanxi":     "Nini 小妮",
        "male-narrator":      "David 云希",
        "male-deep":          "James 云健",
        "male-sunny":         "Tom 云扬",
        "male-youth":         "Leo 云夏",
        # 英文声音（海外）
        "en-female-jenny":    "Jenny",
        "en-female-ariana":   "Aria",
        "en-female-sarah":    "Sarah (UK)",
        "en-male-guy":        "Guy",
        "en-male-ryan":       "Ryan",
        "en-male-james":      "James (UK)",
    }
    name = template_names.get(voice_id, voice_id)
    # 标准预览文案（中文/英文统一标准）
    if voice_id.startswith("en-"):
        preview_text = "Hello, nice to meet you. This is my voice preview."
    else:
        preview_text = "你好，很高兴认识你，这是我的声音预览。"

    try:
        generated = synthesize_with_edge_tts(preview_text, edge_voice, cache_path)
        if generated and os.path.exists(cache_path):
            return FileResponse(
                cache_path,
                media_type="audio/wav",
                filename=f"{voice_id}_preview.wav",
                headers={"Cache-Control": "public, max-age=3600"},
            )
    except Exception as e:
        logger.error(f"System voice preview error: {e}")

    raise HTTPException(status_code=500, detail="Failed to generate system voice preview")


@app.post("/synthesize")
async def synthesize(
    text: str = Form(...),
    clone_id: str = Form(""),
    audio: UploadFile | None = File(None),
):
    output_id = str(uuid.uuid4())
    output_path = str(OUTPUT_DIR / f"{output_id}.wav")

    meta = {}
    ref_audio = ""
    ref_text = ""

    if clone_id and clone_id in _clone_store:
        clone = _clone_store[clone_id]
        ref_audio = clone.get("ref_audio", "")
        ref_text = clone.get("ref_text", "")
        meta = clone
    elif audio is not None:
        tmp_dir = OUTPUT_DIR / f"tmp_{output_id}"
        tmp_dir.mkdir(exist_ok=True)
        orig_path = tmp_dir / "upload.wav"
        content = await audio.read()
        with open(orig_path, "wb") as f:
            f.write(content)
        proc_path = tmp_dir / "ref.wav"
        preprocess_audio(str(orig_path), str(proc_path), target_sr=32000)
        ref_audio = str(proc_path)
        try:
            ref_text = _transcribe_audio(str(proc_path)) or ""
        except:
            ref_text = ""
        meta = {"ref_audio": ref_audio, "ref_text": ref_text, "clone_id": clone_id}

    success = synthesize_audio(text, output_path, meta, strict_clone=True)
    if success and os.path.exists(output_path):
        return FileResponse(output_path, media_type="audio/wav", filename=f"{output_id}.wav")
    raise HTTPException(status_code=500, detail="Synthesis failed")


@app.post("/synthesize-podcast")
async def synthesize_podcast(
    script: str = Form(...),
    clone_ids: str = Form("[]"),
    podcast_type: str = Form("single"),
    voice1: str = Form(""),
    voice2: str = Form(""),
):
    import re
    import random
    import shutil

    SYSTEM_VOICE_TO_EDGE = {
        # 中文声音
        "female-professional": "zh-CN-XiaoxiaoNeural",
        "female-friendly":    "zh-CN-XiaoyiNeural",
        "female-northeast":   "zh-CN-liaoning-XiaobeiNeural",
        "female-shaanxi":     "zh-CN-shaanxi-XiaoniNeural",
        "male-narrator":      "zh-CN-YunxiNeural",
        "male-deep":          "zh-CN-YunjianNeural",
        "male-sunny":         "zh-CN-YunyangNeural",
        "male-youth":         "zh-CN-YunxiaNeural",
        # 英文声音（海外）
        "en-female-jenny":    "en-US-JennyNeural",
        "en-female-ariana":   "en-US-AriaNeural",
        "en-female-sarah":    "en-GB-SoniaNeural",
        "en-male-guy":        "en-US-GuyNeural",
        "en-male-ryan":       "en-US-RyanNeural",
        "en-male-james":      "en-GB-RyanNeural",
    }

    clone_id_list = json.loads(clone_ids) if isinstance(clone_ids, str) else clone_ids

    voice_config = {}

    def _parse_voice(voice_id, default_clone_idx):
        if voice_id and voice_id.startswith("clone-"):
            cid = voice_id.replace("clone-", "")
            clone = _clone_store.get(cid)
            if clone:
                return {"type": "clone", "id": cid, "meta": clone}
        if voice_id and voice_id in SYSTEM_VOICE_TO_EDGE:
            return {"type": "system", "id": voice_id, "edge_voice": SYSTEM_VOICE_TO_EDGE[voice_id]}
        if clone_id_list and default_clone_idx < len(clone_id_list):
            cid = clone_id_list[default_clone_idx]
            clone = _clone_store.get(cid)
            if clone:
                return {"type": "clone", "id": cid, "meta": clone}
        return {"type": "system", "id": "female-professional", "edge_voice": "zh-CN-XiaoxiaoNeural"}

    voice_config["Host"] = _parse_voice(voice1, 0)
    if podcast_type == "dual":
        voice_config["Guest"] = _parse_voice(voice2, 1)
    else:
        voice_config["Guest"] = voice_config["Host"]

    segments = []
    lines = script.strip().split("\n")
    current_speaker = "Host"
    current_text = ""

    speaker_pattern = re.compile(r'^\[(主持人|嘉宾|Host|Guest|旁白)\]\s*$', re.IGNORECASE)

    for line in lines:
        line = line.strip()
        if not line:
            if current_text:
                segments.append({"speaker": current_speaker, "text": current_text.strip()})
                current_text = ""
            continue
        m = speaker_pattern.match(line)
        if m:
            if current_text:
                segments.append({"speaker": current_speaker, "text": current_text.strip()})
                current_text = ""
            spk = m.group(1)
            if spk in ("主持人", "Host", "host"):
                current_speaker = "Host"
            elif spk in ("嘉宾", "Guest", "guest"):
                current_speaker = "Guest"
            else:
                current_speaker = "Host"
        else:
            current_text += line + " "

    if current_text:
        segments.append({"speaker": current_speaker, "text": current_text.strip()})

    if not segments:
        segments.append({"speaker": "Host", "text": script})

    output_id = str(uuid.uuid4())
    total_chars = sum(len(s["text"]) for s in segments)
    total_segments = len(segments)

    def _send_event(event_type, **kwargs):
        data = {"type": event_type}
        data.update(kwargs)
        return (json.dumps(data, ensure_ascii=False) + "\n").encode("utf-8")

    def generate_podcast():
        yield _send_event("start", total_segments=total_segments, total_chars=total_chars)

        audio_chunks = []
        total_duration = 0.0
        output_dir = OUTPUT_DIR / f"podcast_{output_id}"
        output_dir.mkdir(exist_ok=True)

        for seg_idx, seg in enumerate(segments):
            speaker = seg["speaker"]
            text = seg["text"]
            vc = voice_config[speaker]

            yield _send_event(
                "segment_start",
                segment_index=seg_idx,
                total_segments=total_segments,
                speaker=speaker,
                voice_type=vc["type"],
                voice_id=vc["id"],
                text_length=len(text),
            )

            chunk_path = str(output_dir / f"seg_{seg_idx:03d}.wav")
            success = False
            last_error = None

            # 克隆声音：多级降级策略，确保最大可能使用克隆音色
            if vc["type"] == "clone":
                meta = vc.get("meta", {})

                # 长文本分段合成（避免 CosyVoice2 OOM）
                # 50 字/段：RTF 随文本长度非线性增长（39字 RTF=6.7, 100字 RTF=46.17）
                # 小段合成每段约 10-15 秒，进度更新更频繁，总耗时更短
                MAX_CHARS = 50
                # speed=1.3：实测稳定的语速参数（speed=2.0 未减少推理时间）
                PODCAST_SPEED = 1.3
                text_chunks = []
                if len(text) > MAX_CHARS:
                    # 按句子分割
                    import re as _re
                    sentences = _re.split(r'(?<=[。！？.!?；;])', text)
                    current_chunk = ""
                    for s in sentences:
                        if not s.strip():
                            continue
                        if len(current_chunk) + len(s) > MAX_CHARS and current_chunk:
                            text_chunks.append(current_chunk)
                            current_chunk = s
                        else:
                            current_chunk += s
                    if current_chunk.strip():
                        text_chunks.append(current_chunk)

                    if len(text_chunks) > 1:
                        logger.info(f"Segment {seg_idx}: split into {len(text_chunks)} chunks (text={len(text)} chars)")
                else:
                    text_chunks = [text]

                # 合成所有分块
                chunk_paths = []
                all_chunks_success = True
                for ci, text_chunk in enumerate(text_chunks):
                    sub_path = str(output_dir / f"seg_{seg_idx:03d}_part{ci:02d}.wav")
                    sub_success = False

                    # 第1次尝试：strict_clone 模式（最高相似度）
                    sub_success = synthesize_audio(text_chunk, sub_path, meta, strict_clone=True, speed=PODCAST_SPEED)
                    if not sub_success:
                        logger.warning(f"Segment {seg_idx} part {ci}: strict_clone failed, trying non-strict mode...")
                        time.sleep(1)
                        # 第2次尝试：非严格模式（使用 instruct2，更稳定）
                        sub_success = synthesize_audio(text_chunk, sub_path, meta, strict_clone=False, speed=PODCAST_SPEED)

                    if not sub_success:
                        logger.warning(f"Segment {seg_idx} part {ci}: all clone modes failed, falling back to Edge TTS...")
                        # 第3次尝试：降级到 Edge TTS（保证能生成）
                        gender = meta.get("gender", "female") or "female"
                        if str(gender).lower().startswith("male"):
                            fallback_voice = "zh-CN-YunxiNeural"
                        else:
                            fallback_voice = "zh-CN-XiaoxiaoNeural"
                        sub_success = synthesize_with_edge_tts(text_chunk, fallback_voice, sub_path, max_retries=2)
                        if sub_success:
                            logger.warning(f"Segment {seg_idx} part {ci}: used Edge TTS fallback (voice will differ from clone)")

                    if sub_success and os.path.exists(sub_path):
                        chunk_paths.append(sub_path)
                    else:
                        all_chunks_success = False

                # 合并分块音频
                if chunk_paths:
                    if len(chunk_paths) == 1:
                        # 只有一个分块，直接复制
                        import shutil
                        shutil.copy2(chunk_paths[0], chunk_path)
                        success = True
                    else:
                        # 合并多个分块
                        try:
                            all_audio = []
                            target_sr = 44100
                            for cp in chunk_paths:
                                data, sr = sf.read(cp)
                                if data.ndim > 1:
                                    data = data.mean(axis=1)
                                if sr != target_sr:
                                    from scipy.signal import resample_poly
                                    from math import gcd
                                    g = gcd(target_sr, sr)
                                    data = resample_poly(data, target_sr // g, sr // g)
                                all_audio.append(data)
                            combined = np.concatenate(all_audio)
                            sf.write(chunk_path, combined.astype(np.float32), target_sr, subtype='PCM_16')
                            success = True
                            logger.info(f"Segment {seg_idx}: merged {len(chunk_paths)} chunks successfully")
                        except Exception as merge_err:
                            logger.error(f"Segment {seg_idx}: failed to merge chunks: {merge_err}")
                            # 使用第一个分块作为降级
                            if chunk_paths:
                                import shutil
                                shutil.copy2(chunk_paths[0], chunk_path)
                                success = True
            else:
                # 系统声音：使用 Edge TTS，自带重试
                edge_voice = vc.get("edge_voice", "zh-CN-XiaoxiaoNeural")
                success = synthesize_with_edge_tts(text, edge_voice, chunk_path, max_retries=3)

            if success and os.path.exists(chunk_path):
                try:
                    data, sr = sf.read(chunk_path)
                    dur = len(data) / sr if data.ndim == 1 else len(data[:, 0]) / sr
                    total_duration += dur
                    audio_chunks.append(chunk_path)
                    yield _send_event(
                        "segment_done",
                        segment_index=seg_idx,
                        total_segments=total_segments,
                        speaker=speaker,
                        duration=round(dur, 2),
                    )
                except Exception as e:
                    logger.error(f"Error reading chunk: {e}")
                    yield _send_event(
                        "segment_failed",
                        segment_index=seg_idx,
                        total_segments=total_segments,
                        speaker=speaker,
                        error=str(e),
                    )
            else:
                # 段合成失败：生成一个 0.5 秒的静音段作为占位，确保整个播客仍然可以生成
                logger.warning(f"Segment {seg_idx} failed, inserting silent placeholder")
                try:
                    silent_samples = int(44100 * 0.5)  # 0.5 秒静音
                    silent_data = np.zeros(silent_samples, dtype=np.float32)
                    sf.write(chunk_path, silent_data, 44100, subtype='PCM_16')
                    if os.path.exists(chunk_path):
                        audio_chunks.append(chunk_path)
                        total_duration += 0.5
                except Exception as silent_err:
                    logger.error(f"Failed to create silent placeholder: {silent_err}")
                yield _send_event(
                    "segment_failed",
                    segment_index=seg_idx,
                    total_segments=total_segments,
                    speaker=speaker,
                    error="synthesis failed",
                )

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

            if os.path.exists(final_path):
                file_size = os.path.getsize(final_path)
                yield _send_event(
                    "done",
                    success=True,
                    audio_url=f"/output/{output_id}.wav",
                    duration=round(total_duration, 2),
                    file_size=file_size,
                    segments=len(audio_chunks),
                    engine="cosyvoice" if any(vc["type"] == "clone" for vc in voice_config.values()) else "edge-tts",
                )
            else:
                yield _send_event("error", message="Failed to generate final audio")
        else:
            yield _send_event("error", message="No audio chunks generated")

        try:
            shutil.rmtree(output_dir, ignore_errors=True)
        except:
            pass

    import asyncio
    import queue
    import threading
    import time as _time

    q: "queue.Queue[bytes | None]" = queue.Queue(maxsize=200)
    # 客户端断开连接标志：避免合成线程在队列满时永久阻塞
    client_disconnected = threading.Event()
    synth_start_time = _time.time()

    # 心跳线程：每 10 秒发送一次心跳事件，防止长时间合成时连接超时
    def _heartbeat_thread():
        while not client_disconnected.is_set():
            _time.sleep(10)
            if client_disconnected.is_set():
                break
            elapsed = _time.time() - synth_start_time
            heartbeat_event = _send_event("heartbeat", elapsed=round(elapsed, 1))
            try:
                q.put(heartbeat_event, timeout=5)
            except queue.Full:
                # 队列满，跳过心跳（合成事件优先）
                pass

    def _run_sync():
        # 启动心跳线程
        hb_thread = threading.Thread(target=_heartbeat_thread, daemon=True)
        hb_thread.start()

        try:
            for chunk in generate_podcast():
                # 客户端已断开，停止合成（释放 CPU 和锁资源）
                if client_disconnected.is_set():
                    logger.info("Client disconnected, aborting podcast synthesis")
                    break
                # 使用超时 put，避免队列满时永久阻塞
                # 如果 put 超时，说明客户端可能已断开，检查标志后决定是否继续
                try:
                    q.put(chunk, timeout=30)
                except queue.Full:
                    if client_disconnected.is_set():
                        logger.info("Queue full and client disconnected, aborting")
                        break
                    # 客户端可能还在但消费慢，丢弃旧事件继续 put
                    logger.warning("Queue full after 30s, dropping old events to continue")
                    try:
                        while not q.empty():
                            q.get_nowait()
                    except:
                        pass
                    try:
                        q.put(chunk, timeout=10)
                    except queue.Full:
                        logger.error("Queue still full after drain, aborting synthesis")
                        break
        except Exception as e:
            logger.error(f"Podcast synthesis thread error: {e}")
            import traceback
            logger.error(traceback.format_exc())
        finally:
            client_disconnected.set()  # 停止心跳线程
            try:
                q.put(None, timeout=5)
            except queue.Full:
                pass

    thread = threading.Thread(target=_run_sync, daemon=True)
    thread.start()

    async def _async_generator():
        loop = asyncio.get_event_loop()
        try:
            while True:
                chunk = await loop.run_in_executor(None, q.get)
                if chunk is None:
                    break
                yield chunk
        except asyncio.CancelledError:
            # 客户端断开连接，通知合成线程停止
            logger.info("Client disconnected from streaming response")
            client_disconnected.set()
            raise
        except Exception as e:
            logger.warning(f"Streaming generator error: {e}")
            client_disconnected.set()

    from fastapi.responses import StreamingResponse
    return StreamingResponse(_async_generator(), media_type="application/x-ndjson")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("VOICE_SERVICE_PORT", 8907))
    logger.info(f"Starting Voice Cloning Service v13 on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
