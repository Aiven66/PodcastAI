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

# v1.0.35: 修复 macOS GUI 应用不继承 shell PATH 的问题
# 从 Finder/LaunchPad 启动的应用 PATH 只有 /usr/bin:/bin:/usr/sbin:/sbin
# 导致 ffmpeg（Homebrew 安装在 /opt/homebrew/bin）不可用
# edge-tts 合成后的 MP3 无法转换为 WAV，播客生成报 "No audio chunks generated"
# v1.0.79(win): Windows 通过 imageio-ffmpeg 内置 ffmpeg.exe，把其目录并入 PATH
_cur_path = os.environ.get('PATH', '')
if sys.platform == 'win32':
    try:
        import imageio_ffmpeg
        _ff_dir = os.path.dirname(imageio_ffmpeg.get_ffmpeg_exe())
        if _ff_dir and _ff_dir not in _cur_path:
            os.environ['PATH'] = _ff_dir + os.pathsep + _cur_path
    except Exception:
        pass
else:
    _extra_paths = ['/opt/homebrew/bin', '/usr/local/bin', '/snap/bin']
    for _p in _extra_paths:
        if os.path.isdir(_p) and _p not in _cur_path:
            _cur_path = _cur_path + os.pathsep + _p
os.environ['PATH'] = _cur_path

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
# 桌面客户端环境检测：
# - PODCASTAI_DESKTOP=1 环境变量由 Electron 主进程设置
# - sys.frozen 由 PyInstaller 设置
# 两种方式都表示运行在打包的桌面客户端中
def _is_desktop_app():
    """检测是否运行在桌面客户端环境中"""
    return getattr(sys, 'frozen', False) or os.environ.get("PODCASTAI_DESKTOP") == "1"

def _get_app_dir():
    """获取应用根目录（支持桌面客户端环境）"""
    if _is_desktop_app():
        # 桌面客户端：使用 main.py 所在目录
        return Path(__file__).parent
    return Path(__file__).parent

def _get_data_dir():
    """获取数据目录（用户数据，可写）"""
    # 优先使用环境变量
    env_dir = os.environ.get("VOICE_DATA_DIR")
    if env_dir:
        return Path(env_dir)
    # 桌面客户端环境：使用用户目录
    if _is_desktop_app():
        # macOS: ~/Library/Application Support/PodcastAI/voice-data
        # Windows: %APPDATA%/PodcastAI/voice-data
        home = Path.home()
        if sys.platform == 'darwin':
            return home / "Library" / "Application Support" / "PodcastAI" / "voice-data"
        else:
            return home / "AppData" / "Roaming" / "PodcastAI" / "voice-data"
    # 开发环境
    return Path(__file__).parent / "voice-data"

def _get_model_dir():
    """获取 CosyVoice2 模型目录"""
    # 优先使用环境变量
    env_dir = os.environ.get("COSYVOICE_MODEL_DIR")
    if env_dir:
        return Path(env_dir)
    # 桌面客户端环境：模型在用户数据目录
    if _is_desktop_app():
        return _get_data_dir() / "models" / "CosyVoice2-0.5B"
    # 开发环境
    return Path(__file__).parent / "CosyVoice" / "pretrained_models" / "CosyVoice2-0.5B"

APP_DIR = _get_app_dir()
DATA_DIR = _get_data_dir()
CLONES_DIR = DATA_DIR / "clones"
OUTPUT_DIR = DATA_DIR / "output"
SCRIPT_DIR = APP_DIR
GPT_SOVITS_DIR = APP_DIR / "GPT-SoVITS"
MODEL_DIR = _get_model_dir()

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
    v1.0.68: 升级到 medium 模型 — 中文准确率大幅提升，减少幻觉（"听出"不存在的文字）
    small 模型的幻觉是漏读校验反复放行的根因之一。
    """
    global _whisper_model
    if _whisper_model is None:
        try:
            import whisper
            logger.info("Loading Whisper medium model for Chinese-optimized ASR...")
            _whisper_model = whisper.load_model("medium")
            logger.info("Whisper medium model loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load Whisper medium model, falling back to small: {e}")
            try:
                import whisper
                _whisper_model = whisper.load_model("small")
                logger.info("Whisper small model loaded (fallback)")
            except Exception as e2:
                logger.warning(f"Failed to load Whisper small model: {e2}")
                try:
                    import whisper
                    _whisper_model = whisper.load_model("base")
                    logger.info("Whisper base model loaded (last resort)")
                except Exception as e3:
                    logger.warning(f"Failed to load Whisper base model: {e3}")
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


# ═══════════════════════════════════════════════════════════════
# v1.0.73: 中文数字规范化（TN — Text Normalization）
# 根因：text_frontend=False 时阿拉伯数字直接进 tokenizer，LLM 对数字
# token 建模不稳 → "2025"读成"2015"、"10%"漏读。合成前把数字转为
# 中文读音文本，模型只需处理纯中文 → 数字朗读精准。
# ═══════════════════════════════════════════════════════════════
_CN_DIGIT_MAP = {'0': '零', '1': '一', '2': '二', '3': '三', '4': '四',
                 '5': '五', '6': '六', '7': '七', '8': '八', '9': '九'}

# 常用量词/单位字：数字后跟这些字 → 按数值读法（"10001000次"→"一千万一千次"）
_CN_UNIT_CHARS = set('个位倍人次天点分钟秒小时万亿百千万亿元美欧日圆角分米克斤吨升度批种项台'
                     '件名岁层楼号路段章节集课题阵场轮遍趟顿强年月日上下左右')


def _digits_to_chinese(digits: str) -> str:
    """逐位读：'2025' → '二零二五'（年份、编号、电话等）"""
    return ''.join(_CN_DIGIT_MAP[c] for c in digits)


def _read_section(n: int) -> str:
    """读 0-9999 节内数值：1024 → '一千零二十四'，15 → '十五'"""
    if n == 0:
        return ''
    parts = []
    for val, unit in ((1000, '千'), (100, '百'), (10, '十')):
        d, n = divmod(n, val)
        if d:
            parts.append(_CN_DIGIT_MAP[str(d)] + unit)
        elif parts and n:
            parts.append('零')
    if n:
        parts.append(_CN_DIGIT_MAP[str(n)])
    s = ''.join(parts)
    if s.startswith('一十'):
        s = s[1:]  # 口语：一十 → 十（"十五"而非"一十五"）
    return s


def _read_int_chinese(num: int) -> str:
    """整数按中文万进制读法：12345 → '一万二千三百四十五'

    补零规则：相邻非零节之间，低节 < 1000（千位空缺）时补"零"
    如 10001 → '一万零一'，100000001 → '一亿零一'
    """
    if num == 0:
        return '零'
    if num < 0:
        return '负' + _read_int_chinese(-num)
    yi = num // 10**8 if num >= 10**8 else 0
    rest = num - yi * 10**8
    wan = rest // 10**4 if rest >= 10**4 else 0
    ge = rest - wan * 10**4
    out = ''
    for val, u in ((yi, '亿'), (wan, '万'), (ge, '')):
        if val == 0:
            continue
        if out and val < 1000:
            out += '零'
        out += (_read_int_chinese(val) if val >= 10000 else _read_section(val)) + u
    return out


def _read_number_chinese(num_str: str) -> str:
    """数字串转中文读法：'3.14' → '三点一四'，'12345' → 按万进制"""
    if '.' in num_str:
        int_part, frac = num_str.split('.', 1)
        int_read = _read_int_chinese(int(int_part)) if int_part else '零'
        return int_read + '点' + ''.join(_CN_DIGIT_MAP[c] for c in frac)
    return _read_int_chinese(int(num_str))


def _normalize_chinese_numbers(text: str) -> str:
    """v1.0.73: 阿拉伯数字 → 中文读音（按序规则）：
      1. 千分位  1,234        → 1234
      2. 百分比  10% / 3.5%   → 百分之十 / 百分之三点五
      3. 年份    2025年       → 二零二五年（逐位）
      4. 月日    8月19日      → 八月十九日
      5. 序数    第3          → 第三
      6. 范围    3-5年        → 三到五年
      7. 其余数字：后跟汉字单位→按读法；≥8位→逐位（电话）；4位裸数字→逐位（年份）
    """
    if not text or not re.search(r'\d', text):
        return text
    # 1. 千分位逗号（仅数字 3 位一组场景）
    text = re.sub(r'(\d),(?=\d{3}(\D|$))', r'\1', text)
    # 2. 百分比
    text = re.sub(r'(\d+(?:\.\d+)?)\s*%',
                  lambda m: '百分之' + _read_number_chinese(m.group(1)), text)
    # 3. 年份（任意 4 位数字后跟"年"，逐位读："2025年"→"二零二五年"、
    #    "1066年"→"一零六六年"；1-3 位（如"100年"时长）走数值读法）
    text = re.sub(r'(?<!\d)(\d{4})\s*年',
                  lambda m: _digits_to_chinese(m.group(1)) + '年', text)
    # 4. 月 / 日
    text = re.sub(r'(?<!\d)(\d{1,2})\s*月',
                  lambda m: _read_int_chinese(int(m.group(1))) + '月', text)
    text = re.sub(r'(?<!\d)(\d{1,3})\s*(?=[日号])',
                  lambda m: _read_int_chinese(int(m.group(1))), text)
    # 5. 序数
    text = re.sub(r'第\s*(\d+)',
                  lambda m: '第' + _read_int_chinese(int(m.group(1))), text)
    # 6. 数字范围连字符 → "到"（先于通用替换，避免当负号）
    text = re.sub(r'(?<=\d)\s*[-–—~至]\s*(?=\d)', '到', text)

    # 7. 通用数字替换（优先级：量词单位 > 长号码 > 裸年份 > 汉字 > 默认数值）
    def _repl(m):
        num = m.group(0)
        end = m.end()
        after = text[end:end + 1] if end < len(text) else ''
        prev = text[m.start() - 1] if m.start() > 0 else ''
        after_is_cjk = bool(after) and '\u4e00' <= after <= '\u9fff'
        # 7a. 后跟量词/单位 → 按数值读法："10001000次"→"一千万一千次"、"2.5万"→"二点五万"
        if after_is_cjk and after in _CN_UNIT_CHARS:
            return _read_number_chinese(num)
        # 7b. 长纯数字（≥8 位，电话/订单号）→ 逐位读："13812345678请"→"一三八一二三四五六七八请"
        if '.' not in num and len(num) >= 8:
            return _digits_to_chinese(num)
        # 7c. 形似年份的裸 4 位整数（1900-2099，前非 ASCII 字母数字）→ 逐位读：
        #     "从2025开始"→"从二零二五开始"、"2025。"→"二零二五"
        if re.fullmatch(r'(?:19|20)\d{2}', num) and not (prev and prev.isascii() and prev.isalnum()):
            return _digits_to_chinese(num)
        # 7d. 后跟其他汉字（动词/形容词）→ 数值读法："15真香"→"十五真香"
        if after_is_cjk:
            return _read_number_chinese(num)
        return _read_number_chinese(num)

    text = re.sub(r'\d+(?:\.\d+)?', _repl, text)
    return text


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

    - 中文：v1.0.73 数字规范化（TN）— 阿拉伯数字转中文读音，
      根治"2025 读成 2015"、"10% 漏读"（text_frontend=False 下
      数字直接进 tokenizer 导致的建模不稳）
    - 英文：应用英文预处理（缩写展开、数字转换）
    - 混合：先中文数字规范化（中文语境数字按中文读法），再英文预处理
    """
    if not text:
        return text
    lang = _detect_text_language(text)
    if lang == 'en':
        return _preprocess_english_text(text)
    elif lang == 'mixed':
        # 混合文本：先数字转中文读音（播客脚本以中文朗读为主），
        # 再应用英文预处理（缩写展开等，数字已转中文不受影响）
        text = _normalize_chinese_numbers(text)
        return _preprocess_english_text(text)
    else:
        # 中文：数字规范化（TN），其余保持原样
        return _normalize_chinese_numbers(text)


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
# v1.0.61: Whisper 闭环校验 — 彻底解决重复朗读/漏读问题
# ═══════════════════════════════════════════════════════════════
# 根因（v1.0.42~v1.0.60 全部失效的原因）：
#   之前的防线全部是"猜测式"检测（文本清洗 / token 精确匹配 / 波形相似度 / 时长截断）：
#   - token 精确匹配：语音 token 每次重复时声学上有细微差异，不完全相同 → 漏检
#   - 波形余弦相似度：太严格检测不到重复，太宽松误伤正常音频 → v1.0.58 被迫禁用
#   - 时长截断：盲目截断导致正常播客被截断 → v1.0.58 被迫禁用
#   - instruct2 模式（v1.0.60）：去掉了参考音频影响，但 LLM 采样固有循环仍会产生复读
#
# v1.0.61 方案 — 语义级闭环校验（在音频写盘后）：
#   1. 用本地 Whisper 转录刚生成的音频（快速配置：greedy + 不继承上文）
#   2. 转录文本与脚本文案做模糊对齐（difflib SequenceMatcher）：
#      a. 漏读（覆盖 < 85%）→ 判定失败 → 上层重试链拆分重合成
#      b. 尾部复读/幻觉（文案已完整覆盖后仍有多余内容）→ 在覆盖完成的时间点精准裁剪
#      c. 中间复读（相邻重复 n-gram 且原文无此重复）→ 判定失败 → 重试
#      d. 正常 → 通过
#   无论 LLM 幻觉模式如何变化，只要"读出来的内容"与"脚本"不一致就能被发现。

# 校验开关（可用环境变量 VOICE_VERIFY=0 关闭，用于对比测试）
_VERIFY_ENABLED = os.environ.get("VOICE_VERIFY", "1") != "0"


def _norm_verify_text(text: str) -> str:
    """校验用文本归一化：去标点/空白、转小写、繁转简"""
    if not text:
        return ""
    t = re.sub(r'[，。！？；：、,.!?;:\s\'"\-—…·『』「」（）()【】\[\]<《》>*#+=@&|~`^\\/_]', '', text)
    t = t.lower()
    try:
        import opencc
        t = opencc.OpenCC('t2s').convert(t)
    except Exception:
        pass
    return t


def _transcribe_with_segments(audio_path: str, hint_lang: Optional[str] = None, max_seconds: float = 90.0):
    """快速转录：返回 (完整文本, [{start, end, text}, ...])，失败返回 None

    校验专用配置：
      - beam_size=1（greedy）：速度优先，TTS 干净音频准确率足够
      - condition_on_previous_text=False：防止 Whisper 自身的复读幻觉传播
      - temperature=0：确定性输出
    """
    model = _get_whisper_model()
    if model is None:
        return None

    import tempfile
    temp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    temp_wav.close()
    wav_path = temp_wav.name
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", audio_path, "-ar", "16000", "-ac", "1",
             "-sample_fmt", "s16", "-t", str(int(max_seconds)), wav_path],
            capture_output=True, text=True, timeout=60,
        )
    except Exception as e:
        logger.warning(f"v1.0.61 verify: ffmpeg preprocess failed: {e}")
        if os.path.exists(wav_path):
            os.unlink(wav_path)
        return None

    try:
        transcribe_kwargs = {
            'fp16': False,
            'beam_size': 1,
            'best_of': 1,
            'temperature': 0.0,
            'condition_on_previous_text': False,
            'compression_ratio_threshold': 2.4,
            'no_speech_threshold': 0.6,
            # v1.0.61: 词级时间戳 — 精准定位复读/幻觉内容的起止时间，用于精准裁剪
            'word_timestamps': True,
        }
        if hint_lang == 'zh':
            transcribe_kwargs['language'] = 'zh'
            transcribe_kwargs['initial_prompt'] = "以下是普通话的句子。"
        elif hint_lang == 'en':
            transcribe_kwargs['language'] = 'en'

        result = model.transcribe(wav_path, **transcribe_kwargs)
        segments = []
        for s in result.get('segments', []):
            seg_start = float(s.get('start', 0.0))
            seg_end = float(s.get('end', 0.0))
            seg = {
                'start': seg_start,
                'end': seg_end,
                'text': s.get('text', ''),
                'words': [
                    {'start': float(w.get('start', seg_start)),
                     'end': float(w.get('end', seg_end)),
                     'word': w.get('word', '')}
                    for w in (s.get('words') or [])
                ],
            }
            segments.append(seg)
        text = result.get('text', '').strip()
        return (text, segments)
    except Exception as e:
        logger.warning(f"v1.0.61 verify: whisper transcribe failed: {e}")
        return None
    finally:
        if os.path.exists(wav_path):
            os.unlink(wav_path)


def _has_abnormal_repetition(t_stream: str, expected: str) -> bool:
    """检测转录文本中的异常复读（相邻重复 n-gram）

    只检测紧挨着的重复（[A][A] 或 [A][A][A]），且该重复模式在原文中不存在。
    正常文本中的合法重复（如"很好很好"在原文里有）不会误判。
    """
    n = len(t_stream)
    if n < 6:
        return False
    max_len = min(40, n // 2)
    # v1.0.62: 从 L=2 开始检测 — 用户的复读词全是 2 字词（"得了""以前""当时"），
    # L=3 起检会漏掉 "得了得了得了" 这种最高频的复读模式
    for L in range(2, max_len + 1):
        i = 0
        while i + 2 * L <= n:
            unit = t_stream[i:i + L]
            if unit == t_stream[i + L:i + 2 * L]:
                # 统计连续重复轮数
                k = 2
                while i + (k + 1) * L <= n and unit == t_stream[i + k * L:i + (k + 1) * L]:
                    k += 1
                # 原文中不存在这种翻倍模式 → 异常复读
                if unit * 2 not in expected:
                    logger.warning(
                        f"v1.0.61 verify: abnormal repetition detected: "
                        f"'{unit}' x{k} at pos {i} (not present in script)")
                    return True
                i += k * L
            else:
                i += 1
    return False


def _verify_and_fix_synthesis(output_path: str, text: str, speed: float = 1.15, allow_trim: bool = True, _depth: int = 0, loose: bool = False) -> bool:
    # loose=True 时用更宽容的门限（减少 Whisper 误判吞字造成的"整块漏读"）。
    # 物理时长门禁（检查 0 / 0b）始终保持严格，大段漏读不会被放行。
    """v1.0.71: 音频时长硬门禁 + Whisper 闭环校验 + 裁剪后复验

    漏读终极防线（v1.0.71 新增第三重保护）：
      0. 音频时长硬门禁：若音频时长远小于预期（文本长度/语速），直接判定漏读 → 失败。
      0b. Whisper 幻觉速率检测：transcript 字数/音频时长超过人类朗读极限
          → transcript 不可信（Whisper 脑补了没读的内容）→ 只信任时长门禁。
      0c. 裁剪后复验：发生头/尾裁剪后，对裁剪结果重新转写校验一次。
          根因（v1.0.71 实测日志抓到）：Whisper 幻觉在 transcript 尾部多"听出"
          61 字 → 裁剪逻辑判定"尾部复读"→ 把真实朗读内容裁掉 12.5s → 漏读。
          裁剪本身成了漏读来源！现在裁剪必须通过复验才放行。

    检测四类问题：
      1. 漏读（覆盖不足 / 连续缺失短语）→ 返回 False，上层重试链拆分重合成
      2. 中间复读（相邻重复 n-gram 且原文无此重复）→ 返回 False，重试
      3. 头部/尾部幻觉（instruct 指令被读出、复读、拖尾）→ 原地精准裁剪 + 复验

    Returns:
        True  — 音频正常（或已原地裁剪掉头/尾多余内容且复验通过）
        False — 音频漏读/中间复读/异常，调用方应重试合成
    """
    if not _VERIFY_ENABLED:
        return True

    expected = _norm_verify_text(text)
    if len(expected) < 4:
        return True  # 文本太短（<4字），ASR 噪声大，跳过校验

    # ── v1.0.69: 检查 0 — 音频时长硬门禁（Whisper 幻觉的最后防线） ──
    # 根因：Whisper 模型对 TTS 合成音频有时会"听出"实际没说的内容
    #   （语言模型预测），导致漏读音频被误判为"完整"。
    #   音频时长不受 ASR 影响，是绝对的物理指标：如果音频时长明显短于预期，
    #   一定存在漏读。
    #
    # v1.0.71 修复：语速基准从 3.5 提至 5.0 字/秒（真实最快朗读语速）
    #   v1.0.69 用 3.5 字/s 估算 expected_min 偏大 → 70% 阈值实际拦截线过低，
    #   213 字实测案例：音频 44.5s（漏读）仍高于 0.7×60.9s=42.6s → 放行。
    #   中文播音最快约 5 字/s（speed=1.0），CosyVoice2 speed=1.15 → 5.75 字/s。
    #   用 5.0 字/s 上限 + 75% 阈值：213字@1.15 → 37s×0.75=27.8s 拦截线，
    #   完整朗读（44s）安全通过，漏读一半（22s）正确拦截。
    try:
        actual_dur = _get_audio_duration(output_path)
        expected_min_dur = max(len(expected) / (5.0 * max(speed, 0.5)), 0.8)
        if actual_dur < expected_min_dur * 0.75:
            logger.warning(
                f"v1.0.71 verify: AUDIO TOO SHORT — actual={actual_dur:.1f}s, "
                f"expected_min={expected_min_dur:.1f}s, threshold={expected_min_dur * 0.75:.1f}s, "
                f"text='{text[:30]}...' -> retry")
            return False
    except Exception as e:
        logger.warning(f"v1.0.71 verify: duration check failed: {e}")

    hint = _detect_text_language(text)
    result = _transcribe_with_segments(output_path, hint_lang=hint)
    if result is None:
        # Whisper 完全不可用 → 不阻塞合成（降级为无校验模式）
        logger.warning("v1.0.61 verify: ASR unavailable, skipping verification (degraded mode)")
        return True

    full_text, segments = result
    if not segments:
        logger.warning("v1.0.61 verify: no speech segments detected, treating as failure")
        return False

    # 构建"归一化字符流 → (起始时间, 结束时间)"映射（词级，降级到段级）
    char_times: list[tuple[float, float]] = []
    char_list: list[str] = []
    for seg in segments:
        words = seg['words']
        if words:
            for w in words:
                w_norm = _norm_verify_text(w['word'])
                for _ in w_norm:
                    char_times.append((w['start'], w['end']))
                char_list.append(w_norm)
        else:
            seg_norm = _norm_verify_text(seg['text'])
            for _ in seg_norm:
                char_times.append((seg['start'], seg['end']))
            char_list.append(seg_norm)
    t_stream = ''.join(char_list)

    if not t_stream:
        logger.warning("v1.0.61 verify: transcription empty, treating as failure")
        return False

    # ── v1.0.71: 检查 0b — Whisper 幻觉速率检测 ──
    # 原理：人类朗读有物理速度上限（中文 ≈ 6.5字/s，含 speed 加速）。
    #   transcript 字数 / 音频时长 超过上限 → Whisper 把"没读的内容"脑补进了
    #   transcript（幻觉）→ coverage/recall/gap 全部指标不可信。
    #   实测案例：213字文本 44.5s 音频，transcript 却有 273 字（6.1字/s 越限）
    #   → 幻觉多出的"尾部内容"引发误裁剪 → 真实内容被切 → 漏读。
    #   此时只信任物理时长：用严格门禁（0.85）判定，不采信 transcript。
    try:
        actual_dur_2 = _get_audio_duration(output_path)
        char_rate = len(t_stream) / max(actual_dur_2, 0.1)
        lang_hint_rate = 6.5 if hint in ('zh', None) else 16.0  # 英文按字符计放宽
        if char_rate > lang_hint_rate:
            strict_min = max(len(expected) / (5.0 * max(speed, 0.5)), 0.8)
            if actual_dur_2 < strict_min * 0.85:
                logger.warning(
                    f"v1.0.71 verify: WHISPER HALLUCINATION suspected "
                    f"(rate={char_rate:.1f}chars/s > {lang_hint_rate}, transcript={len(t_stream)}chars) "
                    f"AND duration {actual_dur_2:.1f}s < {strict_min * 0.85:.1f}s -> retry")
                return False
            logger.info(
                f"v1.0.71 verify: transcript rate {char_rate:.1f}chars/s suspicious but duration OK "
                f"({actual_dur_2:.1f}s >= {strict_min * 0.85:.1f}s), proceeding with caution")
    except Exception as e:
        logger.warning(f"v1.0.71 verify: hallucination rate check failed: {e}")

    import difflib
    # v1.0.73: 数字块归一化后比对（coverage/gap/recall 三指标统一）。
    # 根因：合成文本的数字已转中文读音（"二零二五年""百分之十"），但 Whisper
    #   转写可能输出阿拉伯数字（"2025年""10%"）→ coverage/max_delete_gap 把
    #   正确朗读误判为漏读 → zero_shot×6 + instruct2 全部"失败" → 降级
    #   Edge TTS → 克隆音色中混入系统音色（用户反馈的直接原因）。
    # 方案（v1.0.73b 扩充）：以下形态统一替换为单个 '#' 占位符：
    #   - 百分之X / 百分之10 / 百分之3.5 / X%（含 % 本身，防"百分之十"vs"10%"错配）
    #   - 阿拉伯数字（可带小数点/%）："2025" "3.5"
    #   - 中文数字串（≥2字）："二零二五" "十二点五"（"一个"这类单字词不受影响）
    #   - 英文数字词连串（_norm_verify_text 已去空格）："fifteenpercent" ↔ "15%"
    #   数字整段没读时 expected 的 '#' 在 transcript 中缺失，仍会拉低全部指标
    #   → 真漏读照常拦截。
    # 同时构建"vm 索引 → t_stream 原始索引"映射（头部锚点→数字块首字符，
    #   尾部锚点→数字块末字符），供词级时间戳裁剪精确定位（vm 串长度与
    #   t_stream 不同，直接用 vm 索引取 char_times 会错位切错位置）。
    _num_pat = re.compile(
        r'百分之(?:[零一二三四五六七八九十百千万亿点两]+|[0-9]+(?:\.[0-9]+)?)+%?'      # 百分之X（中/阿混合）
        r'|[0-9]+(?:\.[0-9]+)?%?[零一二三四五六七八九十百千万亿点两]{0,2}'               # 阿拉伯数字（吸收尾部单位字："2.5万"→"#"）
        r'|[零一二三四五六七八九十百千万亿点两]+'                                       # 中文数字串（含单字："八月"↔"8月"）
        r'|(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|'
        r'thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|'
        r'thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|'
        r'billion|percent|point|half|quarter)+'                                      # 英文数字词连串
    )
    exp_vm = _num_pat.sub('#', expected)
    tr_vm_parts = []
    vm_to_orig_head = []  # vm 索引 → 原始索引（'#' 指数字块首字符，用于头部裁剪锚点）
    vm_to_orig_tail = []  # vm 索引 → 原始索引（'#' 指数字块末字符，用于尾部裁剪锚点）
    _pos = 0
    for _m in _num_pat.finditer(t_stream):
        for _k in range(_pos, _m.start()):
            tr_vm_parts.append(t_stream[_k])
            vm_to_orig_head.append(_k)
            vm_to_orig_tail.append(_k)
        tr_vm_parts.append('#')
        vm_to_orig_head.append(_m.start())
        vm_to_orig_tail.append(_m.end() - 1)
        _pos = _m.end()
    for _k in range(_pos, len(t_stream)):
        tr_vm_parts.append(t_stream[_k])
        vm_to_orig_head.append(_k)
        vm_to_orig_tail.append(_k)
    tr_vm = ''.join(tr_vm_parts)
    sm = difflib.SequenceMatcher(None, exp_vm, tr_vm, autojunk=False)
    blocks = [b for b in sm.get_matching_blocks() if b.size > 0]
    covered = sum(b.size for b in blocks)
    coverage = covered / max(len(exp_vm), 1)
    logger.info(
        f"v1.0.73 verify: script={len(expected)}chars(vm={len(exp_vm)}), "
        f"transcript={len(t_stream)}chars(vm={len(tr_vm)}), coverage={coverage:.1%}")

    # ── 检查 1：漏读（覆盖不足）→ 失败重试 ──
    # v1.0.66: 彻底修复"漏读放行"——v1.0.64 曾把阈值放宽到 0.55，导致只读出一半
    #   文案的音频也被容忍放行（用户反复反馈漏读的直接原因）。
    #   现改用双指标判定，既容忍 ASR 误听（假漏读），又绝不放行真漏读：
    #     char_recall — 字符多重集召回率：expected 与 transcript 的字符交集占比。
    #                   ASR 把字"听错"（替换）不降低召回（字数不变），只有"没读出来"
    #                   （删除/整段缺失）才降低 → 抓真漏读的可靠指标。
    #     coverage    — 序列匹配覆盖率：字符是否按顺序读出。
    #   判定规则（同时满足才算通过）：
    #     char_recall >= 0.90  （内容基本完整；20字句子漏开头2字即拦截）
    #     coverage    >= 0.75  （顺序大致正确，容忍 Whisper 插入词导致序列断裂）
    #   任一不满足 → 返回 False → 上层重试链（换采样 → 细分 → instruct2 → Edge TTS 保底）
    from collections import Counter
    expected_counter = Counter(exp_vm)
    transcript_counter = Counter(tr_vm)
    char_recall = sum((expected_counter & transcript_counter).values()) / max(len(exp_vm), 1)

    # ── v1.0.71: 连续缺失段检测（区分"真漏读"与"ASR 零散误听"的决定性指标）──
    # 根因：recall>=0.92 对 80 字块容忍漏 6 个连续字（一个完整短语，如"在全球范围内"），
    #   用户耳朵能清晰听出缺失 → v1.0.70 之前反复反馈"漏读"的直接技术漏洞。
    # 区分原理：
    #   真漏读（LLM 提前 EOS / 跳句）→ expected 中出现 >=4 个"连续"未读字符
    #   ASR 误听 → 零散 1-3 字替换/缺失（recall 不降或微降），无长连续 gap
    # 实现：SequenceMatcher.get_opcodes() 的 delete 操作（expected 有、transcript 无），
    #   取最长连续 delete 段长度 max_delete_gap：
    #     >= 4 → 真漏读，无论 recall 多高都拦截
    #     <= 3 → ASR 噪声，放行（由 recall 辅助指标兜底）
    opcodes = sm.get_opcodes()
    max_delete_gap = 0
    missing_snippet = ''
    for tag, i1, i2, j1, j2 in opcodes:
        if tag == 'delete':
            gap = i2 - i1  # expected 有、transcript 完全没有 → 真漏读
        elif tag == 'replace':
            # replace = "读出来了但 ASR 听错"（如"人工智能"→"人工智人"）
            # 与"读了一半漏一半"的混合。按 transcript 对应长度折算净缺失：
            #   净缺失 = expected 段长 - transcript 对应段长（下限 0）
            gap = max(0, (i2 - i1) - (j2 - j1))
        else:
            continue
        if gap > max_delete_gap:
            max_delete_gap = gap
            missing_snippet = exp_vm[i1:i2]  # v1.0.73: 索引基于数字归一化文本

    # ── v1.0.71 判定（三指标联防，任一不满足即重试）──
    # v1.0.74: 双门限（loose=True 用于 zero_shot 最后重试）。
    # 物理时长门禁永远严格，此处只放宽 transcript 比对，避免 Whisper 系统性
    # 漏听（如"的/了/是"、数字读法差异、同音错字）导致整块被误杀静音。
    #   严格（默认）：max_delete_gap>=4 拦截 · recall>=0.90 · coverage>=0.75
    #   宽松（loose）：max_delete_gap>=8 拦截 · recall>=0.82 · coverage>=0.68
    RECALL_TH   = 0.82 if loose else 0.90
    COV_TH      = 0.68 if loose else 0.75
    GAP_TH      = 8    if loose else 4
    if max_delete_gap >= GAP_TH:
        logger.warning(
            f"v1.0.71 verify: MISSING PHRASE detected — {max_delete_gap} consecutive chars "
            f"unread: '{missing_snippet}' (coverage={coverage:.1%}, char_recall={char_recall:.1%}) -> retry")
        return False
    if char_recall < RECALL_TH or coverage < COV_TH:
        logger.warning(
            f"v1.0.71 verify: INCOMPLETE synthesis (coverage={coverage:.1%}, "
            f"char_recall={char_recall:.1%}, max_gap={max_delete_gap}) -> retry")
        return False
    if coverage < 0.90:
        # 内容完整但序列有断裂（ASR 插词/误听）— 放行但记录
        logger.info(
            f"v1.0.70 verify: ASR mishear tolerated (coverage={coverage:.1%}, "
            f"char_recall={char_recall:.1%} — content complete, only sequence broken)")

    # ── 检查 2：中间复读 → 失败重试（无法安全裁剪）──
    # v1.0.73: 用 vm 归一化文本检测 — 防 "22.22"→"2222" 这类重复数字被误判复读；
    # 真复读（"百分之十百分之十"）在 vm 串中仍呈 "# #" 相邻重复，照常拦截
    if _has_abnormal_repetition(tr_vm, exp_vm):
        return False

    # ── 检查 3：头部/尾部幻觉 → 词级时间戳精准裁剪（仅在完整朗读后）──
    # v1.0.65: 只有当"脚本已完整朗读"（coverage >= 0.85）时才允许裁剪头/尾。
    #   Whisper 对开头/结尾的字句偶有误听，会把"真实读出的文案"当成多余字符；
    #   此时若裁剪，会把实际内容切掉 → 造成"漏掉脚本文案"。
    #   因此低覆盖率时宁可保留完整音频，也绝不裁剪。
    # v1.0.71: 复验阶段（allow_trim=False）不再裁剪 — 防止递归误裁。
    trim_start = 0.0
    trim_end = None
    if coverage >= 0.85 and allow_trim:
        # 文案首个可靠匹配锚点（块长>=2，避免单字噪声误锚定）
        anchor_blocks = [b for b in blocks if b.size >= 2] or blocks
        first_block = min(anchor_blocks, key=lambda b: b.b)
        head_extra = first_block.b  # 文案开始前，转录流里多出的字符数
        head_tolerance = max(4, int(len(exp_vm) * 0.10))
        if head_extra > head_tolerance and first_block.b < len(vm_to_orig_head):
            # 头部幻觉（典型：instruct 指令文本被读出，如"用自然流畅的语气朗读"）
            # v1.0.73: vm 索引经 vm_to_orig_head 映射回原始索引再取时间戳
            head_orig_idx = min(vm_to_orig_head[first_block.b], len(char_times) - 1)
            trim_start = max(0.0, char_times[head_orig_idx][0] - 0.10)
            logger.warning(
                f"v1.0.65 verify: HEAD HALLUCINATION detected "
                f"(extra={head_extra}chars > tolerance={head_tolerance}), "
                f"content='{t_stream[:head_orig_idx]}', trimming start to {trim_start:.2f}s")

        # 文案完整覆盖后，转录流中多余的部分 = 尾部复读或幻觉内容
        coverage_end = max((b.b + b.size) for b in blocks) if blocks else 0
        tail_extra = len(tr_vm) - coverage_end
        tail_tolerance = max(8, int(len(exp_vm) * 0.15))  # 容忍 ASR 末尾噪声
        if tail_extra > tail_tolerance and coverage_end > 0 and coverage_end <= len(vm_to_orig_tail):
            # ── v1.0.71: 裁剪物理自洽性预检 — 宁可保留复读，绝不误裁真实内容 ──
            # 两个实测案例的特征几乎相同（尾部"多余"50-60字），无法用内容相似度区分：
            #   案例A（误裁）：Whisper 幻觉多听 61 字 → 裁剪切掉 12.5s 真实内容 → 漏读
            #   案例B（真复读）：音频尾部真有 15s 复读 → 应该裁
            # 区分它们的决定性指标 = 裁剪后时长能否容下正文的最小朗读时间：
            #   正文最小时间 = len(expected) / (5.0字/s × speed)
            #   裁剪后时长 >= 最小时间×0.95 → 裁掉的部分物理上"装不下"正文 → 一定是
            #     多余内容 → 安全裁剪 + 复验
            #   裁剪后时长 < 最小时间×0.95 → 若真裁了，正文就装不下 → 必然误裁 →
            #     保留完整音频（用户听到复读也远好于漏读，复读交由重试链优化）
            # v1.0.73: vm 索引经 vm_to_orig_tail 映射（'#'→数字块末字符时间戳，
            #   宁晚勿早，防止把数字朗读的尾音裁掉）
            tail_orig_idx = min(vm_to_orig_tail[coverage_end - 1], len(char_times) - 1)
            proposed_end = char_times[tail_orig_idx][1] + 0.05
            try:
                body_min_dur = max(len(expected) / (5.0 * max(speed, 0.5)), 1.0)
                kept_after_trim = proposed_end - trim_start
                if kept_after_trim >= body_min_dur * 0.95:
                    trim_end = proposed_end
                    logger.warning(
                        f"v1.0.71 verify: TAIL REPETITION detected "
                        f"(extra={tail_extra}chars, kept={kept_after_trim:.1f}s >= "
                        f"body_min={body_min_dur:.1f}s) — safe to trim end to {trim_end:.2f}s")
                else:
                    logger.warning(
                        f"v1.0.71 verify: tail extra {tail_extra}chars but trim unsafe "
                        f"(kept={kept_after_trim:.1f}s < body_min={body_min_dur:.1f}s) — "
                        f"KEEPING full audio (repetition tolerated, missing content NOT)")
            except Exception as trim_check_err:
                # 时间戳异常时保守处理：不裁剪，保留完整音频
                logger.warning(f"v1.0.71 verify: trim safety check failed: {trim_check_err}, keeping full audio")

    # ── 执行裁剪（头部或尾部任一需要）──
    data, sr = sf.read(output_path)
    if data.ndim > 1:
        data = data.mean(axis=1)
    total_dur = len(data) / sr
    if trim_end is None:
        trim_end = total_dur
    if trim_start > 0.0 or trim_end < total_dur:
        expected_dur = max(len(expected) / (5.0 * max(speed, 0.5)), 1.0)
        new_dur = trim_end - trim_start
        if new_dur < expected_dur * 0.75 or new_dur <= 0:
            # 裁剪后时长异常（裁掉太多）→ 失败重试
            logger.warning(
                f"v1.0.71 verify: trim result abnormal (kept={new_dur:.1f}s, "
                f"expected_min={expected_dur * 0.75:.1f}s) -> retry")
            return False
        start_sample = int(trim_start * sr)
        end_sample = min(int(trim_end * sr), len(data))
        trimmed = data[start_sample:end_sample].copy()
        # 首尾淡入淡出 10ms，避免裁剪爆音
        fade = min(int(0.01 * sr), len(trimmed) // 4)
        if fade > 0:
            trimmed[:fade] *= np.linspace(0, 1, fade)
            trimmed[-fade:] *= np.linspace(1, 0, fade)
        sf.write(output_path, trimmed.astype(np.float32), sr, subtype='PCM_16')
        logger.info(
            f"v1.0.61 verify: trimmed audio {total_dur:.2f}s -> {new_dur:.2f}s "
            f"(head={trim_start:.2f}s, tail={total_dur - trim_end:.2f}s removed)")
        # ── v1.0.71: 裁剪后复验 — 防止误裁真实内容 ──
        # 裁剪本身就是潜在的漏读来源（误裁 12.5s 真实内容案例）。
        # 对裁剪后的音频重新转写校验一次（allow_trim=False 防递归），
        # 复验通过才放行；复验失败 → 整体失败 → 上层重试链换采样重合成。
        if _depth == 0:
            recheck = _verify_and_fix_synthesis(output_path, text, speed=speed, allow_trim=False, _depth=1)
            if not recheck:
                logger.warning(
                    f"v1.0.71 verify: POST-TRIM RECHECK FAILED — trim likely cut real content -> retry")
                return False
            logger.info("v1.0.71 verify: post-trim recheck passed")
    return True


# ═══════════════════════════════════════════════════════════════
# v1.0.65: 逐句合成 + 逐句校验，保证完整朗读脚本文案
# ═══════════════════════════════════════════════════════════════

# v1.0.73: 句点/逗号后跟数字时不切分 — 保护小数（3.5万）与千分位（1,234）
# 不被拦腰截断（分句发生在数字规范化之前，此处仍是原始阿拉伯数字文本）
_SENT_SPLIT_RE = re.compile(r'(?<=[。！？!?；;])|(?<=\.)(?!\d)')
_SUB_SPLIT_RE = re.compile(r'(?<=[，、；;])|(?<=,)(?!\d)')


def _split_script_pieces(text, max_len=28):
    """把文本切成句子级小块（优先整句，长句按子句细分到 <= max_len 字符）。

    v1.0.67: 默认 max_len 45 → 28。块越短，zero_shot 的 LLM 越不容易提前输出
    EOS 截断（漏读根因），完整朗读成功率越高。细分重试用更小的 max_len(16)。
    返回去除空白后的文本块列表。
    """
    sentences = [s for s in _SENT_SPLIT_RE.split(text.strip()) if s.strip()]
    if not sentences:
        sentences = [text.strip()]
    pieces = []
    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        if len(sent) <= max_len:
            pieces.append(sent)
            continue
        # 长句按子句细分
        subs = [x for x in _SUB_SPLIT_RE.split(sent) if x.strip()]
        buf = ""
        for sub in subs:
            if len(buf) + len(sub) > max_len and buf:
                pieces.append(buf)
                buf = sub
            else:
                buf += sub
        if buf.strip():
            pieces.append(buf)
    return [p for p in pieces if p]


def _merge_wav_paths(paths, out_path, target_sr=44100):
    """顺序拼接多个 wav 文件（统一采样率）"""
    arrays = []
    for p in paths:
        if not os.path.exists(p):
            continue
        d, sr = sf.read(p)
        if d.ndim > 1:
            d = d.mean(axis=1)
        if sr != target_sr:
            from scipy.signal import resample_poly
            from math import gcd
            g = gcd(target_sr, sr)
            d = resample_poly(d, target_sr // g, sr // g)
        arrays.append(d)
    if not arrays:
        return False
    combined = np.concatenate(arrays)
    sf.write(out_path, combined.astype(np.float32), target_sr, subtype='PCM_16')
    return True


def _synthesize_piece(text_piece, out_path, meta, speed=1.0, depth=0):
    """保证单个文本块完整朗读的深重试（v1.0.69）：

    策略层级（从最优到保底）：
      1) zero_shot ×6 随机采样重试（音色最接近原声，韵律最自然）
      2) 细分递归到 depth<3，拆到 16 字以内子句分别 zero_shot 合成后拼接
      3) instruct2 降级：zero_shot 全部失败时用 instruct2 模式（同模型同音色，
         只是不复制参考音频的说话风格，LLM 自由发挥 → 稳定但韵律稍弱）

    v1.0.73 修复"克隆音色混入系统音色"：
      - 移除第 4 层 Edge TTS 保底（v1.0.69 引入）。本函数只服务克隆音色播客，
        Edge TTS 音色与克隆音色完全不同 → 每次触发都会在成片中混入系统音色
        （用户反馈"选择克隆音色但混入系统声音"的直接来源之一）。
        与 v1.0.64 段落级守卫（克隆失败→静音占位而非换音色）保持一致。
        误判漏读的根源已由 v1.0.73 vm 归一化比对修复（数字形态差异不再
        触发降级），真正失败时由上层 segment_failed 事件 + 静音占位兜底。

    返回 True 表示该块音频已写入 out_path 并通过校验。
    """
    # 第 1 层：zero_shot ×6 + Whisper 双指标校验
    # （每次失败都清掉残留的漏读音频，再换随机采样重试）
    # v1.0.74: 最后两次（attempt=4,5）用宽松门限，避免 Whisper 系统性
    #   误听（数字读法、同音错字）导致整块误杀（用户反馈"漏文本"）。
    for attempt in range(6):
        loose = attempt >= 4
        if synthesize_audio(text_piece, out_path, meta, strict_clone=True, speed=speed, loose_verify=loose):
            return True
        if os.path.exists(out_path):
            try:
                os.remove(out_path)
            except OSError:
                pass
        time.sleep(0.8)
        logger.warning(f"v1.0.74 piece: zero_shot attempt {attempt + 1}/6 failed for '{text_piece[:24]}...' (loose={loose})")

    # 第 2 层：细分重试 — 拆到 <=20 字子句，逐个子句走本函数后拼接
    # v1.0.74: 16→20，避免过度碎片化导致的机械拼接感
    if depth < 3 and len(text_piece) > 8:
        sub_pieces = _split_script_pieces(text_piece, max_len=20)
        if len(sub_pieces) > 1:
            sub_paths = []
            ok = True
            for i, sp in enumerate(sub_pieces):
                sp_path = f"{out_path}_s{i}.wav"
                if _synthesize_piece(sp, sp_path, meta, speed=speed, depth=depth + 1):
                    sub_paths.append(sp_path)
                else:
                    ok = False
                    break
            if ok and sub_paths and _merge_wav_paths(sub_paths, out_path):
                for p in sub_paths:
                    if os.path.exists(p):
                        os.remove(p)
                return True
            for p in sub_paths:
                if os.path.exists(p):
                    os.remove(p)

    # 第 3 层：instruct2 降级 — zero_shot 全部失败时，用 instruct2 模式
    # （同 CosyVoice2 模型、同音色，但不复制参考音频说话风格，LLM 自由发挥）
    if depth == 0:
        logger.warning(
            f"v1.0.74 piece: zero_shot 6x + sub-split all failed for "
            f"'{text_piece[:24]}...', falling back to instruct2 (same model, same voice, loose verify)")
        if synthesize_audio(text_piece, out_path, meta, strict_clone=False, speed=speed, loose_verify=True):
            logger.info(f"v1.0.74 piece: instruct2 fallback succeeded for '{text_piece[:24]}...'")
            return True

    # 第 4 层（v1.0.74 新增）：最后防线 — 拆成 10 字左右极小句，
    #   逐句 instruct2(non-strict, loose) 合成后拼接。
    #   块越小，CosyVoice2 越不容易提前 EOS，保证"不漏字"是第一优先级；
    #   音色仍是同模型克隆音，不会混入 Edge TTS 系统音色。
    if depth == 0 and len(text_piece) > 4:
        logger.warning(f"v1.0.74 piece: instruct2 also failed, trying FINAL FALLBACK: ultra-short split (max_len=10) for '{text_piece[:24]}...'")
        last_pieces = _split_script_pieces(text_piece, max_len=10)
        if len(last_pieces) >= 1:
            last_paths = []
            final_ok = True
            for i, lp in enumerate(last_pieces):
                lpath = f"{out_path}_L{i}.wav"
                if synthesize_audio(lp, lpath, meta, strict_clone=False, speed=speed, loose_verify=True):
                    last_paths.append(lpath)
                else:
                    # 单个极小句都失败时，写 0.15s 静音不让拼接中断
                    try:
                        silent = np.zeros(int(44100 * 0.15), dtype=np.float32)
                        sf.write(lpath, silent, 44100, subtype='PCM_16')
                        last_paths.append(lpath)
                    except Exception:
                        final_ok = False
                        break
            if final_ok and last_paths:
                if _merge_wav_paths(last_paths, out_path):
                    for lp in last_paths:
                        try: os.remove(lp)
                        except OSError: pass
                    logger.info(f"v1.0.74 piece: FINAL FALLBACK succeeded (ultra-short split into {len(last_pieces)} pieces) for '{text_piece[:24]}...'")
                    return True
            for lp in last_paths:
                try: os.remove(lp)
                except OSError: pass

    # 全部策略失败：清理残留，返回失败
    # （上层段落级会用静音占位并上报 segment_failed，绝不注入 Edge TTS 音色）
    if os.path.exists(out_path):
        try:
            os.remove(out_path)
        except OSError:
            pass
    logger.error(f"v1.0.74 piece: ALL clone strategies failed for '{text_piece[:24]}...', skipping (no Edge TTS — voice consistency)")
    return False


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
            # 打包环境：CosyVoice 源码在 APP_DIR/CosyVoice
            # 开发环境：CosyVoice 源码在 __file__/../CosyVoice
            cosyvoice_root = str(APP_DIR / "CosyVoice")
            if not os.path.exists(cosyvoice_root) and not getattr(sys, 'frozen', False):
                cosyvoice_root = str(Path(__file__).parent / "CosyVoice")
            if cosyvoice_root not in sys.path:
                sys.path.insert(0, cosyvoice_root)
            # v1.0.50: 同时将 third_party/Matcha-TTS 加入 sys.path
            # cosyvoice.hifigan / cosyvoice.flow.decoder / cosyvoice.flow.flow_matching
            # 依赖 matcha 包，该包以源码形式打包在 CosyVoice/third_party/Matcha-TTS
            for extra_path in [
                APP_DIR / "CosyVoice" / "third_party" / "Matcha-TTS",
                Path(__file__).parent / "CosyVoice" / "third_party" / "Matcha-TTS",
            ]:
                if extra_path.exists() and str(extra_path) not in sys.path:
                    sys.path.insert(0, str(extra_path))
                    logger.info(f"v1.0.50: Added {extra_path} to sys.path for matcha dependency")
            from cosyvoice.cli.cosyvoice import CosyVoice2
            model_dir = str(MODEL_DIR)
            # v1.0.41: 关键修复 — 在 Apple Silicon (M1/M2/M3) 上强制使用 CPU 而非 MPS
            # 原因：CosyVoice2 的 model.py 中 llm_job 在子线程中运行 PyTorch 推理，
            # 而 MPS + 多线程会导致"静默失败"——返回全零张量（静音音频），
            # 不报任何异常，但合成的音频完全没有声音。
            # CPU 模式虽然较慢，但推理结果可靠，不会出现静音问题。
            if torch.cuda.is_available():
                _cosyvoice_device = "cuda"
            else:
                # macOS Apple Silicon: 强制 CPU，避免 MPS 多线程静默失败
                _cosyvoice_device = "cpu"
                # 禁用 MPS，确保 CosyVoice2 内部使用 CPU
                if hasattr(torch.backends, 'mps'):
                    torch.backends.mps.is_available = lambda: False
                    torch.backends.mps.is_built = lambda: False
                logger.info("v1.0.41: Forcing CPU mode on macOS to avoid MPS multi-thread silent failure")
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

        # ── v1.0.71: 智能选段 — 挑"最有表现力"的 8 秒，而非固定开头 ──
        # 根因：zero_shot 模式下 LLM 完整复制参考音频的音色+韵律+说话风格。
        #   固定取开头 8 秒：若开头是平淡陈述（低能量、无起伏），合成全程都是
        #   "死板朗读"。选 RMS 高且稳定的段落（说话有力、情绪饱满），
        #   合成自然带真实播客的抑扬顿挫 — 这是自然度的源头治理。
        #   同时保留 v1.0.70 的开头静音剥离（防"开口前停顿"习惯学习）。
        best_start = 0.0
        try:
            best_start = _find_best_segment_start(ref_audio_path, duration, target_duration=max_sec)
        except Exception as sel_err:
            logger.warning(f"v1.0.71 best-segment selection failed, fallback to head: {sel_err}")
            best_start = 0.0

        if best_start > 0.5:
            # 选中片段：高能量稳定段（说话有力），无需再剥静音
            cmd = ["ffmpeg", "-y", "-ss", f"{best_start:.2f}", "-i", ref_audio_path,
                   "-t", str(max_sec), "-ar", "32000", "-ac", "1", "-sample_fmt", "s16", truncated_path]
            logger.info(f"v1.0.71: selected expressive segment @ {best_start:.1f}s of {duration:.1f}s")
        else:
            # 从头截取：剥离开头静音（保留 0.3s 起始缓冲），充分利用提示预算
            cmd = ["ffmpeg", "-y", "-i", ref_audio_path,
                   "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.3",
                   "-t", str(max_sec), "-ar", "32000", "-ac", "1", "-sample_fmt", "s16", truncated_path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if result.returncode == 0 and os.path.exists(truncated_path) and os.path.getsize(truncated_path) > 1000:
            logger.info(f"Reference audio truncated: {duration:.1f}s -> {max_sec}s @ {best_start:.1f}s ({truncated_path})")
            return truncated_path
        logger.warning(f"Failed to truncate ref audio: {result.stderr[:200]}")
        return ref_audio_path
    except Exception as e:
        logger.warning(f"ref audio truncation error: {e}")
        return ref_audio_path


# v1.0.46: 常见口头禅和复读词列表（大幅扩展）
# CosyVoice2 会模仿 ref_text 中的语言习惯，这些词如果出现在 ref_text 中，
# 合成结果会频繁复读，导致播客音频中反复出现"得了"、"可不"、"对吧"等无意义词语


def _get_aligned_ref_text(clone_id: Optional[str], truncated_audio_path: str, full_ref_text: str, audio_duration: float = 0.0) -> str:
    """v1.0.63: 获取与截断后参考音频严格对齐的 ref_text

    zero_shot 模式要求 prompt_text 是 prompt_wav 的准确转录（文本-音频对齐）。
    full_ref_text 是完整音频的转录，而合成用的是 8 秒截断音频 —
    两者不匹配会让 LLM 困惑，导致音色失真、韵律漂移（"声音听起来不像原声"的根因之一）。

    策略：
      1. 音频未截断（<=8s）→ full_ref_text 本身就对齐，直接返回
      2. 命中 clone 元数据缓存（ref_text_aligned）→ 直接返回
      3. 对截断音频做 Whisper ASR → 得到对齐文本 → 写入缓存（克隆不可变，缓存安全）
      4. ASR 失败 → 按时长比例截断 full_ref_text（保底对齐）
    """
    # 音频本来就没超过 8 秒：完整转录就是对齐的
    if audio_duration > 0 and audio_duration <= 8.5:
        return full_ref_text

    # 命中缓存（v1.0.71: 键名升级 v3 — 截取逻辑改为智能选段（最有表现力的8秒），
    #   旧缓存对应的音频片段已变化，作废重算）
    if clone_id and clone_id in _clone_store:
        cached = _clone_store[clone_id].get("ref_text_aligned_v3")
        if cached and cached.strip():
            return cached

    # ASR 转录截断后的音频（8 秒音频转录很快）
    try:
        aligned = _transcribe_audio(truncated_audio_path, language=None)
        if aligned and len(aligned.strip()) >= 4:
            aligned = aligned.strip()
            if clone_id and clone_id in _clone_store:
                try:
                    _clone_store[clone_id]["ref_text_aligned_v3"] = aligned
                    _save_clones()
                except Exception as cache_err:
                    logger.warning(f"v1.0.63: cache aligned ref_text failed: {cache_err}")
            logger.info(f"v1.0.63: aligned ref_text via ASR ({len(aligned)} chars): '{aligned[:50]}'")
            return aligned
        logger.warning(f"v1.0.63: aligned ASR too short: '{aligned}'")
    except Exception as e:
        logger.warning(f"v1.0.63: aligned ref_text ASR failed: {e}")

    # 保底：按时长比例截断 full_ref_text（8s / 完整时长 ≈ 文本保留比例）
    if full_ref_text and audio_duration > 8.5:
        ratio = 8.0 / audio_duration
        keep_chars = max(10, int(len(full_ref_text) * ratio))
        truncated = _truncate_ref_text_by_sentence(full_ref_text, max_chars=keep_chars)
        if truncated and truncated.strip():
            logger.info(f"v1.0.63: aligned ref_text via proportional truncation ({len(truncated)} chars): '{truncated[:50]}'")
            return truncated
    return full_ref_text
# v1.0.42 仅覆盖 15 个 pattern，"得了"等漏网导致 v1.0.45 仍出现复读
# v1.0.46 扩展到 40+ pattern，覆盖所有常见中文口头禅/语气词
_FILLER_WORDS_PATTERNS = [
    # v1.0.42 原有
    r'可不[是说]?',          # "可不"、"可不是"、"可不说"
    r'对吧[啊呀]?',         # "对吧"、"对吧啊"
    r'那个[个啊呀]?',       # "那个"、"那个啊"
    r'就是[说啊呀]?',       # "就是"、"就是说"
    r'然后[后啊]?',         # "然后"、"然后啊"
    r'其实[是啊]?',         # "其实"、"其实是"
    r'反正[是正]?',         # "反正"
    r'怎么说[说呢]?',       # "怎么说"、"怎么说呢"
    r'嗯[嗯啊]+',           # "嗯"、"嗯嗯"
    r'啊[啊呀]+',           # "啊"、"啊啊"
    r'呃[呃啊]+',           # "呃"、"呃呃"
    r'你知道[道吧]?',       # "你知道"、"你知道吧"
    r'对对[对]+',           # "对对"、"对对对"
    r'是是[是]+',           # "是是"、"是是是"
    r'好好[好]+',           # "好好"、"好好好"
    # v1.0.46 新增 — 句末语气词/口头禅（最容易导致每句末尾复读）
    r'得了[了啊]?',         # "得了"、"得了啊" ← 本次问题的元凶
    r'行了[了啊]?',         # "行了"、"行了啊"
    r'算了[了啊]?',         # "算了"、"算了啊"
    r'罢了[了啊]?',         # "罢了"
    r'好了[了啊]+',         # "好了"、"好了好了"
    r'完了[了啊]+',         # "完了"、"完了完了"
    r'是吧[吧啊]?',         # "是吧"、"是吧啊"
    r'嘛[嘛啊]+',           # "嘛"、"嘛嘛"
    r'呗[呗啊]+',           # "呗"
    r'你看[看吧]?',         # "你看"、"你看吧"
    r'我说[说啊]?',         # "我说"、"我说啊"
    r'他说[说啊]?',         # "他说"、"他说啊"
    r'不是吗[吗啊]?',       # "不是吗"
    r'对不对[对啊]?',       # "对不对"
    r'是不是[是啊]?',       # "是不是"
    r'然后呢[呢啊]?',       # "然后呢"
    r'所以呢[呢啊]?',       # "所以呢"
    r'之类的[了的]?',       # "之类的"
    r'什么的[么的]?',       # "什么的"
    r'什么的呀',            # "什么的呀"
    r'这样吧[吧啊]?',       # "这样吧"
    r'那样吧[吧啊]?',       # "那样吧"
    r'的话[话啊]?',         # "的话"
    r'哦[哦啊]+',           # "哦"、"哦哦"
    r'唉[唉啊]+',           # "唉"
    r'嘿[嘿啊]+',           # "嘿"
    r'嚯[嚯啊]+',           # "嚯"
    r'哎[哎啊]+',           # "哎"、"哎哎"
    r'得了吧[吧啊]?',       # "得了吧"
    r'行了吧[吧啊]?',       # "行了吧"
    r'算了吧[吧啊]?',       # "算了吧"
]

def _clean_ref_text_for_synthesis(ref_text: str) -> str:
    """v1.0.54: 彻底清理 ref_text 中的所有口头禅 + 所有时间词（不替换，直接删除）

    教训回顾（v1.0.42→v1.0.53 修复链）：
      - v1.0.42: 只清理 15 个口头禅 → "得了"漏网 → 复读
      - v1.0.46: 扩展到 40+ 口头禅 → 仍有漏网
      - v1.0.51: "以前"→"当时"同义词替换 → "当时"又成新复读词！
      - v1.0.52: ref_text 也开始替换 → 没用，zero_shot 从声学特征也能学
      - 结论：同义词替换是"打地鼠"，替换一个就冒一个新的。
              ref_text 本身就不应该包含任何口头禅/时间词，直接删除最干净。

    v1.0.54 方案：
      - 删除 ALL 高频时间词（以前/当时/之前/之后/后来/过去/曾经...）
      - 删除 ALL 40+ 口头禅模式
      - 删除"这个/那个/然后/其实/就是/反正"等连词语气词（ref_text 不需要语义通顺，
        只要给模型正确的语音-文本对齐参考就行，清空更安全）
    """
    if not ref_text:
        return ref_text
    cleaned = ref_text
    # v1.0.54: 彻底删除所有高频时间词（不替换！替换=制造新复读词）
    _time_word_patterns = [
        r'以前[啊呀呢吧嘛]?',
        r'当时[啊呀呢吧嘛]?',
        r'从前[啊呀呢吧嘛]?',
        r'当年[啊呀呢吧嘛]?',
        r'那时候[啊呀呢吧嘛]?',
        r'此前[啊呀呢吧嘛]?',
        r'之后[啊呀呢吧嘛]?',
        r'后来[啊呀呢吧嘛]?',
        r'过去[啊呀呢吧嘛]?',
        r'曾经[啊呀呢吧嘛]?',
        r'之前[啊呀呢吧嘛]?',
        r'以往[啊呀呢吧嘛]?',
        r'今后[啊呀呢吧嘛]?',
        r'将来[啊呀呢吧嘛]?',
        r'现在[啊呀呢吧嘛]?',
        r'此刻[啊呀呢吧嘛]?',
        r'目前[啊呀呢吧嘛]?',
    ]
    for p in _time_word_patterns:
        cleaned = re.sub(p, '', cleaned)
    # 直接删除 40+ 口头禅
    for pattern in _FILLER_WORDS_PATTERNS:
        cleaned = re.sub(pattern, '', cleaned)
    # v1.0.54: ref_text 额外删除连词/语气词（ref_text 不需要这些）
    _ref_extra_remove = [
        r'然后[啊呀呢吧嘛]?',
        r'其实[啊呀呢吧嘛]?',
        r'就是[啊呀呢吧嘛]?',
        r'反正[啊呀呢吧嘛]?',
        r'这个[啊呀呢吧嘛]?',
        r'那个[啊呀呢吧嘛]?',
        r'怎么[啊呀呢吧嘛]?',
        r'什么[啊呀呢吧嘛]?',
        r'所以[啊呀呢吧嘛]?',
        r'但是[啊呀呢吧嘛]?',
        r'而且[啊呀呢吧嘛]?',
        r'因为[啊呀呢吧嘛]?',
        r'所以说[啊呀呢吧嘛]?',
    ]
    for p in _ref_extra_remove:
        cleaned = re.sub(p, '', cleaned)
    # 清理多余的标点和空格
    cleaned = re.sub(r'[，,]\s*[，,]', '，', cleaned)
    cleaned = re.sub(r'\s+', '', cleaned)
    cleaned = cleaned.strip('，。！？.,!? ')
    if cleaned != ref_text:
        logger.info(f"v1.0.54: Cleaned ref_text (AGRESSIVE REMOVE ALL FILLER+TIME): '{ref_text[:60]}' -> '{cleaned[:60]}'")
    return cleaned


def _clean_tts_text_for_synthesis(text: str) -> str:
    """v1.0.54: 清理 tts_text — 彻底删除复读词 + 时间词（不再替换）

    教训：v1.0.51 把"以前"→"当时"，结果"当时"又成新复读词。
          替换策略是"打地鼠"，直接删除更彻底。

    语义影响：删除这些词确实会让句子略微不连贯，但播客脚本是 LLM 生成的，
    LLM 会用完整句式表达，删除这些时间词后句子仍然通顺（如"当时我们做了这个"
    → "我们做了这个"，意思不变）。相比"当时当时当时"的复读，这是可接受的折中。
    """
    if not text:
        return text
    # v1.0.54: tts_text 彻底删除 — 所有高频时间词 + 所有口头禅 + 重复词
    _tts_remove_patterns = [
        # ── 高频时间词（这些是用户反馈的"当时""以前"的直接来源）──
        r'以前[啊呀呢吧嘛]?',
        r'当时[啊呀呢吧嘛]?',
        r'从前[啊呀呢吧嘛]?',
        r'当年[啊呀呢吧嘛]?',
        r'那时候[啊呀呢吧嘛]?',
        r'此前[啊呀呢吧嘛]?',
        r'之后[啊呀呢吧嘛]?',
        r'后来[啊呀呢吧嘛]?',
        r'过去[啊呀呢吧嘛]?',
        r'曾经[啊呀呢吧嘛]?',
        r'之前[啊呀呢吧嘛]?',
        r'以往[啊呀呢吧嘛]?',
        # ── 口头禅 ──
        (r'得了[了啊]?'),
        (r'行了[了啊]?'),
        (r'算了[了啊]?'),
        (r'罢了[了啊]?'),
        (r'得了吧[吧啊]?'),
        (r'行了吧[吧啊]?'),
        (r'算了吧[吧啊]?'),
        (r'嗯[嗯啊]+'),
        (r'啊[啊呀]+'),
        (r'呃[呃啊]+'),
        (r'哦[哦啊]+'),
        (r'唉[唉啊]+'),
        (r'嘿[嘿啊]+'),
        (r'嚯[嚯啊]+'),
        (r'哎[哎啊]+'),
        (r'对对[对]+'),
        (r'是是[是]+'),
        (r'好好[好]+'),
        (r'嘛[嘛啊]+'),
        (r'呗[呗啊]+'),
        (r'好了好了[好了]*'),
        (r'完了完了[完了]*'),
        (r'可不[是说]?'),
        (r'对吧[啊呀]?'),
        (r'怎么说[说呢]?'),
        (r'你知道[道吧]?'),
        (r'不是吗[吗啊]?'),
        (r'对不对[对啊]?'),
        (r'是不是[是啊]?'),
        (r'然后呢[呢啊]?'),
        (r'所以呢[呢啊]?'),
        (r'之类的[了的]?'),
        (r'什么的[么的]?'),
        (r'这样吧[吧啊]?'),
        (r'那样吧[吧啊]?'),
        (r'的话[话啊]?'),
        (r'你看[看吧]?'),
        # ── 重复词 ──
        (r'那个[那个]+'),
        (r'这个[这个]+'),
        (r'然后[然后]+'),
    ]
    cleaned = text
    for pattern in _tts_remove_patterns:
        cleaned = re.sub(pattern, '', cleaned)
    # 清理多余的标点和空格
    cleaned = re.sub(r'[，,]\s*[，,]', '，', cleaned)
    cleaned = re.sub(r'\s+', '', cleaned)
    # 末尾逗号改句号，防止模型认为句子未完继续生成
    cleaned = re.sub(r'[，,]\s*$', '。', cleaned)
    # 确保以标点结尾
    if cleaned and cleaned[-1] not in '。！？.!?；;':
        cleaned += '。'
    if cleaned != text:
        logger.info(f"v1.0.54: Cleaned tts_text (AGRESSIVE REMOVE): '{text[:50]}' -> '{cleaned[:50]}'")
    return cleaned


def _truncate_ref_text_by_sentence(text: str, max_chars: int = 45) -> str:
    """v1.0.42: 按句子边界截断 ref_text
    避免截断在词语中间导致 CosyVoice2 推理异常。
    """
    if len(text) <= max_chars:
        return text
    # 按句子标点分割（v1.0.73: '.'后跟数字不切分，保护小数"3.5"）
    sentences = re.split(r'(?<=[。！？!?；;])|(?<=\.)(?!\d)', text)
    result = ""
    for s in sentences:
        if len(result) + len(s) > max_chars:
            break
        result += s
    # 如果没有完整句子，直接截断
    if not result:
        result = text[:max_chars]
    return result


def _detect_and_trim_audio_repetition(audio_data, sample_rate, text_len):
    """v1.0.55: 音频级重复检测与裁剪 — 彻底解决"得了""以前""当时"等重复词问题

    之前的修复（v1.0.42~v1.0.54）全部在文本清洗和 token 检测层面，但：
    - 文本清洗无法阻止模型自发幻觉（模型从参考音频声学特征中学到的发音模式）
    - Token 检测是 per-chunk 的，无法检测跨块重复（每个块只出现1次"得了"不触发）
    - text_normalize 会进一步拆分文本，短句给模型更多自由发挥空间

    本函数在音频层面直接检测并裁剪多余内容，无论根因是什么都能生效。

    两层检测：
    1. 时长异常检测：如果音频时长远超文本预期（>40%），截断多余部分
       中文 1.1x 语速 ≈ 3.5 chars/sec，英文 ≈ 2.5 words/sec
    2. 尾部自相似检测：检测音频尾部是否存在循环重复模式（如"得了得了得了"）
       通过比较最后N秒和前面N秒的余弦相似度来判定
    """
    if len(audio_data) == 0 or text_len == 0:
        return audio_data

    duration = len(audio_data) / sample_rate

    # ── 1. 时长异常检测 ──
    expected_duration = max(text_len / 3.5, 1.0)
    max_duration = expected_duration * 1.4  # 允许 40% 冗余（语气词、停顿等）

    if duration > max_duration:
        trim_samples = int(max_duration * sample_rate)
        logger.warning(
            f"v1.0.55 DURATION TRUNCATION: text={text_len}chars, "
            f"expected={expected_duration:.1f}s, actual={duration:.1f}s, "
            f"trimming to {max_duration:.1f}s (removed {duration - max_duration:.1f}s)")
        audio_data = audio_data[:trim_samples]
        return audio_data

    # ── 2. 尾部自相似检测 ──
    # 检查音频尾部 8 秒内是否有 0.3-2.0 秒的循环重复
    tail_len = min(len(audio_data), int(8 * sample_rate))
    if tail_len < sample_rate:  # < 1 秒，跳过
        return audio_data

    tail = audio_data[-tail_len:]

    for seg_sec in [0.3, 0.5, 0.7, 1.0, 1.2, 1.5, 1.8, 2.0]:
        seg_len = int(seg_sec * sample_rate)
        if len(tail) < seg_len * 3:
            continue

        last_seg = tail[-seg_len:]
        prev_seg = tail[-seg_len * 2:-seg_len]

        # 余弦相似度
        norm_a = np.linalg.norm(last_seg)
        norm_b = np.linalg.norm(prev_seg)
        if norm_a < 0.001 or norm_b < 0.001:
            continue
        similarity = float(np.dot(last_seg, prev_seg) / (norm_a * norm_b))

        if similarity > 0.6:
            trim_point = len(audio_data) - seg_len
            logger.warning(
                f"v1.0.55 AUDIO REPETITION DETECTED: seg={seg_sec:.1f}s, "
                f"sim={similarity:.3f}, trimming {seg_sec:.1f}s from tail")
            audio_data = audio_data[:trim_point]
            return audio_data

    return audio_data


def synthesize_with_cosyvoice(text, ref_audio, ref_text, output_path, strict_clone=False, clone_id=None, speed=1.15, loose_verify=False):
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
        # v1.0.60: 停用 _clean_tts_text_for_synthesis
        # 根因分析：重复词来自 LLM 学习参考音频的 llm_prompt_speech_token，
        #   不是来自 tts_text。清洗 tts_text 不能阻止 LLM 在声学层面生成口头禅。
        # 而且 v1.0.54 的清洗会删除"以前""之后"等时间词，破坏句子语义。
        # v1.0.60 改用 instruct2 模式后，LLM 不再学习参考音频的说话习惯，
        #   不会产生重复词，文本清洗完全不需要了。
        # text = _clean_tts_text_for_synthesis(text)  # v1.0.60: 停用

        # v1.0.50: 短文本保护 — 检测克隆预览文本
        # 克隆预览文本（如"你好，很高兴认识你，这是我的声音预览。"）通常只有 15 字左右
        # min_token_text_ratio 太低会导致 EOS 提前触发，音频被截断
        # 这里显式标记短文本，让 model.py 的 llm_job 使用更宽松的上限
        is_short_text = len(text) <= 25
        if is_short_text:
            logger.info(f"v1.0.50: Short text detected ({len(text)} chars): '{text[:30]}...', using preview-friendly params")
        # 英文/混合文本：适当降低语速（英文需要更慢的节奏才能发音清晰）
        # 中文保持原速，英文 speed × 0.85
        effective_speed = speed
        if text_lang in ('en', 'mixed'):
            effective_speed = max(0.8, speed * 0.85)
            logger.info(f"English/mixed text detected, adjusting speed: {speed} -> {effective_speed}")

        if strict_clone:
            # v1.0.63: 回归 zero_shot 模式 — 恢复音色相似度（解决"声音贱贱的、不像原声"）
            #
            # 模式对比（关键权衡）：
            #   zero_shot:  LLM 接收参考音频 speech_token → 完整复制音色+韵律+说话风格
            #               → 声音自然、接近原声；但可能复制口头禅（重复词风险）
            #   instruct2:  LLM 不接收参考音频 → 韵律语气由模型自己"猜"
            #               → 声音听起来贱贱的/不自然、与原声差别大（v1.0.60 用户反馈）
            #
            # v1.0.63 方案：zero_shot 优先（音色优先），重复词交给 v1.0.61/62 的
            #   Whisper 闭环校验拦截（校验失败 → 返回 False → 上层换采样重试）。
            #   instruct2 仅作为校验多次失败后的最终降级（strict_clone=False 分支）。
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
            # 截断参考音频到 8 秒（性能：8s 参考 → RTF≈19；29s → RTF=72）
            full_audio_duration = _get_audio_duration(ref_audio)
            ref_audio = _truncate_ref_audio(ref_audio, max_sec=8)
            # v1.0.63 关键：获取与截断音频严格对齐的 ref_text（不清洗！清洗会破坏文本-音频对齐）
            # 对齐的 prompt_text 让 LLM 精准理解参考音频内容 → 音色还原度大幅提升
            aligned_ref_text = _get_aligned_ref_text(clone_id, ref_audio, ref_text, full_audio_duration)
            logger.info(f"v1.0.63 zero_shot: text_lang={text_lang}, text='{text[:40]}...', ref_text='{aligned_ref_text[:40]}...', ref_audio={ref_audio}, speed={effective_speed}")
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
                # v1.0.63: zero_shot 模式 — 音色/韵律/说话风格完整复制自参考音频
                # 重复词风险由 _verify_and_fix_synthesis（Whisper 闭环校验）拦截
                # text_frontend=False 防止 CosyVoice2 的 text_normalize 二次拆分文本
                gen = _cosyvoice_model.inference_zero_shot(text, aligned_ref_text, ref_audio, '', speed=effective_speed, text_frontend=False)
            finally:
                _cosyvoice_synth_lock.release()
        else:
            # v1.0.60: 降级模式也改用 instruct2，保持一致性
            logger.info(f"v1.0.69 instruct2 (fallback): text_lang={text_lang}, text='{text[:40]}...', ref_audio={ref_audio}, speed={effective_speed}")
            # 截断参考音频到 8 秒（性能优化）
            ref_audio = _truncate_ref_audio(ref_audio, max_sec=8)
            # v1.0.74: instruct2 提示词强化 — 真实播客访谈节奏、语流呼吸、自然连读
            if text_lang == 'en':
                instruct_text = (
                    "Deliver this in a natural, conversational podcast interview tone. "
                    "Use realistic breathing pauses, subtle vocal variations, and fluent phrasing. "
                    "Vary your pace and emphasis like a real host chatting with a guest — never "
                    "sound like you are reading a script line by line. Keep warm and expressive.<|endofprompt|>"
                )
            else:
                instruct_text = (
                    "用真实自然的播客访谈语气朗读，像资深主持人在和嘉宾聊天。"
                    "注意真实的呼吸感，自然的连读和语流停顿，语速有变化，重音和强调要自然。"
                    "不要逐字生硬念稿子，要有温度、有起伏、有节奏感。<|endofprompt|>"
                )
            if not _cosyvoice_synth_lock.acquire(timeout=300):
                logger.error("CosyVoice2 synth lock timeout (300s), forcing release and retry")
                try:
                    _cosyvoice_synth_lock.release()
                except:
                    pass
                _cosyvoice_synth_lock.acquire(timeout=10)
            try:
                gen = _cosyvoice_model.inference_instruct2(text, instruct_text, ref_audio, '', speed=effective_speed, text_frontend=False)
            finally:
                _cosyvoice_synth_lock.release()

        audio_chunks_list = []
        for result in gen:
            chunk = result['tts_speech'].squeeze().cpu().numpy()
            if chunk is not None and len(chunk) > 0:
                audio_chunks_list.append(chunk)

        if audio_chunks_list:
            audio_data = np.concatenate(audio_chunks_list)
            # v1.0.40: 静音检测 — CosyVoice2 有时返回全零数据（模型未正确加载或推理异常）
            # 不检测会导致"合成成功"但音频完全无声，用户无法听到任何声音
            peak = float(np.max(np.abs(audio_data))) if len(audio_data) > 0 else 0.0
            rms = float(np.sqrt(np.mean(audio_data ** 2))) if len(audio_data) > 0 else 0.0
            if peak < 0.001 or rms < 0.0001:
                logger.error(f"CosyVoice2 produced SILENT audio (peak={peak:.6f}, rms={rms:.6f}), treating as failure")
                return False
            target_sr = 44100
            from scipy.signal import resample_poly
            from math import gcd
            g = gcd(target_sr, _cosyvoice_samplerate)
            audio_data = resample_poly(audio_data, target_sr // g, _cosyvoice_samplerate // g)
            audio_data = _postprocess_audio(audio_data, target_sr)[0]
            # v1.0.40: 后处理后再次检测静音（防止后处理引入问题）
            post_peak = float(np.max(np.abs(audio_data))) if len(audio_data) > 0 else 0.0
            if post_peak < 0.001:
                logger.error(f"CosyVoice2 audio became silent after postprocess (peak={post_peak:.6f}), treating as failure")
                return False
            # v1.0.58: 注释掉音频级时长截断和尾部自相似检测
            # 根因：v1.0.55 的时长截断（expected_duration * 1.4）对正常播客音频过度裁剪
            #   导致"只输出几秒音频"问题。token 层的重复检测（model.py）已足够拦截复读词
            # original_audio_len = len(audio_data)
            # audio_data = _detect_and_trim_audio_repetition(audio_data, target_sr, len(text))
            # if len(audio_data) < original_audio_len:
            #     logger.info(f"v1.0.55: Audio trimmed {original_audio_len - len(audio_data)} samples "
            #                f"({(original_audio_len - len(audio_data)) / target_sr:.2f}s) due to repetition/duration")
            sf.write(output_path, audio_data.astype(np.float32), target_sr, subtype='PCM_16')
            logger.info(f"CosyVoice2 synthesis OK: peak={peak:.4f}, rms={rms:.4f}, duration={len(audio_data)/target_sr:.2f}s")
            # v1.0.61: Whisper 闭环校验 — 拦截复读/漏读（校验失败返回 False 触发上层重试链）
            if not _verify_and_fix_synthesis(output_path, text, effective_speed, loose=loose_verify):
                logger.warning("v1.0.61: verification FAILED (repetition/incomplete), treating as synthesis failure")
                return False
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
                        # v1.0.40: 验证音频不是静音（防止生成全零 WAV）
                        try:
                            _verify_data, _verify_sr = sf.read(output_path)
                            _verify_peak = float(np.max(np.abs(_verify_data))) if len(_verify_data) > 0 else 0.0
                            if _verify_peak < 0.001:
                                raise Exception(f"Edge TTS output is silent (peak={_verify_peak:.6f})")
                            logger.info(f"Edge TTS synthesis OK: peak={_verify_peak:.4f}, duration={len(_verify_data)/_verify_sr:.2f}s")
                        except Exception as verify_err:
                            logger.warning(f"Edge TTS output verification failed: {verify_err}")
                            raise
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

def _is_audio_file_silent(path: str) -> bool:
    """v1.0.40: 检测音频文件是否为静音（全零或极低音量）
    用于防止合成引擎返回静音数据导致"合成成功但无声"的问题。
    """
    try:
        if not os.path.exists(path) or os.path.getsize(path) < 1000:
            return True
        data, sr = sf.read(path)
        if len(data) == 0:
            return True
        peak = float(np.max(np.abs(data)))
        rms = float(np.sqrt(np.mean(data ** 2)))
        # 阈值：peak < 0.001（约 -60dB）或 RMS < 0.0001 视为静音
        if peak < 0.001 or rms < 0.0001:
            logger.warning(f"Audio file is SILENT: {path} (peak={peak:.6f}, rms={rms:.6f}, size={os.path.getsize(path)})")
            return True
        return False
    except Exception as e:
        logger.warning(f"Audio silence check error for {path}: {e}")
        return True  # 无法验证时视为静音（保守策略，触发降级）


def synthesize_audio(text, output_path, meta, strict_clone=True, speed=1.15, loose_verify=False):
    ref_audio = meta.get("ref_audio", "")
    ref_text = meta.get("ref_text", "")
    clone_id = meta.get("id", "") or meta.get("clone_id", "")

    # v1.0.57: 如果 CosyVoice2 已加载，只使用 CosyVoice2，不回退到 Fish Speech / GPT-SoVITS
    # 原因：不同引擎音色不同，混用会导致同一播客出现多种声音
    cosyvoice_available = load_cosyvoice() and ref_audio and os.path.exists(ref_audio)

    # 优先 CosyVoice2
    if cosyvoice_available:
        if synthesize_with_cosyvoice(text, ref_audio, ref_text, output_path, strict_clone=strict_clone, clone_id=clone_id, speed=speed, loose_verify=loose_verify):
            # v1.0.40: 最终验证 — 防止 CosyVoice2 返回静音数据但函数认为"成功"
            if not _is_audio_file_silent(output_path):
                return True
            logger.warning(f"CosyVoice2 returned True but output is silent, trying next engine...")

    # strict_clone 模式下，如果 CosyVoice2 失败，不再尝试其他引擎
    # 避免输出非克隆音色（如默认女声）
    if strict_clone:
        return False

    # v1.0.57: 如果 CosyVoice2 已加载但失败，不再回退到其他引擎（音色不一致）
    # 只有 CosyVoice2 完全不可用时，才尝试其他引擎
    if cosyvoice_available:
        return False

    # 其次 Fish Speech（仅当 CosyVoice2 不可用时）
    clone_id = meta.get("clone_id", "")
    if check_fish_speech() and clone_id:
        if synthesize_with_fishspeech(text, ref_audio, ref_text, output_path, clone_id):
            if not _is_audio_file_silent(output_path):
                return True
            logger.warning(f"Fish Speech returned True but output is silent, trying next engine...")

    # 最后 GPT-SoVITS（仅当 CosyVoice2 不可用时）
    if load_gptsovits() and ref_audio and os.path.exists(ref_audio):
        gender = meta.get("gender", "female")
        if synthesize_with_gptsovits(text, ref_audio, ref_text, output_path, gender):
            if not _is_audio_file_silent(output_path):
                return True
            logger.warning(f"GPT-SoVITS returned True but output is silent")

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
app = FastAPI(title="Voice Cloning Service", version="13.0.1")


@app.on_event("startup")
async def startup_event():
    import asyncio
    loop = asyncio.get_running_loop()

    def _preload():
        # 检查模型是否已下载
        model_dir = MODEL_DIR
        if not model_dir.exists() or not (model_dir / "llm.pt").exists():
            logger.info(f"CosyVoice2 model not found at {model_dir}, skipping preload")
            logger.info("Model will be downloaded by the desktop app. Visit Settings to download.")
            return
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

@app.get("/models/status")
async def models_status():
    """检查 CosyVoice2 模型是否已下载"""
    model_dir = MODEL_DIR
    required_files = [
        "llm.pt", "flow.pt", "hift.pt",
        "flow.encoder.fp16",
        "flow.cache.pt",
        "flow.decoder.estimator.fp32.onnx",
        "speech_tokenizer_v2.batch.onnx",
        "campplus.onnx",
        "cosyvoice2.yaml",
        "configuration.json",
    ]
    existing = 0
    missing_files = []
    for f in required_files:
        if (model_dir / f).exists():
            existing += 1
        else:
            missing_files.append(f)
    total = len(required_files)
    ready = existing == total
    # 计算模型目录大小
    model_size_mb = 0
    if model_dir.exists():
        for f in model_dir.rglob("*"):
            if f.is_file():
                model_size_mb += f.stat().st_size
    return {
        "ready": ready,
        "model_dir": str(model_dir),
        "existing_files": existing,
        "total_files": total,
        "missing_files": missing_files,
        "model_size_mb": round(model_size_mb / 1024 / 1024, 2),
    }


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


def _detect_language_from_text(text: str) -> str:
    """
    v1.0.37: 根据文本内容检测语言，用于选择克隆试听预览文本的语言。
    返回语言代码：zh/en/ja/ko/other。

    v1.0.63 修复：假名/谚文是日语/韩语的判别特征（中文文本不含假名和谚文），
    必须优先于汉字判断 — 否则汉字多的日语句子会被误判为中文，
    导致日语声音克隆试听时朗读了中文模版。
    """
    if not text or not text.strip():
        return "zh"  # 默认中文
    # 统计各语言字符数量
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))  # 汉字（中文/日语共用）
    japanese_chars = len(re.findall(r'[\u3040-\u309f\u30a0-\u30ff]', text))  # 平假名+片假名
    korean_chars = len(re.findall(r'[\uac00-\ud7af]', text))  # 谚文
    latin_chars = len(re.findall(r'[a-zA-Z]', text))
    # 优先级：日文（假名）> 韩文（谚文）> 中文（汉字）> 英文
    # 假名/谚文出现即判定日/韩（中文不含这两类字符）；纯汉字才判定中文
    if japanese_chars > 0:
        return "ja"
    if korean_chars > 0:
        return "ko"
    if chinese_chars > 0:
        return "zh"
    if latin_chars > 0:
        return "en"
    return "zh"  # 默认中文


# v1.0.37: 多语言试听预览文本
# 克隆完成后点击试听，根据参考音频的语言自动选择对应语言的预览文本
PREVIEW_TEXTS = {
    "zh": "你好，很高兴认识你，这是我的声音预览。",
    "en": "Hello, nice to meet you. Here is a preview of my voice.",
    "ja": "こんにちは、お会いできて嬉しいです。これは私の声のプレビューです。",
    "ko": "안녕하세요, 만나서 반갑습니다. 이것은 제 목소리 미리보기입니다.",
}


def _get_audio_duration(audio_path: str) -> float:
    """v1.0.59: 获取音频文件时长（秒），用于验证预览音频是否完整"""
    try:
        import soundfile as sf
        info = sf.info(audio_path)
        return float(info.duration)
    except Exception:
        return 0.0


def _get_preview_text(ref_text: str = "") -> str:
    """根据参考文本语言返回对应的试听预览文本"""
    lang = _detect_language_from_text(ref_text)
    return PREVIEW_TEXTS.get(lang, PREVIEW_TEXTS["zh"])


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
    # v1.0.37: 根据参考音频语言自动选择试听文本
    # 中文声音朗读中文，英文声音朗读英文，日韩同理
    preview_text = _get_preview_text(ref_text)
    detected_lang = _detect_language_from_text(ref_text)
    # v1.0.59: 不截断 ref_text，保留完整参考文本让模型更好地理解音色
    # 之前截断到 34 字 + 清理口头禅会导致 ref_text 语义断裂，影响模型理解
    logger.info(f"Generating preview audio during clone (lang={detected_lang}, text='{preview_text}')...")
    preview_ready = False
    try:
        preview_clone = dict(clone_data)
        preview_clone["ref_text"] = ref_text  # v1.0.59: 使用完整 ref_text
        # v1.0.59: 预览音频仅使用 strict_clone=True（zero_shot），确保按模版朗读且音色一致
        # 不回退 cross_lingual 或 Edge TTS：会导致音色不一致或未使用克隆声音
        preview_success = False
        for attempt in range(3):
            preview_success = synthesize_audio(preview_text, preview_cache_path, preview_clone, strict_clone=True)
            # v1.0.59: 验证音频时长是否足够（预览文本至少需要 3 秒）
            if preview_success and os.path.exists(preview_cache_path) and os.path.getsize(preview_cache_path) > 1000:
                preview_duration = _get_audio_duration(preview_cache_path)
                if preview_duration >= 3.0:
                    logger.info(f"Preview audio OK: {os.path.getsize(preview_cache_path)} bytes, {preview_duration:.1f}s")
                    break
                else:
                    logger.warning(f"Preview audio too short ({preview_duration:.1f}s < 3.0s), retrying... attempt {attempt+1}")
                    preview_success = False
            else:
                logger.warning(f"Preview strict_clone attempt {attempt+1} failed, retrying...")
            time.sleep(1)
        if preview_success and os.path.exists(preview_cache_path) and os.path.getsize(preview_cache_path) > 1000:
            logger.info(f"Preview audio generated successfully: {os.path.getsize(preview_cache_path)} bytes")
            preview_ready = True
        else:
            logger.warning("Preview audio generation failed after 3 retries (strict_clone only), will retry on preview request")
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
            _preview_task_store[clone_id] = {"status": "failed", "started_at": time.time(), "error": "clone not found"}
        return

    cache_path = str(OUTPUT_DIR / f"clone_{clone_id}_preview.wav")
    # v1.0.59: 缓存已存在且时长足够则跳过，否则重新生成
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 1000:
        duration = _get_audio_duration(cache_path)
        if duration >= 3.0:
            with _preview_task_lock:
                _preview_task_store[clone_id] = {"status": "done", "started_at": time.time()}
            return
        else:
            logger.warning(f"[PreviewBG] Cached preview too short ({duration:.1f}s), regenerating...")
            os.remove(cache_path)

    clone_name = clone.get("name", "克隆声音")
    ref_text = clone.get("ref_text", "")
    # v1.0.37: 根据参考音频语言自动选择试听文本
    preview_text = _get_preview_text(ref_text)
    detected_lang = _detect_language_from_text(ref_text)

    preview_clone = dict(clone)
    preview_clone["ref_text"] = ref_text  # v1.0.59: 使用完整 ref_text

    logger.info(f"[PreviewBG] Start generating preview for clone {clone_id} (lang={detected_lang}, text='{preview_text}')")
    try:
        # v1.0.59: 预览音频仅使用 strict_clone=True（zero_shot），确保按模版朗读且音色一致
        # 不回退 cross_lingual 或 Edge TTS：会导致音色不一致或未使用克隆声音
        success = False
        for attempt in range(3):
            success = synthesize_audio(preview_text, cache_path, preview_clone, strict_clone=True)
            # v1.0.59: 验证音频时长是否足够
            if success and os.path.exists(cache_path) and os.path.getsize(cache_path) > 1000:
                duration = _get_audio_duration(cache_path)
                if duration >= 3.0:
                    break
                else:
                    logger.warning(f"[PreviewBG] Preview too short ({duration:.1f}s), retrying... attempt {attempt+1}")
                    success = False
            else:
                logger.warning(f"[PreviewBG] strict_clone attempt {attempt+1} failed for clone {clone_id}, retrying...")
            time.sleep(1)

        if success and os.path.exists(cache_path) and os.path.getsize(cache_path) > 1000:
            logger.info(f"[PreviewBG] Preview generated for clone {clone_id}: {os.path.getsize(cache_path)} bytes")
            with _preview_task_lock:
                _preview_task_store[clone_id] = {"status": "done", "started_at": time.time()}
        else:
            logger.warning(f"[PreviewBG] Preview generation failed after 3 retries (strict_clone only) for clone {clone_id}")
            with _preview_task_lock:
                _preview_task_store[clone_id] = {"status": "failed", "started_at": time.time(), "error": "strict_clone synthesis failed after 3 retries"}
    except Exception as e:
        logger.error(f"[PreviewBG] Preview generation error for clone {clone_id}: {e}")
        with _preview_task_lock:
            _preview_task_store[clone_id] = {"status": "failed", "started_at": time.time(), "error": str(e)}


@app.get("/preview/{clone_id}")
async def get_clone_preview(clone_id: str, force: int = 0):
    clone = _clone_store.get(clone_id)
    if not clone:
        raise HTTPException(status_code=404, detail=f"Clone '{clone_id}' not found")

    cache_path = str(OUTPUT_DIR / f"clone_{clone_id}_preview.wav")

    # v1.0.59: force=1 时删除旧缓存，强制重新生成
    if force == 1 and os.path.exists(cache_path):
        logger.info(f"[Preview] Force regenerate for clone {clone_id}")
        os.remove(cache_path)
        with _preview_task_lock:
            _preview_task_store.pop(clone_id, None)

    # 检查缓存 — 命中且时长足够则直接返回音频（秒回）
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 1000:
        duration = _get_audio_duration(cache_path)
        if duration >= 3.0:
            return FileResponse(
                cache_path,
                media_type="audio/wav",
                filename=f"{clone_id}_preview.wav",
                headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"},
            )
        else:
            # v1.0.59: 缓存音频太短，删除并重新生成
            logger.warning(f"[Preview] Cached preview too short ({duration:.1f}s), regenerating...")
            os.remove(cache_path)
            with _preview_task_lock:
                _preview_task_store.pop(clone_id, None)

    # 缓存未命中 — 检查是否已有后台生成任务
    with _preview_task_lock:
        task = _preview_task_store.get(clone_id)
        # v1.0.39: 如果任务失败，直接返回 failed 状态给前端（不再自动重试，避免无限循环）
        if task and task["status"] == "failed":
            return JSONResponse(
                status_code=202,
                content={"status": "failed", "clone_id": clone_id, "message": task.get("error", "Preview generation failed")},
            )
        # 如果任务已超时（超过 5 分钟），清除并重新启动
        if task and task["status"] == "generating" and (time.time() - task["started_at"]) > 300:
            logger.warning(f"[Preview] Task for {clone_id} timed out, restarting")
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
        # 显式选择了克隆音色（clone- 开头）
        if voice_id and voice_id.startswith("clone-"):
            cid = voice_id.replace("clone-", "")
            clone = _clone_store.get(cid)
            if clone:
                return {"type": "clone", "id": cid, "meta": clone}
            # v1.0.73: 显式克隆音色缺失时，先用默认克隆兜底；
            # 仍缺失则返回 clone_missing — 绝不降级为系统音色（防止"混入系统音色"）
            if clone_id_list and default_clone_idx < len(clone_id_list):
                cid2 = clone_id_list[default_clone_idx]
                clone2 = _clone_store.get(cid2)
                if clone2:
                    return {"type": "clone", "id": cid2, "meta": clone2}
            return {"type": "clone_missing"}
        # 显式系统音色
        if voice_id and voice_id in SYSTEM_VOICE_TO_EDGE:
            return {"type": "system", "id": voice_id, "edge_voice": SYSTEM_VOICE_TO_EDGE[voice_id]}
        # voice_id 为空/未知：优先用 clone_ids 里的克隆，其次系统默认女声
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

                # v1.0.74: chunk 80→100 字。更大上下文给 LLM 更完整的跨句韵律
                #   （配合分块前对超长句先细切，既保留长上下文，又避免整段不切分）
                #   完整性由 v1.0.74 的双门限 Whisper 校验 + 5 级降级链兜底。
                MAX_CHARS = 100
                # v1.0.74: 语速 1.0→1.03。真实播客语速通常略快于 1.0x
                #   （配合标点停顿优化，不会听起来赶）；更接近真人聊天节奏。
                PODCAST_SPEED = 1.03
                text_chunks = []
                if len(text) > MAX_CHARS:
                    # 按句子分割（v1.0.73: '.'/','后跟数字不切分，保护小数与千分位）
                    import re as _re
                    raw_sentences = _re.split(r'(?<=[。！？!?；;])|(?<=\.)(?!\d)', text)
                    # v1.0.74: 若某一句子 > MAX_CHARS（典型一整段逗号连接的长句，
                    #   没有句号/问号/叹号/分号），先用 _split_script_pieces
                    #   拆成 <=40 字的细块，避免 CosyVoice2 zero_shot 提前 EOS 漏读。
                    sentences = []
                    for s in raw_sentences:
                        if not s.strip():
                            continue
                        if len(s) > MAX_CHARS:
                            subs = _split_script_pieces(s, max_len=40)
                            sentences.extend(subs)
                        else:
                            sentences.append(s)
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
                        logger.info(f"Segment {seg_idx}: split into {len(text_chunks)} chunks (text={len(text)} chars, MAX={MAX_CHARS})")
                else:
                    text_chunks = [text]

                # 合成所有分块（v1.0.65: 逐句子句合成，从结构上保证完整朗读脚本文案）
                chunk_paths = []
                all_chunks_success = True
                for ci, text_chunk in enumerate(text_chunks):
                    sub_path = str(output_dir / f"seg_{seg_idx:03d}_part{ci:02d}.wav")
                    sub_success = False

                    # v1.0.69: 用 _synthesize_piece 逐句/逐子句合成 + 音频时长硬门禁 + Whisper 校验
                    #
                    # 四级降级策略（保证不漏读 + 尽量自然）：
                    #   1) zero_shot ×6 随机采样重试（音色最接近原声，韵律最自然）
                    #   2) 递归细分到 16 字以内子句分别合成后拼接
                    #   3) instruct2 降级（同模型同音色，LLM 自由发挥 → 稳定但韵律稍弱）
                    #   4) Edge TTS 最终保底（不同音色但保证不丢内容）
                    sub_success = _synthesize_piece(text_chunk, sub_path, meta, speed=PODCAST_SPEED)

                    if not sub_success:
                        # 四级策略全部失败（概率极低）：跳过该块
                        logger.error(f"v1.0.69: Segment {seg_idx} part {ci}: ALL strategies failed, skipping chunk")
                        all_chunks_success = False

                    if sub_success and os.path.exists(sub_path):
                        chunk_paths.append(sub_path)
                    else:
                        all_chunks_success = False

                # 合并分块音频（v1.0.70: 标点感知停顿 + 响度匹配 → 真实播客节奏）
                if chunk_paths:
                    if len(chunk_paths) == 1:
                        # 只有一个分块，直接复制
                        import shutil
                        shutil.copy2(chunk_paths[0], chunk_path)
                        success = True
                    else:
                        # 合并多个分块：
                        # v1.0.70 修复"机械感"根因 —
                        #   旧实现：淡出上一段尾部(15ms) + 0.25s 数字死寂 + 淡入本段开头(15ms)
                        #   → 每个句间边界都出现"音量塌陷→死寂→渐入"，叠加每块后处理的
                        #     10ms 淡入淡出，听起来像逐句开关麦克风 = 死板朗读的直接来源。
                        #   新实现：
                        #     1) 去掉交叉淡化（块间有停顿时交叉淡化只会造成音量塌陷）
                        #     2) 标点感知停顿：句号/问号/叹号后停 0.28s，逗号/顿号后停 0.15s
                        #        （真实播客的句间呼吸节奏）
                        #     3) RMS 响度匹配：独立合成的块响度可能有差异，统一到第一块
                        #        的响度（±3dB 限幅），消除块间的音量跳变
                        try:
                            all_audio = []
                            target_sr = 44100
                            # 标点感知的停顿时长（秒）
                            pause_strong = 0.28  # 。！？后：完整句间停顿
                            pause_weak = 0.15    # ，、；后：短语间短停顿
                            # 第一块的 RMS 作为响度基准
                            ref_rms = None
                            for i, cp in enumerate(chunk_paths):
                                data, sr = sf.read(cp)
                                if data.ndim > 1:
                                    data = data.mean(axis=1)
                                if sr != target_sr:
                                    from scipy.signal import resample_poly
                                    from math import gcd
                                    g = gcd(target_sr, sr)
                                    data = resample_poly(data, target_sr // g, sr // g)
                                data = data.astype(np.float32)
                                # 响度匹配：把每块 RMS 调到与第一块一致（±3dB 内）
                                cur_rms = float(np.sqrt(np.mean(data ** 2))) if len(data) > 0 else 0.0
                                if cur_rms > 1e-6:
                                    if ref_rms is None:
                                        ref_rms = cur_rms
                                    else:
                                        gain = ref_rms / cur_rms
                                        gain = float(np.clip(gain, 0.7, 1.4))  # ±3dB
                                        data = data * gain
                                # 不是第一块时，按上一块结尾标点插入停顿
                                if i > 0:
                                    prev_text = text_chunks[i - 1].strip() if i - 1 < len(text_chunks) else ""
                                    pause_sec = pause_strong if (prev_text and prev_text[-1] in "。！？!?") else pause_weak
                                    pause_samples = int(target_sr * pause_sec)
                                    all_audio.append(np.zeros(pause_samples, dtype=np.float32))
                                all_audio.append(data)
                            combined = np.concatenate(all_audio)
                            # 合并后整体峰值归一化，防止响度匹配叠加导致削波
                            peak = float(np.max(np.abs(combined))) if len(combined) > 0 else 0.0
                            if peak > 0.95:
                                combined = combined * (0.95 / peak)
                            sf.write(chunk_path, combined.astype(np.float32), target_sr, subtype='PCM_16')
                            success = True
                            logger.info(f"Segment {seg_idx}: merged {len(chunk_paths)} chunks with punctuation-aware pauses (0.28s/0.15s) + RMS loudness matching")
                        except Exception as merge_err:
                            logger.error(f"Segment {seg_idx}: failed to merge chunks: {merge_err}")
                            # 使用第一个分块作为降级
                            if chunk_paths:
                                import shutil
                                shutil.copy2(chunk_paths[0], chunk_path)
                                success = True
            elif vc["type"] == "clone_missing":
                # v1.0.73: 显式克隆音色缺失且无默认克隆兜底 — 直接标记失败，
                # 由下方 clone_missing 分支插入静音占位，绝不降级为 Edge TTS 系统音色
                # （否则会"混入系统音色"）
                logger.error(f"Segment {seg_idx} requested clone voice is missing; will insert silent placeholder (no mixed-voice fallback)")
                success = False
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
                # v1.0.64: 克隆声音失败时绝不注入 Edge TTS 默认音色（会造成"混杂的声音"）
                # 系统声音本来就是 Edge TTS，可安全用其他默认声音重试；克隆声音则必须保持音色一致
                if vc.get("type") in ("clone", "clone_missing"):
                    logger.error(f"Segment {seg_idx} clone voice produced no usable audio; skipping (no mixed-voice fallback)")
                    try:
                        silent_samples = int(44100 * 0.5)  # 0.5 秒静音占位
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
                        error="克隆声音合成失败未产生音频（保持音色一致，未降级为其他声音）",
                    )
                else:
                    # v1.0.39: 系统声音段合成失败 — 用 Edge TTS 默认声音兜底（确保有声音）
                    # 之前直接插入静音占位导致用户听到"无声"播客
                    logger.warning(f"Segment {seg_idx} system voice all synthesis failed, last resort: Edge TTS with default voice")
                    edge_fallback_success = False
                    # 尝试多个 Edge TTS 声音，确保至少一个能工作
                    fallback_voices = ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural", "zh-CN-XiaoyiNeural"]
                    for fv in fallback_voices:
                        if synthesize_with_edge_tts(text, fv, chunk_path, max_retries=2):
                            if os.path.exists(chunk_path) and os.path.getsize(chunk_path) > 1000:
                                edge_fallback_success = True
                                logger.warning(f"Segment {seg_idx}: used Edge TTS fallback voice {fv}")
                                break
                    if edge_fallback_success and os.path.exists(chunk_path):
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
                            logger.error(f"Error reading Edge TTS fallback chunk: {e}")
                            yield _send_event("segment_failed", segment_index=seg_idx, total_segments=total_segments, speaker=speaker, error=str(e))
                    else:
                        # 最终兜底：生成 0.5 秒静音占位（仅在 Edge TTS 也完全失败时）
                        logger.error(f"Segment {seg_idx}: Edge TTS also failed, inserting silent placeholder")
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
                            error="synthesis failed (all methods including Edge TTS)",
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

                    # v1.0.42: 移除交叉淡入淡出（crossfade）合并方式
                    # 旧逻辑用 np.zeros 填充 + crossfade 混合，会在段边界产生"呲呲呲"调制噪声
                    # 原因：零填充与有效音频的交界处振幅突变，叠加混合引入高频伪影
                    # 新逻辑：使用简单静音间隔 + 淡入淡出，避免叠加混合
                    # 淡入淡出只作用于段首段尾各 5ms，消除拼接爆音但不引入伪影
                    fade_samples = min(int(target_sr * 0.005), len(chunk) // 4)  # 5ms 淡入
                    if fade_samples > 0 and len(chunk) > fade_samples * 2:
                        fade_in = np.linspace(0, 1, fade_samples)
                        chunk = chunk.copy()
                        chunk[:fade_samples] *= fade_in

                    # 上一段尾部淡出
                    if fade_samples > 0 and len(merged) > fade_samples:
                        fade_out = np.linspace(1, 0, fade_samples)
                        merged = merged.copy()
                        merged[-fade_samples:] *= fade_out

                    merged = np.concatenate([merged, np.zeros(pause_samples), chunk])

                    # v1.0.42: 移除呼吸声注入
                    # 旧逻辑在段间随机注入白噪声"呼吸声"，但白噪声叠加会产生"呲呲"声
                    # 特别是 CPU 模式下合成音质本就一般，叠加噪声更明显

                # v1.0.42: 改进归一化 — 使用 RMS 归一化而非 peak 归一化
                # peak 归一化会将安静段也放大到 -3dB，导致背景噪声明显
                # RMS 归一化保持整体响度一致，安静段不会被过度放大
                rms = float(np.sqrt(np.mean(merged ** 2)))
                if rms > 0.001:
                    target_rms = 0.15  # 目标 RMS（约 -16dB LUFS，广播级标准）
                    merged = merged * (target_rms / rms)
                # 限幅保护（软限幅，避免硬 clip 产生失真）
                merged = np.tanh(merged * 1.2) * 0.85

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
