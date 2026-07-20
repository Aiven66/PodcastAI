#!/usr/bin/env python3
"""
edge-tts 独立工作脚本
====================
由 voice-service 通过 subprocess 调用，
完全独立于 uvicorn 进程运行，彻底避免事件循环冲突。

用法:
  python3 edge_tts_worker.py <text> <voice> <output_path>

退出码:
  0 = 成功
  1 = 失败
"""
import sys
import os
import asyncio


async def main():
    if len(sys.argv) < 4:
        print("Usage: edge_tts_worker.py <text> <voice> <output_path>", file=sys.stderr)
        sys.exit(1)

    text = sys.argv[1]
    voice = sys.argv[2]
    output_path = sys.argv[3]

    try:
        import edge_tts

        # edge-tts 输出 mp3
        if output_path.endswith(".wav"):
            mp3_path = output_path.rsplit(".", 1)[0] + ".mp3"
        else:
            mp3_path = output_path

        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(mp3_path)

        if not os.path.exists(mp3_path) or os.path.getsize(mp3_path) < 500:
            print(f"edge-tts output too small or missing: {mp3_path}", file=sys.stderr)
            sys.exit(1)

        # 尝试用 ffmpeg 转 wav
        if output_path.endswith(".wav") and mp3_path.endswith(".mp3"):
            try:
                import subprocess
                result = subprocess.run(
                    ["ffmpeg", "-y", "-i", mp3_path, "-acodec", "pcm_s16le", "-ar", "22050", "-ac", "1", output_path],
                    capture_output=True, timeout=30
                )
                if result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 500:
                    try:
                        os.remove(mp3_path)
                    except Exception:
                        pass
                    print(f"OK: {output_path} ({os.path.getsize(output_path)} bytes)", file=sys.stderr)
                    sys.exit(0)
            except (FileNotFoundError, Exception):
                pass

            # ffmpeg 不可用，直接复制 mp3 为 wav（浏览器能播放 mp3 内容）
            import shutil
            shutil.copy2(mp3_path, output_path)
            try:
                os.remove(mp3_path)
            except Exception:
                pass
            print(f"OK (mp3-as-wav): {output_path} ({os.path.getsize(output_path)} bytes)", file=sys.stderr)
            sys.exit(0)

        print(f"OK: {mp3_path} ({os.path.getsize(mp3_path)} bytes)", file=sys.stderr)
        sys.exit(0)

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
