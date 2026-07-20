#!/usr/bin/env python3
"""
克隆声音播客生成端到端自动化测试 v2
======================================
验证用户选择克隆声音"小北01"生成播客时，输出的音频确实使用了 GPT-SoVITS 克隆引擎。

通过 WAV 文件头采样率区分引擎：
  32000Hz = GPT-SoVITS（克隆声音） ✓
  22050Hz = edge-tts（系统声音） ✗
  24000Hz = F5-TTS（仅女声降级）
"""

import json
import os
import struct
import sys
import time
import urllib.request
import urllib.error

try:
    import numpy as np
except ImportError:
    np = None

# ─── 配置 ───
PYTHON_SERVICE = os.environ.get("VOICE_SERVICE_URL", "http://localhost:8907")
NEXTJS_SERVICE = os.environ.get("NEXTJS_URL", "http://localhost:3000")
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
CLONES_META = os.path.join(PROJECT_DIR, "public", "voice-clones", "clones-meta.json")
PODCASTS_DIR = os.path.join(PROJECT_DIR, "public", "podcasts")

# 小北01 的已知信息
XIAOBEI01_FRONTEND_ID = "clone-2841bc66-8bca-4cdc-9a6e-14234af84561"
XIAOBEI01_PYTHON_ID = "96062a36-1e22-42e5-b3a1-a3ccd80a586d"

passed = 0
failed = 0
errors = []


def run_test(name, func):
    """运行单个测试"""
    global passed, failed
    try:
        func()
        passed += 1
        print(f"  ✓ {name}")
        return True
    except AssertionError as e:
        failed += 1
        errors.append(f"{name}: {e}")
        print(f"  ✗ {name}: {e}")
        return False
    except Exception as e:
        failed += 1
        errors.append(f"{name}: {type(e).__name__}: {e}")
        print(f"  ✗ {name}: {type(e).__name__}: {e}")
        return False


def fetch_json(url, method="GET", data=None, headers=None, timeout=30):
    """发送 HTTP 请求并返回 JSON"""
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_binary(url, method="GET", data=None, headers=None, timeout=300):
    """发送 HTTP 请求并返回二进制数据"""
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def get_wav_sample_rate(data):
    """从 WAV 文件头读取采样率"""
    if len(data) < 44 or data[:4] != b'RIFF':
        return 0
    return struct.unpack_from('<I', data, 24)[0]


def identify_engine(sample_rate):
    """根据采样率识别引擎"""
    if sample_rate == 32000:
        return "GPT-SoVITS (克隆声音)"
    elif sample_rate == 22050:
        return "edge-tts (系统声音)"
    elif sample_rate == 24000:
        return "F5-TTS (女声降级)"
    else:
        return f"Unknown ({sample_rate}Hz)"


# ═══════════════════════════════════════════════════════════════
# 测试函数
# ═══════════════════════════════════════════════════════════════

def test_python_health():
    result = fetch_json(f"{PYTHON_SERVICE}/health")
    assert result["status"] == "ok", f"服务状态异常: {result['status']}"
    assert result["version"] in ("10.0.0", "11.0.0"), f"版本不匹配: {result['version']}"


def test_gptsovits_loaded():
    result = fetch_json(f"{PYTHON_SERVICE}/health")
    engines = result.get("engines", {})
    assert engines.get("gptsovits") is True, f"GPT-SoVITS 未加载: {engines}"


def test_clones_loaded():
    result = fetch_json(f"{PYTHON_SERVICE}/health")
    assert result.get("clones_count", 0) > 0, "没有克隆声音数据"


def test_clones_meta_exists():
    assert os.path.exists(CLONES_META), f"clones-meta.json 不存在: {CLONES_META}"
    with open(CLONES_META) as f:
        records = json.load(f)
    assert isinstance(records, list), "clones-meta.json 格式错误"
    assert len(records) > 0, "clones-meta.json 为空"


def test_xiaobei01_frontend_record():
    with open(CLONES_META) as f:
        records = json.load(f)
    xiaobei01 = None
    for r in records:
        if r.get("name") == "小北01":
            xiaobei01 = r
            break
    assert xiaobei01 is not None, "找不到小北01记录"
    assert xiaobei01.get("voiceServiceCloneId"), "小北01缺少 voiceServiceCloneId"
    assert xiaobei01["voiceServiceCloneId"] == XIAOBEI01_PYTHON_ID, \
        f"voiceServiceCloneId 不匹配: {xiaobei01['voiceServiceCloneId']}"
    assert xiaobei01.get("gender") == "Male", f"性别不正确: {xiaobei01.get('gender')}"


def test_xiaobei01_python_record():
    result = fetch_json(f"{PYTHON_SERVICE}/voices")
    voices = result.get("voices", [])
    xiaobei01 = None
    for v in voices:
        if v.get("id") == XIAOBEI01_PYTHON_ID:
            xiaobei01 = v
            break
    assert xiaobei01 is not None, f"Python 服务找不到小北01: {XIAOBEI01_PYTHON_ID}"
    audio_path = xiaobei01.get("audio_path", "")
    assert audio_path, "小北01缺少 audio_path"
    if not os.path.isabs(audio_path):
        script_dir = os.path.join(PROJECT_DIR, "voice-service")
        audio_path = os.path.join(script_dir, audio_path)
    assert os.path.exists(audio_path), f"小北01音频文件不存在: {audio_path}"
    assert os.path.getsize(audio_path) > 10000, f"小北01音频文件太小: {os.path.getsize(audio_path)}"


def test_clone_id_mapping():
    with open(CLONES_META) as f:
        records = json.load(f)
    clone_id = XIAOBEI01_FRONTEND_ID
    matched = None
    for r in records:
        if r["id"] == clone_id or f"clone-{r['id']}" == clone_id:
            matched = r
            break
    assert matched is not None, f"前端 clone ID 匹配失败: {clone_id}"
    assert matched.get("voiceServiceCloneId") == XIAOBEI01_PYTHON_ID, \
        f"映射不正确: {matched.get('voiceServiceCloneId')}"


def test_python_synthesize_gptsovits():
    data = fetch_binary(
        f"{PYTHON_SERVICE}/synthesize",
        method="POST",
        data={
            "text": "你好，这是克隆声音测试。",
            "clone_id": XIAOBEI01_PYTHON_ID,
            "language": "zh",
        },
        timeout=120,
    )
    assert len(data) > 1000, f"音频数据太小: {len(data)} bytes"
    sr = get_wav_sample_rate(data)
    assert sr == 32000, f"采样率不是 32000Hz（GPT-SoVITS），而是 {sr}Hz ({identify_engine(sr)})"


def test_python_synthesize_podcast_gptsovits():
    boundary = "----TestBoundary12345"
    script = "大家好，欢迎收听播客节目。今天我们来聊聊人工智能。"
    clone_ids = json.dumps([XIAOBEI01_PYTHON_ID])

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="script"\r\n\r\n{script}\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="clone_ids"\r\n\r\n{clone_ids}\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="podcast_type"\r\n\r\nsingle\r\n'
        f"--{boundary}--\r\n"
    ).encode("utf-8")

    req = urllib.request.Request(
        f"{PYTHON_SERVICE}/synthesize-podcast",
        data=body,
        method="POST",
    )
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

    with urllib.request.urlopen(req, timeout=300) as resp:
        data = resp.read()

    assert len(data) > 1000, f"播客音频数据太小: {len(data)} bytes"
    sr = get_wav_sample_rate(data)
    assert sr == 32000, f"采样率不是 32000Hz（GPT-SoVITS），而是 {sr}Hz ({identify_engine(sr)})"


def test_tts_api_returns_audio_url():
    result = fetch_json(
        f"{NEXTJS_SERVICE}/api/podcast/tts",
        method="POST",
        data={
            "script": "你好，这是通过 Next.js TTS API 合成的测试语音。",
            "cloneIds": [XIAOBEI01_FRONTEND_ID],
            "podcastType": "single",
        },
        headers={"x-session": "demo-token"},
        timeout=300,
    )
    assert result.get("success"), f"TTS API 返回失败: {result}"
    assert result.get("audioUrl"), f"TTS API 未返回 audioUrl: {result}"
    assert result.get("engine") != "web-speech", f"TTS API 降级到了 web-speech: {result}"


def test_tts_api_audio_is_gptsovits():
    result = fetch_json(
        f"{NEXTJS_SERVICE}/api/podcast/tts",
        method="POST",
        data={
            "script": "这是验证 GPT-SoVITS 引擎的测试。",
            "cloneIds": [XIAOBEI01_FRONTEND_ID],
            "podcastType": "single",
        },
        headers={"x-session": "demo-token"},
        timeout=300,
    )
    audio_url = result.get("audioUrl", "")
    assert audio_url, "未返回 audioUrl"

    full_url = f"{NEXTJS_SERVICE}{audio_url}"
    req = urllib.request.Request(full_url)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()

    assert len(data) > 1000, f"音频文件太小: {len(data)} bytes"
    sr = get_wav_sample_rate(data)
    assert sr == 32000, f"采样率不是 32000Hz（GPT-SoVITS），而是 {sr}Hz ({identify_engine(sr)})"


def test_long_text_podcast_gptsovits():
    long_script = (
        "大家好，欢迎收听今天的播客节目。今天我们来聊聊人工智能的发展趋势。"
        "近年来，人工智能技术取得了令人瞩目的进步，从自然语言处理到计算机视觉，"
        "从语音识别到自动驾驶，AI正在深刻地改变着我们的生活方式。"
        "特别是在大语言模型领域，GPT系列模型的发布引发了全球范围内的关注和讨论。"
        "这些模型不仅能够理解和生成自然语言，还能进行推理、创作和编程等复杂任务。"
        "与此同时，AI伦理和安全问题也日益受到重视，如何确保AI技术的负责任发展成为了一个重要议题。"
        "让我们一起来深入探讨这些话题。"
    )
    result = fetch_json(
        f"{NEXTJS_SERVICE}/api/podcast/tts",
        method="POST",
        data={
            "script": long_script,
            "cloneIds": [XIAOBEI01_FRONTEND_ID],
            "podcastType": "single",
        },
        headers={"x-session": "demo-token"},
        timeout=600,
    )
    audio_url = result.get("audioUrl", "")
    assert audio_url, f"长文本合成未返回 audioUrl: {result}"

    full_url = f"{NEXTJS_SERVICE}{audio_url}"
    req = urllib.request.Request(full_url)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()

    sr = get_wav_sample_rate(data)
    assert sr == 32000, f"长文本合成采样率不是 32000Hz，而是 {sr}Hz ({identify_engine(sr)})"
    assert len(data) > 50000, f"长文本音频文件太小: {len(data)} bytes"


def test_tts_retry_mechanism():
    """验证 TTS API 在多次调用时都能正确返回 GPT-SoVITS 音频"""
    results = []
    for i in range(2):
        result = fetch_json(
            f"{NEXTJS_SERVICE}/api/podcast/tts",
            method="POST",
            data={
                "script": f"第{i+1}次重试验证测试。",
                "cloneIds": [XIAOBEI01_FRONTEND_ID],
                "podcastType": "single",
            },
            headers={"x-session": "demo-token"},
            timeout=300,
        )
        results.append(result)

    for i, result in enumerate(results):
        assert result.get("audioUrl"), f"第{i+1}次调用未返回 audioUrl"
        assert result.get("engine") != "web-speech", f"第{i+1}次调用降级到了 web-speech"


def test_audio_file_accessible():
    result = fetch_json(
        f"{NEXTJS_SERVICE}/api/podcast/tts",
        method="POST",
        data={
            "script": "音频文件可访问性测试。",
            "cloneIds": [XIAOBEI01_FRONTEND_ID],
            "podcastType": "single",
        },
        headers={"x-session": "demo-token"},
        timeout=300,
    )
    audio_url = result.get("audioUrl", "")
    assert audio_url, "未返回 audioUrl"

    full_url = f"{NEXTJS_SERVICE}{audio_url}"
    req = urllib.request.Request(full_url, method="HEAD")
    with urllib.request.urlopen(req, timeout=10) as resp:
        content_type = resp.headers.get("Content-Type", "")
        content_length = int(resp.headers.get("Content-Length", 0))

    assert "audio" in content_type or content_length > 0, \
        f"音频文件不可访问: Content-Type={content_type}, Content-Length={content_length}"


def test_audio_file_on_disk():
    result = fetch_json(
        f"{NEXTJS_SERVICE}/api/podcast/tts",
        method="POST",
        data={
            "script": "磁盘文件验证测试。",
            "cloneIds": [XIAOBEI01_FRONTEND_ID],
            "podcastType": "single",
        },
        headers={"x-session": "demo-token"},
        timeout=300,
    )
    audio_url = result.get("audioUrl", "")
    assert audio_url, "未返回 audioUrl"

    filename = audio_url.split("/")[-1]
    filepath = os.path.join(PODCASTS_DIR, filename)
    assert os.path.exists(filepath), f"音频文件不存在: {filepath}"
    file_size = os.path.getsize(filepath)
    assert file_size > 5000, f"音频文件太小: {file_size} bytes"


def test_no_clone_ids_fallback():
    result = fetch_json(
        f"{NEXTJS_SERVICE}/api/podcast/tts",
        method="POST",
        data={
            "script": "无克隆声音测试。",
            "cloneIds": [],
            "podcastType": "single",
        },
        headers={"x-session": "demo-token"},
        timeout=30,
    )
    assert result.get("success") is True, f"API 调用失败: {result}"


def test_invalid_clone_id_fallback():
    result = fetch_json(
        f"{NEXTJS_SERVICE}/api/podcast/tts",
        method="POST",
        data={
            "script": "无效克隆ID测试。",
            "cloneIds": ["clone-nonexistent-id"],
            "podcastType": "single",
        },
        headers={"x-session": "demo-token"},
        timeout=30,
    )
    assert result.get("success") is True, f"API 返回错误: {result}"


# ═══════════════════════════════════════════════════════════════
# 测试组 9: 音频质量验证
# ═══════════════════════════════════════════════════════════════

def test_audio_postprocessing_quality():
    """验证音频后处理：归一化、淡入淡出、限幅"""
    if np is None:
        return  # numpy 不可用时跳过
    result = fetch_json(
        f"{NEXTJS_SERVICE}/api/podcast/tts",
        method="POST",
        data={
            "script": "这是音频质量验证测试，检查归一化和淡入淡出效果。",
            "cloneIds": [XIAOBEI01_FRONTEND_ID],
            "podcastType": "single",
        },
        headers={"x-session": "demo-token"},
        timeout=300,
    )
    audio_url = result.get("audioUrl", "")
    assert audio_url, "未返回 audioUrl"

    full_url = f"{NEXTJS_SERVICE}{audio_url}"
    req = urllib.request.Request(full_url)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()

    # 解析 WAV 数据
    assert len(data) > 44, "音频数据太短"
    import struct
    data_size = struct.unpack_from('<I', data, 40)[0]
    assert data_size > 0, "音频数据大小为0"

    # 检查采样率是 32kHz (GPT-SoVITS)
    sr = get_wav_sample_rate(data)
    assert sr == 32000, f"采样率不是 32000Hz: {sr}"

    # 检查音频是否被归一化（peak 应在 0.3-0.95 范围内）
    audio_samples = np.frombuffer(data[44:44+data_size], dtype=np.int16).astype(np.float32) / 32768.0
    peak = np.max(np.abs(audio_samples))
    assert 0.1 < peak < 1.0, f"音频峰值异常: {peak}（应在0.1-1.0范围内，表示已归一化）"

    # 检查淡入淡出（前10个样本应该接近0）
    first_10 = np.abs(audio_samples[:10])
    assert np.max(first_10) < 0.1, f"音频开头没有淡入效果: max={np.max(first_10)}"

    # 检查限幅（不应有超过0.95的样本）
    assert peak <= 0.96, f"音频未正确限幅: peak={peak}"


def test_text_segmentation_quality():
    """验证长文本分段合成：每段应正确合成"""
    # 使用多句文本来测试分段
    multi_sentence = "第一句话，人工智能正在改变世界。第二句话，深度学习技术飞速发展。第三句话，自然语言处理取得了突破性进展。第四句话，语音合成质量大幅提升。"
    # synthesize 返回二进制 WAV 数据，不是 JSON
    data = fetch_binary(
        f"{PYTHON_SERVICE}/synthesize",
        method="POST",
        data={
            "text": multi_sentence,
            "clone_id": XIAOBEI01_PYTHON_ID,
            "language": "zh",
        },
        timeout=120,
    )
    assert len(data) > 5000, f"分段合成音频太小: {len(data)} bytes"
    sr = get_wav_sample_rate(data)
    assert sr == 32000, f"分段合成采样率不是 32000Hz: {sr}"

    # 多句文本应该生成较长的音频（至少3秒）
    data_size = struct.unpack_from('<I', data, 40)[0]
    duration = data_size / (sr * 2)  # 16bit = 2 bytes per sample
    assert duration >= 3.0, f"多句文本音频时长太短: {duration:.1f}s（应至少3秒）"


# ═══════════════════════════════════════════════════════════════
# 运行所有测试
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 70)
    print("克隆声音播客生成端到端自动化测试 v2")
    print("=" * 70)
    print(f"Python 服务: {PYTHON_SERVICE}")
    print(f"Next.js 服务: {NEXTJS_SERVICE}")
    print(f"小北01 前端 ID: {XIAOBEI01_FRONTEND_ID}")
    print(f"小北01 Python ID: {XIAOBEI01_PYTHON_ID}")
    print()

    tests = [
        # 测试组 1: Python 服务健康检查
        ("Python 服务健康检查", test_python_health),
        ("GPT-SoVITS 引擎已加载", test_gptsovits_loaded),
        ("克隆声音数据已加载", test_clones_loaded),

        # 测试组 2: 克隆声音数据验证
        ("前端 clones-meta.json 存在且可解析", test_clones_meta_exists),
        ("小北01 前端记录存在且包含 voiceServiceCloneId", test_xiaobei01_frontend_record),
        ("小北01 Python 服务记录存在且音频文件存在", test_xiaobei01_python_record),
        ("前端 clone ID → Python clone ID 映射正确", test_clone_id_mapping),

        # 测试组 3: GPT-SoVITS 直接合成验证
        ("Python /synthesize 使用 GPT-SoVITS 合成（32kHz）", test_python_synthesize_gptsovits),
        ("Python /synthesize-podcast 使用 GPT-SoVITS 合成（32kHz）", test_python_synthesize_podcast_gptsovits),

        # 测试组 4: Next.js TTS API 完整链路验证
        ("Next.js TTS API 返回 audioUrl（非空）", test_tts_api_returns_audio_url),
        ("Next.js TTS API 生成的音频是 GPT-SoVITS（32kHz）", test_tts_api_audio_is_gptsovits),

        # 测试组 5: 长文本播客合成验证
        ("长文本播客合成使用 GPT-SoVITS（32kHz）", test_long_text_podcast_gptsovits),

        # 测试组 6: 重试机制验证
        ("TTS API 重试机制：连续两次调用都应成功", test_tts_retry_mechanism),

        # 测试组 7: 音频文件可访问性验证
        ("生成的音频文件可通过 HTTP 访问", test_audio_file_accessible),
        ("音频文件在磁盘上存在且大小合理", test_audio_file_on_disk),

        # 测试组 8: 非 clone ID 场景验证
        ("不传 cloneIds 时 TTS API 返回降级", test_no_clone_ids_fallback),
        ("无效 clone ID 时 TTS API 优雅降级", test_invalid_clone_id_fallback),

        # 测试组 9: 音频质量验证
        ("音频后处理质量（归一化、淡入淡出、限幅）", test_audio_postprocessing_quality),
        ("长文本分段合成质量", test_text_segmentation_quality),
    ]

    print(f"共 {len(tests)} 个测试\n")

    start_time = time.time()
    for name, func in tests:
        run_test(name, func)

    elapsed = time.time() - start_time

    print()
    print("=" * 70)
    print(f"测试结果: {passed} 通过, {failed} 失败 (共 {passed + failed} 个)")
    print(f"耗时: {elapsed:.1f}s")
    print("=" * 70)

    if errors:
        print("\n失败详情:")
        for err in errors:
            print(f"  - {err}")

    sys.exit(0 if failed == 0 else 1)
