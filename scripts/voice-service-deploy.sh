#!/bin/bash
# ─── 一键部署声音朗读 + 声音克隆服务（Docker Compose） ───
# 用法:
#   bash scripts/voice-service-deploy.sh              # CPU 模式（系统音色朗读 + 轻量克隆）
#   bash scripts/voice-service-deploy.sh --gpu        # GPU 模式（启用 CosyVoice2 高质量克隆）
#   VOICE_SERVICE_API_KEY=secret bash scripts/voice-service-deploy.sh   # 开启 API Key 鉴权
#
# 前置条件: Docker + Docker Compose v2；GPU 模式还需 Nvidia 驱动、nvidia-container-toolkit。

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/voice-service/docker-compose.yml"

MODE="cpu"
if [ "$1" = "--gpu" ]; then
  MODE="gpu"
fi

echo "============================================"
echo "  部署声音朗读 + 声音克隆服务"
echo "============================================"
echo "  模式:        $MODE"
echo "  Compose:     $COMPOSE_FILE"
echo "  API Key:     ${VOICE_SERVICE_API_KEY:+已设置}${VOICE_SERVICE_API_KEY:-未设置（不鉴权）}"
echo "============================================"

cd "$PROJECT_DIR/voice-service"

if [ "$MODE" = "gpu" ]; then
  echo ">> GPU 模式下请先在 docker-compose.yml 中取消 GPU 配置段注释（deploy.resources.reservations.devices）"
  if ! command -v nvidia-smi &>/dev/null; then
    echo "WARN: 未检测到 nvidia-smi，请确认宿主机有 Nvidia GPU 与驱动。"
  fi
fi

echo ">> docker compose build ..."
docker compose -f "$COMPOSE_FILE" build

echo ">> docker compose up -d ..."
docker compose -f "$COMPOSE_FILE" up -d

# 健康检查
echo ">> 等待健康检查（最多 60s）..."
for i in $(seq 1 20); do
  if curl -fsS "http://localhost:8900/health" >/dev/null 2>&1; then
    echo "✅ 服务已就绪: http://localhost:8900/health"
    echo ""
    echo "  音色清单:  curl -s http://localhost:8900/voices"
    echo "  系统朗读:  curl -f -o a.wav -F 'text=你好，小朋友。' -F 'voice_id=female-friendly' http://localhost:8900/tts"
    exit 0
  fi
  sleep 3
done

echo "❌ 健康检查超时，请查看日志: docker compose -f $COMPOSE_FILE logs -f"
exit 1