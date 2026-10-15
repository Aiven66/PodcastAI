# ─── 声音朗读 + 声音克隆服务（容器化） ───
# 默认 CPU 基础镜像：可提供系统音色朗读（edge-tts，需外网）与轻量克隆。
# 如需 CosyVoice2 / IndexTTS2 等高质量克隆，请改用 CUDA 基础镜像并把下方的
FROM python:3.10-slim

# 避免 python 缓冲输出，便于 docker logs 实时可见
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    VOICE_DATA_DIR=/data \
    VOICE_SERVICE_PORT=8900 \
    TOKENIZERS_PARALLELISM=false

# 系统依赖：ffmpeg（edge-tts 生成的 MP3 转 WAV 需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 服务代码
COPY main.py /app/main.py

# Python 依赖（CPU 模式核心依赖）
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir \
        fastapi \
        uvicorn[standard] \
        python-multipart \
        edge-tts \
        soundfile \
        numpy \
        scipy

# GPU 高质量克隆（可选）：使用 CUDA 基础镜像时放开下面并复现 CosyVoice2/IndexTTS2 依赖
# FROM 建议改成 nvidia/cuda:12.X.X-cudnn8-runtime-ubuntu22.04 后用 uv 装 torch + index-tts
# 并将 COSYVOICE_MODEL_DIR 指向已下载的 CosyVoice2-0.5B 模型目录。

VOLUME ["/data"]
EXPOSE 8900

# main.py 内部自带 uvicorn 启动，读取 VOICE_SERVICE_PORT / VOICE_DATA_DIR
CMD ["python", "main.py"]