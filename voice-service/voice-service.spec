# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for voice-service
打包为独立可执行文件（--onedir 模式）
模型文件（CosyVoice2-0.5B）首次启动时下载，不打包
"""
import os
import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None

# 收集动态导入的模块
hiddenimports = []
hiddenimports += collect_submodules('cosyvoice')
hiddenimports += collect_submodules('whisper')
hiddenimports += collect_submodules('edge_tts')
hiddenimports += collect_submodules('librosa')
hiddenimports += collect_submodules('soundfile')
hiddenimports += collect_submodules('scipy')
hiddenimports += collect_submodules('onnxruntime')
hiddenimports += [
    'torch',
    'torchaudio',
    'torchaudio.transforms',
    'torchaudio.backend',
    'torchaudio.backend.soxio_backend',
    'torchaudio.backend.soundfile_backend',
    'numpy',
    'numpy.core',
    'pydantic',
    'fastapi',
    'fastapi.middleware.cors',
    'fastapi.staticfiles',
    'fastapi.responses',
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'multipart',
    'yaml',
    'torch.utils.data',
    'torch.nn',
    'torch.nn.functional',
]

# CosyVoice 源码（不含 pretrained_models 模型文件）
cosyvoice_datas = []
cosyvoice_root = os.path.join(os.getcwd(), 'CosyVoice')
if os.path.exists(cosyvoice_root):
    for root, dirs, files in os.walk(cosyvoice_root):
        # 跳过 pretrained_models（模型首次下载）
        if 'pretrained_models' in root:
            continue
        # 跳过 __pycache__、.git 等
        if '__pycache__' in root or '.git' in root:
            continue
        for f in files:
            if f.endswith(('.py', '.yaml', '.yml', '.json', '.txt', '.md')):
                rel = os.path.relpath(root, os.getcwd())
                cosyvoice_datas.append((os.path.join(root, f), rel))

# 收集其他数据文件
datas = []
datas += collect_data_files('librosa')
datas += collect_data_files('soundfile')
datas += collect_data_files('whisper')
datas += collect_data_files('edge_tts')
datas += cosyvoice_datas

a = Analysis(
    ['main.py'],
    pathex=['.', 'CosyVoice'],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'pytest',
        'IPython',
        'jupyter',
        'notebook',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='voice-service',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='voice-service',
)
