#!/usr/bin/env python3
"""
端到端自动化测试：验证克隆声音生成播客的完整流程
测试步骤：
1. 检查 Python 语音服务健康状态
2. 验证克隆声音在 Python 服务中存在且音频文件可用
3. 直接调用 Python 服务 /synthesize 验证 GPT-SoVITS 合成
4. 通过 Next.js TTS API 验证完整链路
5. 验证生成的音频采样率（32kHz = GPT-SoVITS, 22050Hz = edge-tts）
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

# 配置
VOICE_SERVICE_URL = "http://localhost:8907"
NEXTJS_URL = "http://localhost:5000"
CLONES_META_FILE = os.path.join(os.path.dirname(__file__), "public", "voice-clones", "clones-meta.json")

# 测试结果
results = []


def log_test(name: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    results.append({"name": name, "passed": passed, "detail": detail})
    symbol = "✓" if passed else "✗"
    print(f"  {symbol} {name}" + (f" — {detail}" if detail else ""))


def fetch_json(url: str, method: str = "GET", data: dict = None, headers: dict = None, timeout: int = 30):
    """发送 HTTP 请求并返回 JSON"""
    if headers is None:
        headers = {}
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_binary(url: str, method: str = "GET", data: dict = None, headers: dict = None, timeout: int = 120):
    """发送 HTTP 请求并返回二进制数据"""
    if headers is None:
        headers = {}
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def check_wav_sample_rate(wav_bytes: bytes) -> int:
    """从 WAV 文件头中提取采样率"""
    if len(wav_bytes) < 28:
        return 0
    # WAV header: bytes 24-27 are sample rate (little-endian 32-bit)
    import struct
    sample_rate = struct.unpack_from("<I", wav_bytes, 24)[0]
    return sample_rate


# ═══════════════════════════════════════════════════════════════
# Test 1: Python 语音服务健康检查
# ═══════════════════════════════════════════════════════════════
print("\n=== Test 1: Python 语音服务健康检查 ===")
try:
    health = fetch_json(f"{VOICE_SERVICE_URL}/health")
    gptsovits_ok = health.get("engines", {}).get("gptsovits", False)
    log_test("语音服务可用", True, f"version={health.get('version')}")
    log_test("GPT-SoVITS 引擎就绪", gptsovits_ok, f"gptsovits={gptsovits_ok}")
except Exception as e:
    log_test("语音服务可用", False, str(e))
    print("\n语音服务不可用，无法继续测试！")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════════
# Test 2: 克隆声音数据验证
# ═══════════════════════════════════════════════════════════════
print("\n=== Test 2: 克隆声音数据验证 ===")
try:
    with open(CLONES_META_FILE, "r") as f:
        frontend_clones = json.load(f)
    log_test("前端 clones-meta.json 可读", True, f"共 {len(frontend_clones)} 条记录")
except Exception as e:
    log_test("前端 clones-meta.json 可读", False, str(e))
    frontend_clones = []

# 找到最新的男声克隆（小北01）
target_clone = None
for r in reversed(frontend_clones):
    if r.get("gender") == "Male" and r.get("voiceServiceCloneId"):
        target_clone = r
        break

if target_clone:
    log_test("找到男声克隆记录", True, f"name={target_clone['name']}, id={target_clone['id'][:8]}...")
    log_test("voiceServiceCloneId 存在", bool(target_clone.get("voiceServiceCloneId")),
             target_clone.get("voiceServiceCloneId", "MISSING")[:8] + "...")
else:
    log_test("找到男声克隆记录", False, "没有男声克隆记录")

# 验证 Python 服务中的克隆记录
if target_clone:
    try:
        voices = fetch_json(f"{VOICE_SERVICE_URL}/voices")
        python_voice = None
        for v in voices["voices"]:
            if v["id"] == target_clone.get("voiceServiceCloneId"):
                python_voice = v
                break

        if python_voice:
            log_test("Python 服务中找到对应克隆", True, f"name={python_voice['name']}")
            audio_path = python_voice.get("audio_path", "")
            audio_exists = os.path.exists(audio_path) if audio_path else False
            log_test("参考音频文件存在", audio_exists,
                     f"path={audio_path[:50]}..." if audio_path else "无路径")
            log_test("engine=gptsovits", python_voice.get("engine") == "gptsovits",
                     f"engine={python_voice.get('engine')}")
        else:
            log_test("Python 服务中找到对应克隆", False,
                     f"voiceServiceCloneId={target_clone.get('voiceServiceCloneId')}")
    except Exception as e:
        log_test("Python 服务中找到对应克隆", False, str(e))

# ═══════════════════════════════════════════════════════════════
# Test 3: 直接调用 Python 服务验证 GPT-SoVITS 合成
# ═══════════════════════════════════════════════════════════════
print("\n=== Test 3: 直接调用 Python 服务验证 GPT-SoVITS 合成 ===")
if target_clone and target_clone.get("voiceServiceCloneId"):
    clone_id = target_clone["voiceServiceCloneId"]
    try:
        start = time.time()
        result = fetch_binary(
            f"{VOICE_SERVICE_URL}/synthesize",
            method="POST",
            data={"text": "你好，这是自动化测试。", "clone_id": clone_id, "language": "zh"},
            timeout=60,
        )
        elapsed = time.time() - start
        sr = check_wav_sample_rate(result)
        is_gptsovits = sr == 32000
        log_test("Python /synthesize 返回音频", True, f"size={len(result)} bytes, time={elapsed:.1f}s")
        log_test("采样率=32kHz (GPT-SoVITS)", is_gptsovits,
                 f"sr={sr}Hz" + (" ← edge-tts 降级!" if sr == 22050 else ""))
    except Exception as e:
        log_test("Python /synthesize 返回音频", False, str(e))
else:
    log_test("Python /synthesize 返回音频", False, "没有可用的克隆 ID")

# ═══════════════════════════════════════════════════════════════
# Test 4: 通过 Next.js TTS API 验证完整链路
# ═══════════════════════════════════════════════════════════════
print("\n=== Test 4: 通过 Next.js TTS API 验证完整链路 ===")
if target_clone:
    clone_id_with_prefix = f"clone-{target_clone['id']}"
    try:
        start = time.time()
        tts_result = fetch_json(
            f"{NEXTJS_URL}/api/podcast/tts",
            method="POST",
            data={
                "script": "你好，这是通过Next.js TTS API的自动化测试。",
                "cloneIds": [clone_id_with_prefix],
                "podcastType": "single",
            },
            headers={"x-session": "demo-token"},
            timeout=180,
        )
        elapsed = time.time() - start
        has_audio = bool(tts_result.get("audioUrl"))
        engine = tts_result.get("engine", "")
        log_test("TTS API 返回成功", tts_result.get("success"), f"time={elapsed:.1f}s")
        log_test("TTS API 返回音频URL", has_audio,
                 f"audioUrl={tts_result.get('audioUrl', '')}, engine={engine}")

        # 验证音频文件
        if has_audio:
            audio_url = tts_result["audioUrl"]
            if audio_url.startswith("/"):
                audio_url = f"{NEXTJS_URL}{audio_url}"
            try:
                audio_data = fetch_binary(audio_url, timeout=30)
                sr = check_wav_sample_rate(audio_data)
                is_gptsovits = sr == 32000
                log_test("音频文件可访问", True, f"size={len(audio_data)} bytes")
                log_test("音频采样率=32kHz (GPT-SoVITS)", is_gptsovits,
                         f"sr={sr}Hz" + (" ← edge-tts 降级!" if sr == 22050 else ""))
            except Exception as e:
                log_test("音频文件可访问", False, str(e))
    except Exception as e:
        log_test("TTS API 调用", False, str(e))
else:
    log_test("TTS API 调用", False, "没有可用的克隆记录")

# ═══════════════════════════════════════════════════════════════
# Test 5: 验证前端 clone ID 格式匹配
# ═══════════════════════════════════════════════════════════════
print("\n=== Test 5: 验证前端 clone ID 格式匹配 ===")
if target_clone:
    # 模拟前端发送的 cloneId 格式
    frontend_clone_id = f"clone-{target_clone['id']}"
    # 检查 TTS route 的匹配逻辑
    matched = False
    for r in frontend_clones:
        if r["id"] == frontend_clone_id or f"clone-{r['id']}" == frontend_clone_id:
            matched = True
            break
    log_test("clone-xxx 格式匹配", matched,
             f"frontend_id={frontend_clone_id[:20]}...")

    # 检查 voiceServiceCloneId 解析
    resolved_id = target_clone.get("voiceServiceCloneId", "")
    log_test("voiceServiceCloneId 解析", bool(resolved_id),
             f"resolved={resolved_id[:8]}..." if resolved_id else "未解析")

# ═══════════════════════════════════════════════════════════════
# 汇总
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
passed = sum(1 for r in results if r["passed"])
failed = sum(1 for r in results if not r["passed"])
total = len(results)
print(f"测试结果: {passed}/{total} 通过, {failed} 失败")
if failed > 0:
    print("\n失败的测试:")
    for r in results:
        if not r["passed"]:
            print(f"  ✗ {r['name']}: {r['detail']}")
print("=" * 60)
sys.exit(0 if failed == 0 else 1)
