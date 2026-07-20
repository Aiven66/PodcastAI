import re

# 读取文件
with open('/Users/aiven/Desktop/AI/tare-solo/PodcastAI/voice-service/main.py', 'r') as f:
    content = f.read()

# ==============================================
# 1. 修改 _load_clones 函数，兼容 clones-meta.json 格式
# ==============================================
old_load_clones = '''def _load_clones():
    global _clone_store
    clones_file = CLONES_DIR / "clones.json"
    if clones_file.exists():
        try:
            with open(clones_file, "r") as f:
                _clone_store = json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load clones: {e}")
            _clone_store = {}'''

new_load_clones = '''def _load_clones():
    global _clone_store
    clones_file = CLONES_DIR / "clones.json"
    meta_file = CLONES_DIR / "clones-meta.json"
    loaded = False

    # 优先尝试加载新格式 clones.json
    if clones_file.exists():
        try:
            with open(clones_file, "r") as f:
                data = json.load(f)
                # 检查是否为字典格式（新格式直接是 dict）
                if isinstance(data, dict):
                    _clone_store = data
                    loaded = True
                elif isinstance(data, list):
                    # 列表格式，转换为字典
                    for item in data:
                        cid = item.get("id")
                        if cid:
                            _clone_store[cid] = item
                    loaded = True
        except Exception as e:
            logger.warning(f"Failed to load clones.json: {e}")

    # 如果新格式加载失败，尝试加载旧格式 clones-meta.json
    if not loaded and meta_file.exists():
        try:
            with open(meta_file, "r") as f:
                meta_list = json.load(f)
            if isinstance(meta_list, list):
                for item in meta_list:
                    cid = item.get("id")
                    if not cid:
                        continue
                    # 转换为标准格式
                    audio_path = item.get("audio_path") or item.get("ref_audio") or ""
                    if audio_path and not os.path.exists(audio_path):
                        # 尝试在 CLONES_DIR 中查找
                        fname = os.path.basename(audio_path)
                        candidate = str(CLONES_DIR / fname)
                        if os.path.exists(candidate):
                            audio_path = candidate
                    clone_data = {
                        "id": cid,
                        "name": item.get("name", cid[:8]),
                        "gender": item.get("gender", "female"),
                        "description": item.get("description", ""),
                        "ref_audio": audio_path,
                        "ref_text": item.get("ref_text", "") or item.get("prompt_text", "") or "",
                        "features": item.get("features", {}),
                        "created_at": item.get("created_at", time.time()),
                        "status": "ready",
                    }
                    _clone_store[cid] = clone_data
                loaded = True
                logger.info(f"Loaded {len(_clone_store)} clones from clones-meta.json")
        except Exception as e:
            logger.warning(f"Failed to load clones-meta.json: {e}")

    if not loaded:
        _clone_store = {}'''

content = content.replace(old_load_clones, new_load_clones)

# ==============================================
# 2. 修改 /preview/{clone_id} 接口，用 CosyVoice2 合成预览
# ==============================================
old_preview = '''@app.get("/preview/{clone_id}")
async def get_clone_preview(clone_id: str):
    clone = _clone_store.get(clone_id)
    if not clone:
        raise HTTPException(status_code=404, detail="Clone not found")

    ref_audio = clone.get("ref_audio", "")
    if ref_audio and os.path.exists(ref_audio):
        return FileResponse(
            ref_audio,
            media_type="audio/wav",
            filename=f"{clone_id}_preview.wav",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"},
        )
    raise HTTPException(status_code=500, detail="Preview file not found")'''

new_preview = '''@app.get("/preview/{clone_id}")
async def get_clone_preview(clone_id: str):
    clone = _clone_store.get(clone_id)
    if not clone:
        raise HTTPException(status_code=404, detail=f"Clone '{clone_id}' not found")

    # 检查缓存
    cache_path = str(OUTPUT_DIR / f"clone_{clone_id}_preview.wav")
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 1000:
        return FileResponse(
            cache_path,
            media_type="audio/wav",
            filename=f"{clone_id}_preview.wav",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"},
        )

    # 用克隆声音合成预览音频
    ref_audio = clone.get("ref_audio", "")
    ref_text = clone.get("ref_text", "")
    clone_name = clone.get("name", "克隆声音")

    # 根据性别选择预览文本
    gender = (clone.get("gender") or "female").lower()
    if gender.startswith("male") or gender == "男":
        preview_text = f"你好，我是{clone_name}。这是我的声音预览，你可以听听我的音色是否符合你的需求。很高兴能为你录制播客内容。"
    else:
        preview_text = f"你好呀，我是{clone_name}。这是我的声音预览哦，你可以听听我的音色是不是你想要的。期待能为你录制精彩的播客内容。"

    try:
        # 使用 CosyVoice2 合成预览音频
        def _synth():
            return synthesize_audio(preview_text, cache_path, clone, strict_clone=True)

        import asyncio
        import concurrent.futures
        try:
            loop = asyncio.get_running_loop()
            with concurrent.futures.ThreadPoolExecutor() as pool:
                success = await asyncio.get_event_loop().run_in_executor(pool, _synth)
        except RuntimeError:
            success = _synth()

        if success and os.path.exists(cache_path) and os.path.getsize(cache_path) > 1000:
            return FileResponse(
                cache_path,
                media_type="audio/wav",
                filename=f"{clone_id}_preview.wav",
                headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"},
            )
    except Exception as e:
        logger.error(f"Clone preview synthesis failed: {e}")

    # 降级：返回参考音频
    if ref_audio and os.path.exists(ref_audio):
        logger.warning(f"Falling back to reference audio for clone preview: {clone_id}")
        return FileResponse(
            ref_audio,
            media_type="audio/wav",
            filename=f"{clone_id}_ref.wav",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"},
        )

    raise HTTPException(status_code=500, detail="Failed to generate clone preview")'''

content = content.replace(old_preview, new_preview)

# 写入文件
with open('/Users/aiven/Desktop/AI/tare-solo/PodcastAI/voice-service/main.py', 'w') as f:
    f.write(content)

print("Successfully updated main.py")
print("1. Fixed _load_clones to support clones-meta.json format")
print("2. Modified /preview/{clone_id} to use CosyVoice2 synthesis")
