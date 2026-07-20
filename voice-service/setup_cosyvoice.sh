#!/bin/bash
# ─── CosyVoice2 安装脚本 ───
# 用于安装阿里开源的零样本声音克隆引擎
# 支持 Apple M1/M2 MPS 加速和 NVIDIA CUDA

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo "  CosyVoice2 安装脚本"
echo "  零样本声音克隆 — 真正复刻上传音频的音色"
echo "============================================"

# 1. 检查 venv
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate

# 2. 安装 PyTorch（根据硬件自动选择）
echo ""
echo "Installing PyTorch..."
if [[ "$(uname)" == "Darwin" && "$(uname -m)" == "arm64" ]]; then
    echo "Detected Apple Silicon (M1/M2/M3) — installing PyTorch with MPS support"
    pip install -q torch torchaudio
else
    echo "Installing PyTorch with CUDA support..."
    pip install -q torch torchaudio --index-url https://download.pytorch.org/whl/cu118
fi

# 3. 克隆 CosyVoice
COSYVOICE_PATH="${COSYVOICE_DIR:-$SCRIPT_DIR/CosyVoice}"
if [ ! -d "$COSYVOICE_PATH" ]; then
    echo ""
    echo "Cloning CosyVoice repository..."
    git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git "$COSYVOICE_PATH"
    cd "$COSYVOICE_PATH"
    git submodule update --init --recursive
else
    echo "CosyVoice already exists at $COSYVOICE_PATH"
fi

# 4. 安装 CosyVoice 依赖
echo ""
echo "Installing CosyVoice dependencies..."
cd "$COSYVOICE_PATH"
pip install -q -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host=mirrors.aliyun.com 2>/dev/null || \
pip install -q -r requirements.txt

# 5. 下载模型
echo ""
echo "Downloading CosyVoice2-0.5B model..."
MODEL_PATH="${MODEL_DIR:-$COSYVOICE_PATH/pretrained_models/CosyVoice2-0.5B}"
if [ ! -d "$MODEL_PATH" ]; then
    python3 -c "
from modelscope import snapshot_download
snapshot_download('iic/CosyVoice2-0.5B', local_dir='$MODEL_PATH')
print('Model downloaded successfully!')
" || python3 -c "
from huggingface_hub import snapshot_download
snapshot_download('FunAudioLLM/CosyVoice2-0.5B', local_dir='$MODEL_PATH')
print('Model downloaded successfully from HuggingFace!')
"
else
    echo "Model already exists at $MODEL_PATH"
fi

echo ""
echo "============================================"
echo "  CosyVoice2 安装完成！"
echo "============================================"
echo ""
echo "启动语音服务："
echo "  COSYVOICE_DIR=$COSYVOICE_PATH MODEL_DIR=$MODEL_PATH python3 main.py"
echo ""
echo "或设置环境变量后启动："
echo "  export COSYVOICE_DIR=$COSYVOICE_PATH"
echo "  export MODEL_DIR=$MODEL_PATH"
echo "  python3 main.py"
