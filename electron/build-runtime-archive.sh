#!/bin/bash
# ─── 构建 Python 运行时归档（v1.0.79） ───
# 把本地 voice-runtime/python（含全部 site-packages，约 1.1G）压缩成单文件归档，
# 供安装包首启用 downloadRuntime() 下载并解压（瘦身安装包的关键产物）。
#
# 使用方式：
#   bash build-runtime-archive.sh [platform]
#   platform: mac-arm64 (默认), mac-x64, win-x64
#
# 产物：dist/python-runtime-<platform>-<version>.tar.gz
# 归档内容根目录为 python/，解压到 <installDir>/python 即得到完整运行时。

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ELECTRON_DIR="$SCRIPT_DIR"
PLATFORM="${1:-mac-arm64}"

# 与 build-voice-runtime.sh 保持一致的版本号
PYTHON_VERSION="3.10.20"
PBS_RELEASE="20260623"

PYTHON_DIR="$ELECTRON_DIR/voice-runtime/python"
OUT_DIR="$ELECTRON_DIR/dist"
OUT_FILE="$OUT_DIR/python-runtime-${PLATFORM}-${PYTHON_VERSION}-${PBS_RELEASE}.tar.gz"

if [ ! -d "$PYTHON_DIR" ]; then
  echo "ERROR: voice-runtime/python not found at $PYTHON_DIR"
  echo "Run build-voice-runtime.sh first (or keep voice-runtime/python intact)."
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "============================================"
echo "  Building python runtime archive for $PLATFORM"
echo "  Source: $PYTHON_DIR ($(du -sh "$PYTHON_DIR" | cut -f1))"
echo "  Output: $OUT_FILE"
echo "============================================"

# 在 py 目录的父级打包，使归档根为 python/
cd "$(dirname "$PYTHON_DIR")"
tar -czf "$OUT_FILE" \
  --exclude='__pycache__' \
  --exclude='.DS_Store' \
  --exclude='./python/.data' \
  python

echo "✅ Archive created:"
ls -lh "$OUT_FILE"

# 校验：解压后应存在可执行文件（win 为 python/python.exe，其余为 python/bin/python3）
TMP_CHECK="$(mktemp -d)"
tar -xzf "$OUT_FILE" -C "$TMP_CHECK"
if [[ "$PLATFORM" == "win-x64" ]]; then
  if [ -f "$TMP_CHECK/python/python.exe" ]; then
    echo "✓ Verify: $TMP_CHECK/python/python.exe exists"
    rm -rf "$TMP_CHECK"
    echo "✅ Runtime archive build complete."
  else
    echo "✗ Verify failed: python/python.exe not found in archive"
    rm -rf "$TMP_CHECK"
    exit 1
  fi
else
  if [ -x "$TMP_CHECK/python/bin/python3" ]; then
    echo "✓ Verify: $TMP_CHECK/python/bin/python3 exists and is executable"
    rm -rf "$TMP_CHECK"
    echo "✅ Runtime archive build complete."
  else
    echo "✗ Verify failed: python/bin/python3 not found in archive"
    rm -rf "$TMP_CHECK"
    exit 1
  fi
fi