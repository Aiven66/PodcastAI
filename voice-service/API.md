# Voice Service API — iOS 对接契约

儿童绘本故事 App 通过本服务获得**声音朗读（TTS）**与**声音克隆**能力。

- Base URL：`https://<你的域名或者服务器的公网IP>`（建议域名 + HTTPS）
- 内容类型：除 `GET` 外均用 `multipart/form-data` 或 `application/json`
- 音频返回：大部分朗读/预览接口直接返回 `audio/wav` 二进制流。
- 鉴权：若服务端配置了 `VOICE_SERVICE_API_KEY`，除标注「公开」的接口外，都必须在请求头携带
  `x-api-key: <你的Key>`（或 `Authorization: Bearer <你的Key>`）。未配置则不鉴权。

错误码：
- `400` 参数错误　`401` 缺少/错误 API Key　`404` 资源不存在　`503` 服务繁忙
- 错误体：`{"detail": "错误信息"}`

---

## 一、健康检查（公开）

`GET /health`

```bash
curl -s https://your-host/health
```

响应：`{"status":"ok", ...}`

> 业务集成前先打此接口，确认服务可用（也可以用 `/models/status` 看 CosyVoice2 模型是否就绪）。

---

## 二、系统音色清单（公开）

`GET /voices`

返回所有可选的「系统音色」供 App 旁白音色选择 UI 使用。

```bash
curl -s https://your-host/voices
```

响应：

```json
{
  "voices": [
    { "id": "female-friendly", "name": "甜美女声", "gender": "Female", "language": "zh-CN", "edge_voice": "zh-CN-XiaoyiNeural", "type": "system" },
    { "id": "male-narrator",   "name": "电台男声", "gender": "Male",   "language": "zh-CN", "edge_voice": "zh-CN-YunxiNeural",  "type": "system" }
  ]
}
```

常用音色：`female-friendly`（甜美女声，适合儿童旁白）、`female-professional`（专业女声）、`male-narrator`（电台男声）。

---

## 三、朗读（TTS）

`POST /tts`（需鉴权）

把一段文字读成音频，支持**系统音色**或**克隆音色**。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | string | ✅ | 要朗读的文本 |
| `voice_id` | string | 否 | 系统音色 id（如 `female-friendly`）；或克隆音色 `clone:<id>`；为空则默认专业女声 |
| `speed` | float | 否 | 语速，默认 `1.0`（范围建议 0.8~1.2） |

```bash
# 用系统音色朗读
curl -f -o out.wav \
  -H "x-api-key: YOUR_KEY" \
  -F "text=小兔子今天要去森林里采蘑菇啦。" \
  -F "voice_id=female-friendly" \
  https://your-host/tts
```

```bash
# 用克隆音色朗读（clone_id 来自「克隆」接口返回，见第五节）
curl -f -o out_clone.wav \
  -H "x-api-key: YOUR_KEY" \
  -F "text=小兔子今天要去森林里采蘑菇啦。" \
  -F "voice_id=clone:6f21a3b8-xxxx-...." \
  https://your-host/tts
```

响应：`audio/wav`（示例文件会生成 WAV，可被 iOS `AVPlayer` / `AVAudioPlayer` 播放）。
响应头 `X-Engine: clone` 或 `edge-tts`，用于判断实际合成引擎。

> 说明：系统音色走 edge-tts（微软云，音色稳定；需服务器有外网）；克隆音色走本地 CosyVoice2/IndexTTS2/GPT-SoVITS（GPU 上质量最好）。文本可用 `\n` 分段，长文本会整段合成。

---

## 四、创建声音克隆

`POST /clones`（需鉴权，耗时较长，建议 App 使用异步/loading）

上传一段 3~30 秒、清晰、无背景噪音的参考音频（建议 WAV/MP3/M4A，≤ 10MB），服务端自动清洗、识别性别并生成试听音频。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `audio` | file | ✅ | 参考音频文件 |
| `name` | string | 否 | 克隆名（默认 "My Voice Clone"） |
| `gender` | string | 否 | `male` / `female`（可选，服务端会按 F0 自动校正） |
| `description` | string | 否 | 备注 |

```bash
curl -f \
  -H "x-api-key: YOUR_KEY" \
  -F "audio=@/path/to/ref.wav" \
  -F "name=妈妈的声音" \
  -F "gender=female" \
  https://your-host/clones
```

响应：

```json
{
  "id": "6f21a3b8-xxxx-....",
  "name": "妈妈的声音",
  "gender": "female",
  "ref_text": "参考音频里说的话...",
  "preview_ready": true,
  "created_at": 1750000000.0,
  "status": "ready"
}
```

> 克隆 id 即 `id` 字段，后续在 `/tts` 用 `voice_id=clone:<id>` 朗读。`preview_ready` 表示试听音频是否已就绪。

---

## 五、克隆列表 & 试听

### 克隆列表
`GET /clones`（需鉴权）

```bash
curl -s -H "x-api-key: YOUR_KEY" https://your-host/clones
```

响应：JSON 数组（同「创建克隆」响应的元素列表）。

### 克隆试听音频
`GET /clones/{clone_id}/preview`（需鉴权）

```bash
curl -f -o preview.wav -H "x-api-key: YOUR_KEY" https://your-host/clones/6f21a3b8-xxxx-..../preview
```

响应：`audio/wav`（克隆音色的试听；首字符可能返回 `202` 表示「正在生成」，App 稍后重试即可）。

### 系统音色试听
`GET /system-voice-preview/{voice_id}`（需鉴权）

```bash
curl -f -o sys.wav -H "x-api-key: YOUR_KEY" https://your-host/system-voice-preview/female-friendly
```

响应：`audio/wav`。

---

## 六、模型状态（公开）

`GET /models/status`

用于确认 CosyVoice2 高质量克隆模型是否已下载就绪：

```json
{
  "ready": true,
  "model_dir": "/data/models/CosyVoice2-0.5B",
  "existing_files": 11,
  "total_files": 11,
  "missing_files": [],
  "model_size_mb": 1500.0
}
```

---

## 部署步骤（摘要）

1. 准备一台**常驻服务器**（克隆要深就选带 Nvidia GPU 的实例 / AutoDL 等）。
2. 安装 Docker 与 Docker Compose v2（GPU 模式另装 `nvidia-container-toolkit`）。
3. 启动服务（在本仓库根目录）：
   ```bash
   VOICE_SERVICE_API_KEY=你的随机Key bash scripts/voice-service-deploy.sh
   # GPU 高质量克隆： bash scripts/voice-service-deploy.sh --gpu
   ```
4. 域名 + HTTPS：用 Caddy/Nginx 把公网 443(HTTPS) 反向代理到 `127.0.0.1:8900`。
   Caddy 最小示例：
   ```
   voice.your-domain.com {
       reverse_proxy 127.0.0.1:8900
   }
   ```
5. 验证：`curl -s https://voice.your-domain.com/health` 返回 ok，再按上文调用 `/tts`、`/clones`。
6. iOS 端把 Base URL 配成 `https://voice.your-domain.com`，所有业务请求带上 `x-api-key`。

> 数据持久化：克隆库与输出音频保存在 `voice-service/voice-data/`（已挂载为容器卷），升级/重启不丢。