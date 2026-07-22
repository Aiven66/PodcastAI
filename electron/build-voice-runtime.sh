#!/bin/bash
# ─── 构建内置 Python 运行时 ───
# 下载 python-build-standalone，安装依赖，打包到 Electron resources
#
# 使用方式：
#   bash build-voice-runtime.sh [platform]
#   platform: mac-arm64 (默认), mac-x64, win-x64

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ELECTRON_DIR="$SCRIPT_DIR"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VOICE_SERVICE_DIR="$PROJECT_DIR/voice-service"
RUNTIME_DIR="$ELECTRON_DIR/voice-runtime"

PLATFORM="${1:-mac-arm64}"

# Python 版本
PYTHON_VERSION="3.10.20"
PBS_RELEASE="20260623"

echo "============================================"
echo "  Building voice-runtime for $PLATFORM"
echo "============================================"

# 清理旧目录
rm -rf "$RUNTIME_DIR"
mkdir -p "$RUNTIME_DIR"

# 下载 python-build-standalone
case "$PLATFORM" in
  mac-arm64)
    PBS_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_RELEASE}/cpython-${PYTHON_VERSION}%2B${PBS_RELEASE}-aarch64-apple-darwin-install_only.tar.gz"
    PYTHON_SUBDIR="python"
    ;;
  mac-x64)
    PBS_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_RELEASE}/cpython-${PYTHON_VERSION}%2B${PBS_RELEASE}-x86_64-apple-darwin-install_only.tar.gz"
    PYTHON_SUBDIR="python"
    ;;
  win-x64)
    PBS_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_RELEASE}/cpython-${PYTHON_VERSION}%2B${PBS_RELEASE}-x86_64-pc-windows-msvc-shared-install_only.tar.gz"
    PYTHON_SUBDIR="python"
    ;;
  *)
    echo "ERROR: Unknown platform $PLATFORM"
    exit 1
    ;;
esac

echo "Downloading Python from $PBS_URL..."
cd /tmp
curl -L -o python-standalone.tar.gz "$PBS_URL"
tar -xzf python-standalone.tar.gz

# 复制 Python 到 runtime 目录
echo "Copying Python to $RUNTIME_DIR..."
cp -R /tmp/python "$RUNTIME_DIR/"
rm -rf /tmp/python /tmp/python-standalone.tar.gz

# 获取 Python 可执行文件路径
if [[ "$PLATFORM" == "win-x64" ]]; then
  PYTHON_EXE="$RUNTIME_DIR/$PYTHON_SUBDIR/python.exe"
else
  PYTHON_EXE="$RUNTIME_DIR/$PYTHON_SUBDIR/bin/python3"
fi

echo "Python: $($PYTHON_EXE --version)"

# 安装依赖
echo ""
echo "Installing dependencies..."
$PYTHON_EXE -m pip install --upgrade pip --no-warn-script-location

# 核心依赖（精简版，不含 IndexTTS2、F5-TTS、GPT-SoVITS）
$PYTHON_EXE -m pip install --no-warn-script-location \
  fastapi==0.115.0 \
  "uvicorn[standard]==0.30.6" \
  python-multipart==0.0.9 \
  pydantic==2.9.0 \
  httpx==0.27.2 \
  "numpy>=1.24.0" \
  soundfile==0.12.1 \
  "edge-tts>=6.1.0" \
  scipy \
  librosa \
  openai-whisper \
  onnxruntime \
  torch \
  torchaudio

# CosyVoice2 依赖（v1.0.4 新增，确保声音克隆开箱即用）
echo ""
echo "Installing CosyVoice2 dependencies..."
$PYTHON_EXE -m pip install --no-warn-script-location \
  hyperpyyaml==1.2.3 \
  "ruamel.yaml<0.19" \
  modelscope==1.38.1 \
  inflect==7.3.1 \
  conformer==0.3.2 \
  diffusers==0.29.0 \
  hydra-core==1.3.2 \
  omegaconf==2.3.0 \
  x-transformers==1.31.6 \
  wetext==0.1.7 \
  pyworld==0.3.4 \
  gdown==5.1.0 \
  transformers==4.44.0 \
  lightning==2.2.4 \
  matplotlib==3.7.5 \
  networkx==3.1 \
  onnx==1.16.0 \
  pyarrow==15.0.2 \
  rich==13.7.1 \
  protobuf==4.25.3 \
  grpcio==1.57.0 \
  grpcio-tools==1.57.0 \
  "pydantic==2.7.0"

# 复制 voice-service 源码（不含 venv、模型、测试文件）
echo ""
echo "Copying voice-service source..."
mkdir -p "$RUNTIME_DIR/voice-service"
cp "$VOICE_SERVICE_DIR/main.py" "$RUNTIME_DIR/voice-service/"
cp "$VOICE_SERVICE_DIR/edge_tts_worker.py" "$RUNTIME_DIR/voice-service/" 2>/dev/null || true
cp "$VOICE_SERVICE_DIR/weight.json" "$RUNTIME_DIR/voice-service/" 2>/dev/null || true

# 复制 CosyVoice 源码（不含 pretrained_models 模型文件）
echo "Copying CosyVoice source (excluding models)..."
if [ -d "$VOICE_SERVICE_DIR/CosyVoice" ]; then
  mkdir -p "$RUNTIME_DIR/voice-service/CosyVoice"
  # 使用 rsync 排除 pretrained_models、__pycache__、.git
  rsync -a --exclude='pretrained_models' --exclude='__pycache__' --exclude='.git' \
    "$VOICE_SERVICE_DIR/CosyVoice/" "$RUNTIME_DIR/voice-service/CosyVoice/"
fi

# 创建启动脚本
echo "Creating launch script..."
if [[ "$PLATFORM" == "win-x64" ]]; then
  cat > "$RUNTIME_DIR/voice-service/start.bat" <<'EOF'
@echo off
set PYTHONHOME=%~dp0..\python
set PYTHONPATH=%~dp0..\python\Lib;%~dp0
set PATH=%~dp0..\python;%PATH%
set VOICE_SERVICE_PORT=8907
set no_proxy=localhost,127.0.0.1
set NO_PROXY=localhost,127.0.0.1
"%~dp0..\python\python.exe" "%~dp0main.py"
EOF
else
  cat > "$RUNTIME_DIR/voice-service/start.sh" <<'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
export PYTHONHOME="$RUNTIME_DIR/python"
export PYTHONPATH="$RUNTIME_DIR/python/lib/python3.10:$SCRIPT_DIR"
export PATH="$RUNTIME_DIR/python/bin:$PATH"
export VOICE_SERVICE_PORT=8907
export no_proxy=localhost,127.0.0.1
export NO_PROXY=localhost,127.0.0.1
exec "$RUNTIME_DIR/python/bin/python3" "$SCRIPT_DIR/main.py"
EOF
  chmod +x "$RUNTIME_DIR/voice-service/start.sh"
fi

# 清理缓存
echo "Cleaning cache..."
find "$RUNTIME_DIR" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find "$RUNTIME_DIR" -name "*.pyc" -delete 2>/dev/null || true
rm -rf "$RUNTIME_DIR/python/lib/python3.10/site-packages/pip" 2>/dev/null || true
rm -rf "$RUNTIME_DIR/python/lib/python3.10/site-packages/setuptools" 2>/dev/null || true

# 显示大小
echo ""
echo "============================================"
echo "  Build complete!"
echo "============================================"
du -sh "$RUNTIME_DIR"
du -sh "$RUNTIME_DIR/python"
du -sh "$RUNTIME_DIR/voice-service"
echo "============================================"
