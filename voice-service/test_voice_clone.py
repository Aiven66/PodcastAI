#!/usr/bin/env python3
"""
克隆声音自动化测试脚本
====================
验证以下功能：
1. Fish Speech 服务健康检查
2. 语音服务健康检查
3. 参考音频注册到 Fish Speech
4. 使用 reference_id 生成 TTS 音频
5. 音频质量验证（时长、音量、采样率）
6. 克隆声音预览接口测试
7. GPT-SoVITS 降级测试
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

# 配置
VOICE_SERVICE_URL = os.environ.get("VOICE_SERVICE_URL", "http://localhost:8907")
FISH_SPEECH_URL = os.environ.get("FISH_SPEECH_URL", "http://localhost:8908")
TEST_OUTPUT_DIR = "/tmp/voice_clone_test_output"

# 测试结果统计
results = {"passed": 0, "failed": 0, "errors": []}


def test(name: str, condition: bool, detail: str = ""):
    """记录测试结果"""
    status = "PASS" if condition else "FAIL"
    if condition:
        results["passed"] += 1
    else:
        results["failed"] += 1
        results["errors"].append(f"{name}: {detail}")
    print(f"  [{status}] {name}" + (f" - {detail}" if detail and not condition else ""))


def setup():
    """创建输出目录"""
    os.makedirs(TEST_OUTPUT_DIR, exist_ok=True)


def test_fish_speech_health():
    """测试1: Fish Speech 服务健康检查"""
    print("\n=== 测试1: Fish Speech 服务健康检查 ===")
    try:
        req = urllib.request.Request(f"{FISH_SPEECH_URL}/v1/health", method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            test("Fish Speech 服务可用", data.get("status") == "ok")
    except Exception as e:
        test("Fish Speech 服务可用", False, str(e))


def test_voice_service_health():
    """测试2: 语音服务健康检查"""
    print("\n=== 测试2: 语音服务健康检查 ===")
    try:
        req = urllib.request.Request(f"{VOICE_SERVICE_URL}/health", method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            test("语音服务可用", data.get("status") == "ok")
            test("Fish Speech 引擎已启用", data.get("engines", {}).get("fishspeech") == True)
            test("GPT-SoVITS 引擎已启用", data.get("engines", {}).get("gptsovits") == True)
    except Exception as e:
        test("语音服务可用", False, str(e))


def test_fish_speech_reference_registration():
    """测试3: 参考音频注册"""
    print("\n=== 测试3: 参考音频注册到 Fish Speech ===")
    # 查找已有克隆声音
    try:
        req = urllib.request.Request(f"{VOICE_SERVICE_URL}/voices", method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            voices = data.get("voices", [])
            test("存在克隆声音", len(voices) > 0, f"共 {len(voices)} 个克隆声音")

            if voices:
                # 检查 Fish Speech references
                list_req = urllib.request.Request(
                    f"{FISH_SPEECH_URL}/v1/references/list?format=json", method="GET"
                )
                list_req.add_header("Accept", "application/json")
                with urllib.request.urlopen(list_req, timeout=10) as resp:
                    list_data = json.loads(resp.read().decode("utf-8"))
                    ref_ids = list_data.get("reference_ids", [])
                    test("Fish Speech references 存在", len(ref_ids) > 0, f"共 {len(ref_ids)} 个 references")

                    # 检查克隆声音是否已注册
                    registered_count = 0
                    for voice in voices:
                        expected_ref_id = f"clone-{voice['id']}"
                        if expected_ref_id in ref_ids:
                            registered_count += 1
                    test("克隆声音已注册到 Fish Speech", registered_count > 0,
                         f"{registered_count}/{len(voices)} 已注册")
    except Exception as e:
        test("参考音频注册检查", False, str(e))


def test_fish_speech_tts_quality():
    """测试4: Fish Speech TTS 音频质量"""
    print("\n=== 测试4: Fish Speech TTS 音频质量 ===")
    try:
        # 获取已注册的 reference
        list_req = urllib.request.Request(
            f"{FISH_SPEECH_URL}/v1/references/list?format=json", method="GET"
        )
        list_req.add_header("Accept", "application/json")
        with urllib.request.urlopen(list_req, timeout=10) as resp:
            list_data = json.loads(resp.read().decode("utf-8"))
            ref_ids = list_data.get("reference_ids", [])

        if not ref_ids:
            test("Fish Speech TTS 测试", False, "没有可用的 reference_id")
            return

        ref_id = ref_ids[0]
        print(f"  使用 reference_id: {ref_id}")

        # 生成短文本 TTS（减少等待时间）
        request_data = {
            "text": "你好，这是一个测试。",
            "reference_id": ref_id,
            "top_p": 0.8,
            "temperature": 0.8,
            "repetition_penalty": 1.1,
            "max_new_tokens": 512,
            "format": "wav",
            "normalize": True,
            "chunk_length": 200,
        }

        req = urllib.request.Request(
            f"{FISH_SPEECH_URL}/v1/tts",
            data=json.dumps(request_data).encode("utf-8"),
            method="POST",
        )
        req.add_header("Content-Type", "application/json")

        start = time.time()
        with urllib.request.urlopen(req, timeout=900) as resp:
            audio_data = resp.read()
        elapsed = time.time() - start

        output_path = os.path.join(TEST_OUTPUT_DIR, "fish_tts_test.wav")
        with open(output_path, "wb") as f:
            f.write(audio_data)

        test("Fish Speech TTS 返回数据", len(audio_data) > 10000,
             f"{len(audio_data)} bytes in {elapsed:.1f}s")

        # 分析音频质量
        if len(audio_data) > 10000:
            import soundfile as sf
            import numpy as np
            data, sr = sf.read(output_path)
            duration = len(data) / sr
            peak = np.max(np.abs(data))
            rms = np.sqrt(np.mean(data**2))

            test("音频时长 > 1s", duration > 1.0, f"Duration: {duration:.2f}s")
            test("音频 Peak > 0.01", peak > 0.01, f"Peak: {peak:.4f}")
            test("音频 RMS > 0.001", rms > 0.001, f"RMS: {rms:.4f}")

            # 归一化后检查
            if peak > 0.001:
                normalized = data * (0.707 / peak)
                norm_rms = np.sqrt(np.mean(normalized**2))
                test("归一化后 RMS > 0.01", norm_rms > 0.01, f"Norm RMS: {norm_rms:.4f}")
    except Exception as e:
        test("Fish Speech TTS 质量", False, str(e))


def test_clone_preview():
    """测试5: 克隆声音预览接口"""
    print("\n=== 测试5: 克隆声音预览接口 ===")
    try:
        # 获取克隆声音列表
        req = urllib.request.Request(f"{VOICE_SERVICE_URL}/voices", method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            voices = data.get("voices", [])

        if not voices:
            test("预览测试", False, "没有克隆声音")
            return

        # 测试第一个克隆声音的预览
        voice = voices[0]
        clone_id = voice["id"]
        name = voice.get("name", "Unknown")
        print(f"  测试克隆声音: {name} (id={clone_id})")

        # 删除旧预览文件
        preview_dir = "/Users/aiven/Desktop/AI/tare-solo/PodcastAI/voice-service/voice-data/output"
        old_preview = os.path.join(preview_dir, f"{clone_id}_preview.wav")
        if os.path.exists(old_preview):
            os.remove(old_preview)

        # 请求预览
        start = time.time()
        req = urllib.request.Request(
            f"{VOICE_SERVICE_URL}/preview/{clone_id}", method="GET"
        )
        with urllib.request.urlopen(req, timeout=900) as resp:
            preview_data = resp.read()
        elapsed = time.time() - start

        test("预览接口返回数据", len(preview_data) > 10000,
             f"{len(preview_data)} bytes in {elapsed:.1f}s")

        # 分析预览音频
        if len(preview_data) > 10000:
            import soundfile as sf
            import numpy as np
            output_path = os.path.join(TEST_OUTPUT_DIR, f"preview_{clone_id}.wav")
            with open(output_path, "wb") as f:
                f.write(preview_data)

            data, sr = sf.read(output_path)
            duration = len(data) / sr
            peak = np.max(np.abs(data))
            rms = np.sqrt(np.mean(data**2))

            test("预览音频时长 > 1s", duration > 1.0, f"Duration: {duration:.2f}s")
            test("预览音频 Peak > 0.05", peak > 0.05, f"Peak: {peak:.4f}")
            test("预览音频 RMS > 0.005", rms > 0.005, f"RMS: {rms:.4f}")
            test("预览不是噪音", peak > 0.05 and rms > 0.005 and duration > 1.0,
                 f"Peak={peak:.4f}, RMS={rms:.4f}, Duration={duration:.2f}s")
    except Exception as e:
        test("克隆预览测试", False, str(e))


def test_gptsovits_fallback():
    """测试6: GPT-SoVITS 降级测试"""
    print("\n=== 测试6: GPT-SoVITS 降级测试 ===")
    try:
        # 获取克隆声音列表
        req = urllib.request.Request(f"{VOICE_SERVICE_URL}/voices", method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            voices = data.get("voices", [])

        if not voices:
            test("GPT-SoVITS 降级测试", False, "没有克隆声音")
            return

        voice = voices[0]
        clone_id = voice["id"]

        # 使用 synthesize 端点测试（返回 WAV 文件，不是 JSON）
        request_data = {
            "text": "这是一个降级测试。",
            "clone_id": clone_id,
        }

        req = urllib.request.Request(
            f"{VOICE_SERVICE_URL}/synthesize",
            data=json.dumps(request_data).encode("utf-8"),
            method="POST",
        )
        req.add_header("Content-Type", "application/json")

        start = time.time()
        with urllib.request.urlopen(req, timeout=300) as resp:
            audio_data = resp.read()
        elapsed = time.time() - start

        test("合成接口返回数据", len(audio_data) > 10000,
             f"{len(audio_data)} bytes in {elapsed:.1f}s")

        # 分析音频
        if len(audio_data) > 10000:
            import soundfile as sf
            import numpy as np
            output_path = os.path.join(TEST_OUTPUT_DIR, "gptsovits_test.wav")
            with open(output_path, "wb") as f:
                f.write(audio_data)

            data, sr = sf.read(output_path)
            duration = len(data) / sr
            peak = np.max(np.abs(data))
            rms = np.sqrt(np.mean(data**2))

            test("GPT-SoVITS 音频时长 > 1s", duration > 1.0, f"Duration: {duration:.2f}s")
            test("GPT-SoVITS 音频 Peak > 0.05", peak > 0.05, f"Peak: {peak:.4f}")
            test("GPT-SoVITS 音频 RMS > 0.005", rms > 0.005, f"RMS: {rms:.4f}")
    except Exception as e:
        test("GPT-SoVITS 降级测试", False, str(e))


def print_summary():
    """打印测试摘要"""
    print("\n" + "=" * 60)
    print(f"测试完成: {results['passed']} 通过, {results['failed']} 失败")
    if results["errors"]:
        print("\n失败项:")
        for err in results["errors"]:
            print(f"  - {err}")
    print("=" * 60)
    return results["failed"] == 0


if __name__ == "__main__":
    setup()
    test_fish_speech_health()
    test_voice_service_health()
    test_fish_speech_reference_registration()
    test_fish_speech_tts_quality()
    test_clone_preview()
    test_gptsovits_fallback()
    success = print_summary()
    sys.exit(0 if success else 1)
