import re

# 读取文件
with open('/Users/aiven/Desktop/AI/tare-solo/PodcastAI/voice-service/main.py', 'r') as f:
    content = f.read()

# 找到第一个 SYSTEM_VOICE_TO_EDGE（在 system-voice-preview 路由中）
old_mapping_start = content.find('    SYSTEM_VOICE_TO_EDGE = {', content.find('@app.get("/system-voice-preview/{voice_id}"'))
old_mapping_end = content.find('    }', old_mapping_start) + 5

old_template_start = content.find('    template_names = {', old_mapping_end)
old_template_end = content.find('    }', old_template_start) + 5

# 新的声音映射（添加英文声音）
new_mapping = '''    SYSTEM_VOICE_TO_EDGE = {
        # 中文声音
        "female-professional": "zh-CN-XiaoxiaoNeural",
        "female-friendly":    "zh-CN-XiaoyiNeural",
        "female-northeast":   "zh-CN-liaoning-XiaobeiNeural",
        "female-shaanxi":     "zh-CN-shaanxi-XiaoniNeural",
        "male-narrator":      "zh-CN-YunxiNeural",
        "male-deep":          "zh-CN-YunjianNeural",
        "male-sunny":         "zh-CN-YunyangNeural",
        "male-youth":         "zh-CN-YunxiaNeural",
        # 英文声音（海外）
        "en-female-jenny":    "en-US-JennyNeural",
        "en-female-ariana":   "en-US-AriaNeural",
        "en-female-sarah":    "en-GB-SoniaNeural",
        "en-male-guy":        "en-US-GuyNeural",
        "en-male-ryan":       "en-US-RyanNeural",
        "en-male-james":      "en-GB-RyanNeural",
    }'''

new_template_names = '''    template_names = {
        # 中文声音
        "female-professional": "Sarah 晓晓",
        "female-friendly":    "Emma 晓伊",
        "female-northeast":   "Beibei 小北",
        "female-shaanxi":     "Nini 小妮",
        "male-narrator":      "David 云希",
        "male-deep":          "James 云健",
        "male-sunny":         "Tom 云扬",
        "male-youth":         "Leo 云夏",
        # 英文声音（海外）
        "en-female-jenny":    "Jenny",
        "en-female-ariana":   "Aria",
        "en-female-sarah":    "Sarah (UK)",
        "en-male-guy":        "Guy",
        "en-male-ryan":       "Ryan",
        "en-male-james":      "James (UK)",
    }'''

# 替换预览文本生成逻辑
old_preview_text = '''    name = template_names.get(voice_id, voice_id)
    preview_text = f"你好，我是{name}，很高兴为你朗读。这是一段声音预览，你可以听听我的音色是否符合你的需求。"'''

new_preview_text = '''    name = template_names.get(voice_id, voice_id)
    # 根据语言类型使用不同的预览文本
    if voice_id.startswith("en-"):
        preview_text = f"Hello, I'm {name}. Welcome to Podcast AI. This is a voice preview so you can hear how I sound and see if I'm the right fit for your content."
    else:
        preview_text = f"你好，我是{name}，很高兴为你朗读。这是一段声音预览，你可以听听我的音色是否符合你的需求。"'''

# 执行替换
content = content[:old_mapping_start] + new_mapping + content[old_mapping_end:]
content = content[:old_template_start + len(new_mapping) - (old_mapping_end - old_mapping_start)] + new_template_names + content[old_template_end + len(new_mapping) - (old_mapping_end - old_mapping_start):]

# 找到并替换预览文本
content = content.replace(old_preview_text, new_preview_text)

# 现在修改第二个 SYSTEM_VOICE_TO_EDGE（在 synthesize-podcast 中）
second_mapping_start = content.find('    SYSTEM_VOICE_TO_EDGE = {', content.find('synthesize-podcast'))
if second_mapping_start != -1:
    second_mapping_end = content.find('    }', second_mapping_start) + 5
    content = content[:second_mapping_start] + new_mapping + content[second_mapping_end:]

# 写入文件
with open('/Users/aiven/Desktop/AI/tare-solo/PodcastAI/voice-service/main.py', 'w') as f:
    f.write(content)

print("Successfully updated main.py with English voices")
