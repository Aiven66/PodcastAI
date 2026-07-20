#!/bin/bash
# ─── 语音克隆微服务启动脚本 v6 ───
# 使用方式:
#   bash start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 端口
PORT="${VOICE_SERVICE_PORT:-8902}"

# CosyVoice2 路径
export COSYVOICE_DIR="${COSYVOICE_DIR:-$SCRIPT_DIR/CosyVoice}"
export MODEL_DIR="${MODEL_DIR:-$SCRIPT_DIR/CosyVoice/pretrained_models/CosyVoice2-0.5B}"

# 数据目录
export VOICE_DATA_DIR="${VOICE_DATA_DIR:-$SCRIPT_DIR/voice-data}"

echo "============================================"
echo "  Voice Cloning Service v6 (CosyVoice2)"
echo "============================================"
echo "  Port:          $PORT"
echo "  Data Dir:      $VOICE_DATA_DIR"
echo "  CosyVoice Dir: $COSYVOICE_DIR"
echo "  Model Dir:     $MODEL_DIR"
echo "============================================"

# 使用 venv 中的 Python
PYTHON="$SCRIPT_DIR/venv/bin/python"

if [ ! -f "$PYTHON" ]; then
    echo "ERROR: venv not found at $SCRIPT_DIR/venv"
    echo "Please run: /opt/homebrew/bin/python3.11 -m venv venv && ./venv/bin/pip install -r requirements.txt"
    exit 1
fi

echo "Using Python: $($PYTHON --version)"

echo ""
echo "Starting Voice Cloning Service v6 on port $PORT..."
echo "  CosyVoice2: 零样本声音克隆（真正复刻上传音频的音色）"
echo "  edge-tts:   降级方案（通过独立进程调用）"
echo ""

$PYTHON main.py
