/**
 * PodcastAI Desktop - Electron Main Process v1.0.4
 *
 * 内置 Python 运行时 + voice-service，开箱即用
 * - 自动启动内置 voice-service（无需用户安装 Python）
 * - 首次使用时下载 CosyVoice2 模型
 * - 自动管理服务生命周期
 */

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'
import * as https from 'https'
import { spawn, ChildProcess } from 'child_process'

let mainWindow: BrowserWindow | null = null

// ─── 服务进程管理 ───
let serviceProcess: ChildProcess | null = null
let serviceLogs: string[] = []
const MAX_LOGS = 500

// ─── 模型下载状态 ───
interface ModelDownloadState {
  isDownloading: boolean
  currentFile: string
  currentIndex: number
  totalFiles: number
  bytesDownloaded: number
  totalBytes: number
  speed: number // bytes/sec
  error: string | null
}
let modelDownloadState: ModelDownloadState = {
  isDownloading: false,
  currentFile: '',
  currentIndex: 0,
  totalFiles: 0,
  bytesDownloaded: 0,
  totalBytes: 0,
  speed: 0,
  error: null,
}
let modelDownloadAborted = false

function pushLog(line: string) {
  const ts = new Date().toISOString().slice(11, 19)
  const entry = `[${ts}] ${line}`
  serviceLogs.push(entry)
  if (serviceLogs.length > MAX_LOGS) serviceLogs.shift()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('service:log', entry)
  }
}

// ─── 路径工具 ───
function getResourcesDir(): string {
  // 打包后：process.resourcesPath
  // 开发环境：electron 目录
  if (app.isPackaged) {
    return process.resourcesPath
  }
  return path.join(__dirname, '..')
}

function getVoiceRuntimeDir(): string {
  return path.join(getResourcesDir(), 'voice-runtime')
}

function getPythonExe(): string {
  const runtimeDir = getVoiceRuntimeDir()
  if (process.platform === 'win32') {
    return path.join(runtimeDir, 'python', 'python.exe')
  }
  return path.join(runtimeDir, 'python', 'bin', 'python3')
}

function getVoiceServiceDir(): string {
  return path.join(getVoiceRuntimeDir(), 'voice-service')
}

function getMainPy(): string {
  return path.join(getVoiceServiceDir(), 'main.py')
}

function getPythonHome(): string {
  return path.join(getVoiceRuntimeDir(), 'python')
}

function getPythonPath(): string {
  const pyVer = 'python3.10'
  return [
    path.join(getPythonHome(), 'lib', pyVer),
    getVoiceServiceDir(),
  ].join(process.platform === 'win32' ? ';' : ':')
}

function getUserDataDir(): string {
  // voice-service 的用户数据目录（与 main.py 中的逻辑一致）
  const home = app.getPath('home')
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'PodcastAI', 'voice-data')
  } else {
    return path.join(home, 'AppData', 'Roaming', 'PodcastAI', 'voice-data')
  }
}

function getModelDir(): string {
  return path.join(getUserDataDir(), 'models', 'CosyVoice2-0.5B')
}

// ─── 检查内置运行时是否存在 ───
function checkRuntimeExists(): boolean {
  const pythonExe = getPythonExe()
  const mainPy = getMainPy()
  return fs.existsSync(pythonExe) && fs.existsSync(mainPy)
}

// ─── 检查模型是否已下载 ───
const REQUIRED_MODEL_FILES = [
  'llm.pt',
  'flow.pt',
  'hift.pt',
  'flow.encoder.fp16',
  'flow.cache.pt',
  'flow.decoder.estimator.fp32.onnx',
  'speech_tokenizer_v2.batch.onnx',
  'campplus.onnx',
  'cosyvoice2.yaml',
  'configuration.json',
]

function checkModelExists(): { ready: boolean; existing: number; total: number; missing: string[] } {
  const modelDir = getModelDir()
  const existing = []
  const missing = []
  for (const f of REQUIRED_MODEL_FILES) {
    if (fs.existsSync(path.join(modelDir, f))) {
      existing.push(f)
    } else {
      missing.push(f)
    }
  }
  return {
    ready: missing.length === 0,
    existing: existing.length,
    total: REQUIRED_MODEL_FILES.length,
    missing,
  }
}

// ─── 模型下载 ───
// 下载源：HuggingFace 官方 + hf-mirror.com 镜像
const MODEL_DOWNLOAD_URLS = [
  'https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B/resolve/main/',
  'https://hf-mirror.com/FunAudioLLM/CosyVoice2-0.5B/resolve/main/',
]

// 模型文件大小（字节，用于进度显示）
const MODEL_FILE_SIZES: Record<string, number> = {
  'llm.pt': 2040109466,
  'speech_tokenizer_v2.batch.onnx': 495875072,
  'flow.pt': 451887053,
  'flow.cache.pt': 451887053,
  'flow.decoder.estimator.fp32.onnx': 286326784,
  'hift.pt': 83886080,
  'campplus.onnx': 28311552,
  'flow.encoder.fp16': 320,
  'cosyvoice2.yaml': 7372,
  'configuration.json': 47,
}

function downloadFile(url: string, destPath: string, onProgress: (downloaded: number, total: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    let downloaded = 0
    let lastTime = Date.now()
    let lastDownloaded = 0

    const req = https.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          file.close()
          fs.unlinkSync(destPath)
          downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject)
          return
        }
      }
      if (response.statusCode !== 200) {
        file.close()
        fs.unlinkSync(destPath)
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }

      const total = parseInt(response.headers['content-length'] || '0', 10)
      response.on('data', (chunk: Buffer) => {
        if (modelDownloadAborted) {
          req.destroy()
          file.close()
          try { fs.unlinkSync(destPath) } catch {}
          reject(new Error('Aborted'))
          return
        }
        downloaded += chunk.length
        const now = Date.now()
        if (now - lastTime >= 500) {
          const speed = (downloaded - lastDownloaded) / ((now - lastTime) / 1000)
          lastTime = now
          lastDownloaded = downloaded
          onProgress(downloaded, total)
          modelDownloadState.speed = speed
        }
      })
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        onProgress(downloaded, total || downloaded)
        resolve()
      })
    })
    req.on('error', (err) => {
      file.close()
      try { fs.unlinkSync(destPath) } catch {}
      reject(err)
    })
  })
}

async function downloadModelWithFallback(filename: string, destPath: string, onProgress: (downloaded: number, total: number) => void): Promise<void> {
  let lastError: Error | null = null
  for (const baseUrl of MODEL_DOWNLOAD_URLS) {
    try {
      pushLog(`  Trying: ${baseUrl}${filename}`)
      await downloadFile(`${baseUrl}${filename}`, destPath, onProgress)
      pushLog(`  ✓ Downloaded: ${filename}`)
      return
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      pushLog(`  ✗ Failed: ${baseUrl}${filename} - ${lastError.message}`)
      // 如果是 aborted，不尝试下一个源
      if (lastError.message === 'Aborted') throw lastError
    }
  }
  throw lastError || new Error('All download sources failed')
}

function updateDownloadProgress() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('model:download-progress', {
      ...modelDownloadState,
      percent: modelDownloadState.totalBytes > 0
        ? Math.round((modelDownloadState.bytesDownloaded / modelDownloadState.totalBytes) * 100)
        : 0,
    })
  }
}

async function downloadModel(): Promise<{ success: boolean; error?: string }> {
  if (modelDownloadState.isDownloading) {
    return { success: false, error: 'Download already in progress' }
  }

  const modelStatus = checkModelExists()
  if (modelStatus.ready) {
    return { success: true }
  }

  const modelDir = getModelDir()
  fs.mkdirSync(modelDir, { recursive: true })

  // 计算总字节数
  let totalBytes = 0
  for (const f of REQUIRED_MODEL_FILES) {
    totalBytes += MODEL_FILE_SIZES[f] || 0
  }

  modelDownloadAborted = false
  modelDownloadState = {
    isDownloading: true,
    currentFile: '',
    currentIndex: 0,
    totalFiles: REQUIRED_MODEL_FILES.length,
    bytesDownloaded: 0,
    totalBytes,
    speed: 0,
    error: null,
  }

  pushLog(`Starting model download: ${REQUIRED_MODEL_FILES.length} files, ${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB`)

  try {
    for (let i = 0; i < REQUIRED_MODEL_FILES.length; i++) {
      if (modelDownloadAborted) {
        pushLog('Model download aborted')
        modelDownloadState.isDownloading = false
        return { success: false, error: 'Aborted' }
      }

      const filename = REQUIRED_MODEL_FILES[i]
      const destPath = path.join(modelDir, filename)

      // 如果文件已存在且大小匹配，跳过
      if (fs.existsSync(destPath)) {
        const stat = fs.statSync(destPath)
        const expectedSize = MODEL_FILE_SIZES[filename] || 0
        if (expectedSize > 0 && Math.abs(stat.size - expectedSize) < 1024) {
          pushLog(`  ✓ Already exists: ${filename}`)
          modelDownloadState.currentIndex = i + 1
          modelDownloadState.bytesDownloaded += stat.size
          updateDownloadProgress()
          continue
        }
      }

      modelDownloadState.currentFile = filename
      modelDownloadState.currentIndex = i
      pushLog(`  Downloading ${i + 1}/${REQUIRED_MODEL_FILES.length}: ${filename}`)

      const baseDownloaded = modelDownloadState.bytesDownloaded
      await downloadModelWithFallback(filename, destPath, (downloaded, total) => {
        modelDownloadState.bytesDownloaded = baseDownloaded + downloaded
        updateDownloadProgress()
      })

      modelDownloadState.bytesDownloaded = baseDownloaded + (MODEL_FILE_SIZES[filename] || 0)
      modelDownloadState.currentIndex = i + 1
      updateDownloadProgress()
    }

    modelDownloadState.isDownloading = false
    pushLog('✓ Model download complete')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    modelDownloadState.isDownloading = false
    modelDownloadState.error = msg
    pushLog(`✗ Model download failed: ${msg}`)
    return { success: false, error: msg }
  }
}

// ─── 启动服务 ───
async function startVoiceService(): Promise<{ success: boolean; pid?: number; error?: string }> {
  if (serviceProcess) {
    return { success: false, error: 'Service is already running' }
  }

  if (!checkRuntimeExists()) {
    return { success: false, error: 'Voice runtime not found. Please reinstall the app.' }
  }

  const pythonExe = getPythonExe()
  const mainPy = getMainPy()
  const cwd = getVoiceServiceDir()

  pushLog('Starting voice service...')
  pushLog(`  Python: ${pythonExe}`)
  pushLog(`  Script: ${mainPy}`)
  pushLog(`  Port: 8907`)

  try {
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      PYTHONHOME: getPythonHome(),
      PYTHONPATH: getPythonPath(),
      PODCASTAI_DESKTOP: '1',
      VOICE_SERVICE_PORT: '8907',
      no_proxy: 'localhost,127.0.0.1',
      NO_PROXY: 'localhost,127.0.0.1',
    }

    serviceProcess = spawn(pythonExe, [mainPy], {
      cwd,
      env,
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
      pushLog('✓ Voice service process started')
      return { success: true, pid: serviceProcess.pid }
    }
    return { success: false, error: 'Process exited immediately. Check logs.' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    pushLog(`[ERROR] Failed to start: ${msg}`)
    serviceProcess = null
    return { success: false, error: msg }
  }
}

async function stopVoiceService(): Promise<{ success: boolean; error?: string }> {
  if (!serviceProcess) {
    return { success: true }
  }
  try {
    pushLog('Stopping voice service...')
    serviceProcess.kill('SIGTERM')
    await new Promise(resolve => setTimeout(resolve, 2000))
    if (serviceProcess && !serviceProcess.killed) {
      serviceProcess.kill('SIGKILL')
    }
    serviceProcess = null
    pushLog('✓ Voice service stopped')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

// ─── HTTP 健康检查 ───
async function checkServiceHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:8907/health', (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json.status === 'ok')
        } catch {
          resolve(false)
        }
      })
    })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function waitForService(maxWaitMs: number = 30000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    if (await checkServiceHealth()) return true
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  return false
}

// ─── 向后兼容 IPC handlers ───
// 旧版 renderer.js 仍会调用 service:detect / settings / dialog:openDirectory 等 API
// 这些 API 在 v1.0.4 中已不再需要（运行时内置），但为了不破坏旧 UI，返回兼容数据

ipcMain.handle('service:detect', async () => {
  // 返回兼容数据：表示"已就绪"
  const runtimeExists = checkRuntimeExists()
  const modelStatus = checkModelExists()
  return {
    python: runtimeExists ? 'built-in' : null,
    pythonVersion: runtimeExists ? '3.10.20 (built-in)' : null,
    venvPython: runtimeExists ? getPythonExe() : null,
    voiceServicePath: runtimeExists ? getVoiceServiceDir() : null,
    hasMainPy: runtimeExists,
    hasVenv: runtimeExists,
    hasModels: modelStatus.ready,
    platform: process.platform,
  }
})

ipcMain.handle('settings:get', async () => {
  // v1.0.4 不再需要用户配置环境，返回默认值
  return {
    voiceServicePath: getVoiceServiceDir(),
    pythonPath: getPythonExe(),
    autoStartService: true, // 始终自动启动
  }
})

ipcMain.handle('settings:set', async () => {
  // 忽略设置（已内置）
  return true
})

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('shell:showItemInFolder', async (_, filePath: string) => {
  shell.showItemInFolder(filePath)
  return true
})

// ─── 窗口创建 ───
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
ipcMain.handle('service:start', async () => {
  const result = await startVoiceService()
  if (result.success) {
    // 等待 HTTP 端点就绪
    const ready = await waitForService(30000)
    if (ready) {
      pushLog('✓ Service HTTP endpoint ready')
    } else {
      pushLog('⚠ Service process started but HTTP endpoint not ready yet')
    }
  }
  return result
})

ipcMain.handle('service:stop', async () => {
  return await stopVoiceService()
})

ipcMain.handle('service:status', async () => {
  const running = !!(serviceProcess && !serviceProcess.killed)
  const healthOk = running ? await checkServiceHealth() : false
  return {
    running,
    healthOk,
    pid: serviceProcess?.pid || null,
    runtimeExists: checkRuntimeExists(),
  }
})

ipcMain.handle('service:get-logs', async () => {
  return serviceLogs
})

ipcMain.handle('service:clear-logs', async () => {
  serviceLogs = []
  return true
})

// ─── IPC: 模型管理 ───
ipcMain.handle('model:status', async () => {
  return checkModelExists()
})

ipcMain.handle('model:download', async () => {
  const result = await downloadModel()
  return result
})

ipcMain.handle('model:abort-download', async () => {
  modelDownloadAborted = true
  return true
})

ipcMain.handle('model:get-download-state', async () => {
  return {
    ...modelDownloadState,
    percent: modelDownloadState.totalBytes > 0
      ? Math.round((modelDownloadState.bytesDownloaded / modelDownloadState.totalBytes) * 100)
      : 0,
  }
})

ipcMain.handle('model:open-dir', async () => {
  const modelDir = getModelDir()
  if (fs.existsSync(modelDir)) {
    shell.openPath(modelDir)
  } else {
    shell.openPath(path.dirname(modelDir))
  }
  return true
})

// ─── IPC: shell ───
ipcMain.handle('shell:openExternal', async (_, url: string) => {
  shell.openExternal(url)
  return true
})

// ─── 单实例锁 + 自动启动 ───
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.whenReady().then(async () => {
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })

    // 自动启动服务
    if (checkRuntimeExists()) {
      pushLog('Auto-starting voice service...')
      const result = await startVoiceService()
      if (result.success) {
        pushLog('✓ Voice service auto-started')
      } else {
        pushLog(`✗ Auto-start failed: ${result.error}`)
      }

      // 自动下载模型（如果未下载且当前没有在下载）
      const modelStatus = checkModelExists()
      if (!modelStatus.ready && !modelDownloadState.isDownloading) {
        pushLog('Auto-downloading CosyVoice2 model...')
        // 异步下载，不阻塞应用启动
        downloadModel().then((result) => {
          if (result.success) {
            pushLog('✓ Model auto-download complete')
          } else {
            pushLog(`✗ Model auto-download failed: ${result.error}`)
          }
        }).catch((err) => {
          pushLog(`✗ Model auto-download error: ${err}`)
        })
      }
    } else {
      pushLog('⚠ Voice runtime not found, service not started')
    }
  })
}

app.on('window-all-closed', () => {
  if (serviceProcess) {
    try { serviceProcess.kill('SIGTERM') } catch {}
    serviceProcess = null
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  if (serviceProcess) {
    try { serviceProcess.kill('SIGTERM') } catch {}
    serviceProcess = null
  }
})
