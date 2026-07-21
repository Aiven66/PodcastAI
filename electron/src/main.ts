/**
 * PodcastAI Desktop - Electron Main Process
 *
 * 加载本地 HTML UI（不依赖在线 web）
 * 桌面端直接调用本地 Python 语音服务
 *
 * 内置服务管理器：检测 Python / voice-service，一键启动 / 停止
 */

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { spawn, execSync, ChildProcess } from 'child_process'

let mainWindow: BrowserWindow | null = null

// ─── 服务进程管理 ───
let serviceProcess: ChildProcess | null = null
let serviceLogs: string[] = []
const MAX_LOGS = 500

function pushLog(line: string) {
  const ts = new Date().toISOString().slice(11, 19)
  const entry = `[${ts}] ${line}`
  serviceLogs.push(entry)
  if (serviceLogs.length > MAX_LOGS) serviceLogs.shift()
  // 推送到渲染进程
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('service:log', entry)
  }
}

function detectPython(): { python: string | null; version: string | null; venvPython: string | null } {
  // 1. 检查 voice-service/venv（如果用户配置了 voiceServicePath）
  const settings = loadSettings()
  if (settings.voiceServicePath) {
    const venvPython = process.platform === 'win32'
      ? path.join(settings.voiceServicePath, 'venv', 'Scripts', 'python.exe')
      : path.join(settings.voiceServicePath, 'venv', 'bin', 'python')
    if (fs.existsSync(venvPython)) {
      try {
        const ver = execSync(`"${venvPython}" --version`, { encoding: 'utf-8', timeout: 5000 }).trim()
        return { python: venvPython, version: ver, venvPython }
      } catch {
        // fall through
      }
    }
  }

  // 2. 检查系统 Python
  const candidates = process.platform === 'win32'
    ? ['python', 'python3', 'py']
    : ['python3', 'python']
  for (const cmd of candidates) {
    try {
      const ver = execSync(`${cmd} --version`, { encoding: 'utf-8', timeout: 5000 }).trim()
      // 解析 "Python 3.11.5" → 检查 >= 3.10
      const match = ver.match(/Python\s+(\d+)\.(\d+)/)
      if (match) {
        const major = parseInt(match[1], 10)
        const minor = parseInt(match[2], 10)
        if (major > 3 || (major === 3 && minor >= 10)) {
          return { python: cmd, version: ver, venvPython: null }
        }
      }
    } catch {
      // try next
    }
  }
  return { python: null, version: null, venvPython: null }
}

function detectVoiceService(): { path: string | null; hasMainPy: boolean; hasVenv: boolean; hasModels: boolean } {
  const settings = loadSettings()
  const candidates: string[] = []

  // 1. 用户配置的路径
  if (settings.voiceServicePath) candidates.push(settings.voiceServicePath)

  // 2. 常见位置
  if (app.isPackaged) {
    // 打包后：在用户目录下查找
    const home = app.getPath('home')
    candidates.push(path.join(home, 'PodcastAI', 'voice-service'))
    candidates.push(path.join(home, 'Documents', 'PodcastAI', 'voice-service'))
    candidates.push(path.join(home, 'podcastai-voice-service'))
  } else {
    // 开发环境：相对项目根目录
    candidates.push(path.resolve(__dirname, '..', '..', 'voice-service'))
  }

  for (const dir of candidates) {
    if (dir && fs.existsSync(dir)) {
      const mainPy = path.join(dir, 'main.py')
      const venvDir = path.join(dir, 'venv')
      const modelDir = path.join(dir, 'CosyVoice', 'pretrained_models', 'CosyVoice2-0.5B')
      const hasModels = fs.existsSync(modelDir) || fs.existsSync(path.join(dir, 'CosyVoice', 'pretrained_models'))
      return {
        path: dir,
        hasMainPy: fs.existsSync(mainPy),
        hasVenv: fs.existsSync(venvDir),
        hasModels,
      }
    }
  }
  return { path: null, hasMainPy: false, hasVenv: false, hasModels: false }
}

// ─── 设置持久化 ───
interface AppSettings {
  voiceServicePath?: string
  pythonPath?: string
  autoStartService?: boolean
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'service-settings.json')
}

function loadSettings(): AppSettings {
  try {
    const p = getSettingsPath()
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'))
    }
  } catch {
    // ignore
  }
  return {}
}

function saveSettings(s: AppSettings): void {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2), 'utf-8')
  } catch {
    // ignore
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    title: 'PodcastAI',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 18 } : undefined,
  })

  mainWindow.loadFile(path.join(__dirname, 'index.html'))

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
}

// ─── IPC: 版本 ───
ipcMain.handle('get-version', () => ({
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
}))

// ─── IPC: 服务管理 ───
ipcMain.handle('service:detect', async () => {
  const py = detectPython()
  const vs = detectVoiceService()
  return {
    python: py.python,
    pythonVersion: py.version,
    venvPython: py.venvPython,
    voiceServicePath: vs.path,
    hasMainPy: vs.hasMainPy,
    hasVenv: vs.hasVenv,
    hasModels: vs.hasModels,
    platform: process.platform,
  }
})

ipcMain.handle('service:start', async (_, options?: { voiceServicePath?: string; pythonPath?: string }) => {
  if (serviceProcess) {
    return { success: false, error: 'Service is already running' }
  }

  // 优先使用传入的路径，其次使用配置
  const settings = loadSettings()
  const vsPath = options?.voiceServicePath || settings.voiceServicePath
  const pyPath = options?.pythonPath || settings.pythonPath

  if (!vsPath || !fs.existsSync(vsPath)) {
    return { success: false, error: 'Voice service path not found. Please configure it in Settings.' }
  }

  const mainPy = path.join(vsPath, 'main.py')
  if (!fs.existsSync(mainPy)) {
    return { success: false, error: 'main.py not found in voice service directory.' }
  }

  // 优先使用 venv 中的 Python
  let pythonExe = pyPath
  if (!pythonExe) {
    const venvPython = process.platform === 'win32'
      ? path.join(vsPath, 'venv', 'Scripts', 'python.exe')
      : path.join(vsPath, 'venv', 'bin', 'python')
    if (fs.existsSync(venvPython)) {
      pythonExe = venvPython
    } else {
      const detected = detectPython()
      pythonExe = detected.python || (process.platform === 'win32' ? 'python' : 'python3')
    }
  }

  pushLog(`Starting voice service...`)
  pushLog(`  Python: ${pythonExe}`)
  pushLog(`  Directory: ${vsPath}`)
  pushLog(`  Port: 8907 (default)`)

  try {
    serviceProcess = spawn(pythonExe, ['main.py'], {
      cwd: vsPath,
      env: {
        ...process.env,
        // 确保使用默认端口 8907
        VOICE_SERVICE_PORT: '8907',
        // 禁用代理
        no_proxy: 'localhost,127.0.0.1',
        NO_PROXY: 'localhost,127.0.0.1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    serviceProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((l: string) => l.trim())
      lines.forEach((line: string) => pushLog(line))
    })

    serviceProcess.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((l: string) => l.trim())
      lines.forEach((line: string) => pushLog(`[stderr] ${line}`))
    })

    serviceProcess.on('error', (err: Error) => {
      pushLog(`[ERROR] Process error: ${err.message}`)
      serviceProcess = null
    })

    serviceProcess.on('exit', (code: number | null, signal: string | null) => {
      pushLog(`Process exited (code=${code}, signal=${signal})`)
      serviceProcess = null
    })

    // 等待 2 秒确认进程还在运行
    await new Promise(resolve => setTimeout(resolve, 2000))
    if (serviceProcess && !serviceProcess.killed) {
      pushLog('✓ Voice service process started. Waiting for HTTP endpoint...')
      return { success: true, pid: serviceProcess.pid }
    }
    return { success: false, error: 'Process exited immediately. Check logs.' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    pushLog(`[ERROR] Failed to start: ${msg}`)
    serviceProcess = null
    return { success: false, error: msg }
  }
})

ipcMain.handle('service:stop', async () => {
  if (!serviceProcess) {
    return { success: true, message: 'Service not running' }
  }
  try {
    pushLog('Stopping voice service...')
    serviceProcess.kill('SIGTERM')
    // 等待 3 秒，如果还没退出则 SIGKILL
    await new Promise(resolve => setTimeout(resolve, 3000))
    if (serviceProcess && !serviceProcess.killed) {
      serviceProcess.kill('SIGKILL')
    }
    serviceProcess = null
    pushLog('✓ Voice service stopped')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    pushLog(`[ERROR] Failed to stop: ${msg}`)
    return { success: false, error: msg }
  }
})

ipcMain.handle('service:status', async () => {
  return {
    running: !!(serviceProcess && !serviceProcess.killed),
    pid: serviceProcess?.pid || null,
  }
})

ipcMain.handle('service:get-logs', async () => {
  return serviceLogs
})

ipcMain.handle('service:clear-logs', async () => {
  serviceLogs = []
  return true
})

// ─── IPC: 设置 ───
ipcMain.handle('settings:get', async () => {
  return loadSettings()
})

ipcMain.handle('settings:set', async (_, settings: AppSettings) => {
  saveSettings(settings)
  return true
})

// ─── IPC: 目录选择 ───
ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

// ─── IPC: 在文件管理器中显示 ───
ipcMain.handle('shell:showItemInFolder', async (_, filePath: string) => {
  shell.showItemInFolder(filePath)
  return true
})

ipcMain.handle('shell:openExternal', async (_, url: string) => {
  shell.openExternal(url)
  return true
})

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })

    // 自动启动服务（如果配置了）
    const settings = loadSettings()
    if (settings.autoStartService && settings.voiceServicePath) {
      // 延迟 1 秒启动，让窗口先渲染
      setTimeout(() => {
        ipcMain.emit('service:start', null, { voiceServicePath: settings.voiceServicePath, pythonPath: settings.pythonPath })
      }, 1000)
    }
  })
}

app.on('window-all-closed', () => {
  // 退出时停止服务
  if (serviceProcess) {
    try {
      serviceProcess.kill('SIGTERM')
    } catch {
      // ignore
    }
    serviceProcess = null
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (serviceProcess) {
    try {
      serviceProcess.kill('SIGTERM')
    } catch {
      // ignore
    }
    serviceProcess = null
  }
})
