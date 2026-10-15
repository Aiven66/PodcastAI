#!/usr/bin/env python3
"""Fast recursive xattr cleanup via ctypes: remove FinderInfo / ResourceFork / fileprovider attrs."""
import ctypes
import ctypes.util
import os
import sys

libc = ctypes.CDLL(ctypes.util.find_library("c"), use_errno=True)

BAD = (
    b"com.apple.FinderInfo",
    b"com.apple.ResourceFork",
    b"com.apple.fileprovider.fpfs#P",
    b"com.apple.fileprovider.fpfs#N",
    b"com.apple.fileprovider.fpfs#V",
    b"com.apple.fileprovider.fpfs#T",
)


def list_xattrs(path: bytes) -> list[bytes]:
    size = libc.listxattr(path, None, 0, 0)
    if size <= 0:
        return []
    buf = ctypes.create_string_buffer(size)
    n = libc.listxattr(path, buf, size, 0)
    if n <= 0:
        return []
    return [x for x in buf.raw[:n].split(b"\x00") if x]


def remove_xattr(path: bytes, name: bytes) -> bool:
    return libc.removexattr(path, name, 0) == 0


def main(app: str) -> None:
    cleaned = 0
    errors = 0
    for root, dirs, files in os.walk(app, followlinks=False):
        for name in dirs + files:
            p = os.path.join(root, name)
            pb = p.encode("utf-8")
            if os.path.islink(p):
                continue
            try:
                attrs = list_xattrs(pb)
            except OSError:
                continue
            for x in attrs:
                if x in BAD:
                    if remove_xattr(pb, x):
                        cleaned += 1
                    else:
                        errors += 1
    print(f"cleaned={cleaned} errors={errors}")


if __name__ == "__main__":
    main(sys.argv[1])
