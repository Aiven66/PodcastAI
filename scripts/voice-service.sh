#!/bin/bash
# ─── 启动语音克隆微服务 ───
# 用法:
#   bash scripts/voice-service.sh              # 降级模式（无需 GPU）
#   COSYVOICE_DIR=/path/CosyVoice MODEL_DIR=/path/model bash scripts/voice-service.sh  # CosyVoice2 完整模式

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VOICE_SERVICE_DIR="$PROJECT_DIR/voice-service"

cd "$VOICE_SERVICE_DIR"

PORT="${VOICE_SERVICE_PORT:-8900}"
export VOICE_SERVICE_PORT="$PORT"
export VOICE_DATA_DIR="${VOICE_DATA_DIR:-$VOICE_SERVICE_DIR/voice-data}"
export COSYVOICE_DIR="${COSYVOICE_DIR:-}"
export MODEL_DIR="${MODEL_DIR:-}"

echo "============================================"
echo "  Voice Cloning Service (CosyVoice2)"
echo "============================================"
echo "  Port:          $PORT"
echo "  Data Dir:      $VOICE_DATA_DIR"
echo "  CosyVoice Dir: ${COSYVOICE_DIR:-<not set>}"
echo "  Model Dir:     ${MODEL_DIR:-<not set>}"
echo "============================================"

# 检查 Python
if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null; then
    PYTHON=python
else
    echo "ERROR: Python 3 not found. Please install Python 3.8+"
    exit 1
fi

echo "Python: $($PYTHON --version)"

# 创建 venv
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON -m venv venv
fi

source venv/bin/activate

echo "Installing dependencies..."
pip install -q --upgrade pip
pip install -q fastapi uvicorn[standard] python-multipart pydantic httpx numpy soundfile

# CosyVoice2 依赖（可选）
if [ -n "$COSYVOICE_DIR" ] && [ -d "$COSYVOICE_DIR" ]; then
    echo "Installing CosyVoice2 dependencies..."
    pip install -q torch torchaudio 2>/dev/null || true
    if [ -f "$COSYVOICE_DIR/requirements.txt" ]; then
        pip install -q -r "$COSYVOICE_DIR/requirements.txt" 2>/dev/null || true
    fi
fi

echo ""
echo "Starting Voice Cloning Service on port $PORT..."
echo "  Health check: http://localhost:$PORT/health"
echo ""

$PYTHON main.py
