/**
 * PodcastAI Desktop - Electron Main Process v1.0.32
 *
 * 内置 Python 运行时 + voice-service + CosyVoice2 模型，开箱即用
 * - 自动启动内置 voice-service（无需用户安装 Python）
 * - 内置 CosyVoice2 模型（无需首次下载）
 * - 自动管理服务生命周期
 * - v1.0.31: 强制注册登录 + Web 端校验打通（基于 packages/auth/desktop-bridge 设计）
 *            - 注册 deep-link scheme: podcastai://
 *            - 启动本地回调服务器接收 token
 *            - token 安全存储（safeStorage 加密）
 *            - 应用启动必须先登录，跳转 Web 端验证后回到桌面端
 * - v1.0.32: 克隆音色播客生成三问题修复
 *            - 平滑增益包络 + tanh 软限幅，消除"呲呲呲"调制噪声
 *            - 英文/混合文本改用 inference_cross_lingual，提升英文发音自然度
 *            - ref_text 按句子边界截断 + 口头禅清理，消除"可不"复读
 */

import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'
import * as https from 'https'
import { spawn, ChildProcess } from 'child_process'

// ─── v1.0.31 认证系统常量 ───
// Web 端部署地址（用于跳转登录）
const WEB_APP_URL = 'https://podcastai-plum.vercel.app'
// Deep-link scheme，用于浏览器登录后回跳桌面端
const DESKTOP_SCHEME = 'podcastai'
// token 安全存储文件名
const AUTH_STORE_FILE = 'auth.dat'

let mainWindow: BrowserWindow | null = null

// ─── 服务进程管理 ───
let serviceProcess: ChildProcess | null = null
let serviceLogs: string[] = []
const MAX_LOGS = 500

// v1.0.28: 进程崩溃自动重启机制
// 后端 Python 进程在合成时可能因 OOM/segfault 崩溃，导致前端 "BodyStreamBuffer was aborted"
// 自动重启确保服务能在崩溃后快速恢复，配合前端重试机制实现"无感知"恢复
let autoRestart = true           // 是否允许自动重启（用户主动停止时设为 false）
let restartCount = 0             // 当前重启次数
const MAX_RESTART_COUNT = 3      // 最大重启次数（避免无限重启）
const RESTART_COOLDOWN_MS = 5000 // 重启冷却时间（避免快速循环）
let lastRestartTime = 0          // 上次重启时间戳

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
  const voiceServiceDir = getVoiceServiceDir()
  return [
    path.join(getPythonHome(), 'lib', pyVer),
    voiceServiceDir,
    // CosyVoice 依赖的第三方包（matcha 等）
    path.join(voiceServiceDir, 'CosyVoice', 'third_party', 'Matcha-TTS'),
  ].join(process.platform === 'win32' ? ';' : ':')
}

function getUserDataDir(): string {
  // voice-service 的用户数据目录
  // v1.0.5: python-build-standalone 二进制是 adhoc 签名，macOS TCC 会限制它写 ~/Library
  // 改用 Electron 能控制的目录，由主进程预先创建并授权
  // 优先使用 ~/Library/Caches/PodcastAI（macOS 允许 adhoc 签名进程写入缓存目录）
  const home = app.getPath('home')
  if (process.platform === 'darwin') {
    const cacheDir = path.join(home, 'Library', 'Caches', 'PodcastAI', 'voice-data')
    // 主进程预先创建目录，子进程才能写
    try {
      fs.mkdirSync(cacheDir, { recursive: true })
      fs.mkdirSync(path.join(cacheDir, 'clones'), { recursive: true })
      fs.mkdirSync(path.join(cacheDir, 'output'), { recursive: true })
    } catch {}
    return cacheDir
  } else {
    return path.join(home, 'AppData', 'Roaming', 'PodcastAI', 'voice-data')
  }
}

function getModelDir(): string {
  // 优先使用打包的模型目录（开箱即用）
  const packagedModelDir = path.join(getVoiceRuntimeDir(), 'models', 'CosyVoice2-0.5B')
  if (fs.existsSync(packagedModelDir)) {
    // 检查打包目录是否包含完整的模型文件
    const hasLLM = fs.existsSync(path.join(packagedModelDir, 'llm.pt'))
    if (hasLLM) {
      return packagedModelDir
    }
  }
  // 回退到用户数据目录（用于在线下载补全）
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

// flow.encoder.fp16 是目录而非单文件，无法通过单文件下载补全
const MODEL_DIR_ENTRIES = new Set(['flow.encoder.fp16'])

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
  'flow.encoder.fp16': 117440512, // 目录，约 112MB
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

      // 目录类型条目（如 flow.encoder.fp16）无法通过单文件下载补全
      // 这些条目应随安装包内置；若缺失，提示用户重新安装应用
      if (MODEL_DIR_ENTRIES.has(filename)) {
        if (fs.existsSync(destPath)) {
          pushLog(`  ✓ Already exists (dir): ${filename}`)
          modelDownloadState.currentIndex = i + 1
          modelDownloadState.bytesDownloaded += MODEL_FILE_SIZES[filename] || 0
          updateDownloadProgress()
          continue
        } else {
          pushLog(`  ✗ Missing directory: ${filename} — please reinstall the app`)
          modelDownloadState.currentIndex = i + 1
          modelDownloadState.bytesDownloaded += MODEL_FILE_SIZES[filename] || 0
          updateDownloadProgress()
          continue
        }
      }

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

  // v1.0.28: 启动时重新允许自动重启
  autoRestart = true

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
      // 关键：把打包的模型目录传给 Python，避免 Python 回退到用户数据目录
      COSYVOICE_MODEL_DIR: getModelDir(),
      // v1.0.5: 显式指定数据目录，确保 Electron 沙盒环境下有写权限
      VOICE_DATA_DIR: getUserDataDir(),
      // v1.0.5: MPS 不支持 aten::unfold_backward，启用 CPU 回退（hifigan 的 istft 会用到）
      PYTORCH_ENABLE_MPS_FALLBACK: '1',
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
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('service:state-changed', { ready: false })
      }
    })

    serviceProcess.on('exit', (code: number | null, signal: string | null) => {
      pushLog(`Process exited (code=${code}, signal=${signal})`)
      const wasCrash = code !== 0 && code !== null
      serviceProcess = null
      // 通知渲染进程：进程已退出，状态变更
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('service:state-changed', { ready: false, crashed: wasCrash })
      }

      // v1.0.28: 进程崩溃时自动重启
      // code=0 是正常退出，signal='SIGTERM' 是主动停止，这两种情况不重启
      // 其他情况（OOM segfault 等）自动重启，最多 MAX_RESTART_COUNT 次
      if (autoRestart && wasCrash && signal !== 'SIGTERM') {
        const now = Date.now()
        if (now - lastRestartTime < RESTART_COOLDOWN_MS) {
          pushLog(`Restart too soon (cooldown), skipping auto-restart`)
          return
        }
        if (restartCount >= MAX_RESTART_COUNT) {
          pushLog(`Max restart count (${MAX_RESTART_COUNT}) reached, giving up`)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('service:restart-failed', {
              reason: '达到最大重启次数，服务持续崩溃',
              restartCount,
            })
          }
          return
        }
        restartCount++
        lastRestartTime = now
        pushLog(`⚠️ Service crashed unexpectedly, auto-restarting (${restartCount}/${MAX_RESTART_COUNT})...`)
        // 异步重启，不阻塞当前 exit 回调
        setTimeout(async () => {
          try {
            const result = await startVoiceService()
            if (result.success) {
              pushLog(`✓ Service auto-restarted successfully (attempt ${restartCount})`)
              // 重置计数器：如果重启后稳定运行，允许未来再次崩溃时重启
              setTimeout(() => { restartCount = 0 }, 60000)
            } else {
              pushLog(`✗ Auto-restart failed: ${result.error}`)
            }
          } catch (e) {
            pushLog(`✗ Auto-restart error: ${e instanceof Error ? e.message : String(e)}`)
          }
        }, 2000)
      }
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
    // v1.0.28: 用户主动停止，禁止自动重启
    autoRestart = false
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

// ════════════════════════════════════════════════════════════
// v1.0.31 认证系统：Deep-link + 本地回调服务器 + Token 安全存储
// ════════════════════════════════════════════════════════════

// 本地回调服务器（接收 Web 端 POST 的 token）
let callbackServer: http.Server | null = null
let callbackPort = 0  // 0 = 未启动，动态分配端口

// 内存中的认证状态
interface AuthState {
  token: string | null
  refreshToken: string | null
  email: string | null
  userId: string | null
  name: string | null
}
let authState: AuthState = { token: null, refreshToken: null, email: null, userId: null, name: null }

/**
 * 获取认证数据存储路径（加密存储）
 */
function getAuthStorePath(): string {
  return path.join(app.getPath('userData'), AUTH_STORE_FILE)
}

/**
 * 判断 safeStorage 是否可用（macOS Keychain / Windows DPAPI / Linux libsecret）
 */
function isSafeStorageAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/**
 * 持久化认证状态到加密文件
 * safeStorage 不可用时回退到明文存储（仅本地，不传输）
 */
function saveAuthState(state: AuthState): boolean {
  try {
    const json = JSON.stringify(state)
    const buf = Buffer.from(json, 'utf-8')
    let outBuf: Buffer
    if (isSafeStorageAvailable()) {
      outBuf = safeStorage.encryptString(json)
    } else {
      // 回退：base64 编码（不是真正的加密，但避免明文）
      outBuf = Buffer.from(buf.toString('base64'), 'utf-8')
    }
    fs.writeFileSync(getAuthStorePath(), outBuf)
    return true
  } catch (err) {
    pushLog(`[AUTH] Failed to save auth state: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

/**
 * 从加密文件加载认证状态
 */
function loadAuthState(): AuthState | null {
  try {
    const filePath = getAuthStorePath()
    if (!fs.existsSync(filePath)) return null
    const buf = fs.readFileSync(filePath)
    let json: string
    if (isSafeStorageAvailable()) {
      json = safeStorage.decryptString(buf)
    } else {
      json = Buffer.from(buf.toString('utf-8'), 'base64').toString('utf-8')
    }
    const parsed = JSON.parse(json) as AuthState
    if (!parsed || typeof parsed !== 'object') return null
    return {
      token: parsed.token || null,
      refreshToken: parsed.refreshToken || null,
      email: parsed.email || null,
      userId: parsed.userId || null,
      name: parsed.name || null,
    }
  } catch (err) {
    pushLog(`[AUTH] Failed to load auth state: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

/**
 * 清除认证状态（持久化文件 + 内存）
 */
function clearAuthState() {
  authState = { token: null, refreshToken: null, email: null, userId: null, name: null }
  try {
    const filePath = getAuthStorePath()
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {}
}

/**
 * 设置新的认证状态并持久化
 */
function setAuthState(state: AuthState): boolean {
  authState = { ...state }
  return saveAuthState(authState)
}

/**
 * 启动本地 HTTP 回调服务器，监听 127.0.0.1:随机端口
 * Web 端登录成功后会 POST { token, refreshToken, email, userId, name } 到此服务器
 *
 * 安全策略：
 * - 只监听 loopback 接口（127.0.0.1）
 * - 设置 CORS 允许 Web 端来源
 * - 仅接受 POST / 请求
 */
function startCallbackServer(): Promise<boolean> {
  return new Promise((resolve) => {
    if (callbackServer) {
      resolve(true)
      return
    }

    callbackServer = http.createServer((req, res) => {
      // CORS 头：允许 Web 端跨域 POST
      const origin = req.headers.origin
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      }
      // 处理预检请求
      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }
      // 健康检查
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, port: callbackPort }))
        return
      }
      // 仅接受 POST / 请求
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Method not allowed' }))
        return
      }

      let body = ''
      req.on('data', (chunk) => {
        body += chunk.toString()
        // 防止过大请求
        if (body.length > 64 * 1024) {
          res.writeHead(413)
          res.end('Payload too large')
          req.destroy()
        }
      })
      req.on('end', () => {
        try {
          const payload = JSON.parse(body) as AuthState
          if (!payload || !payload.token) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Token is required' }))
            return
          }
          // 保存 token
          const ok = setAuthState(payload)
          if (ok) {
            pushLog(`[AUTH] Token received from web login (email=${payload.email || 'unknown'})`)
            // 通知渲染进程：登录成功
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('auth:login-success', {
                token: payload.token,
                email: payload.email,
                name: payload.name,
                userId: payload.userId,
              })
            }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Failed to persist token' }))
          }
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid JSON' }))
        }
      })
    })

    // 监听随机端口（0 = 系统分配）
    callbackServer.on('error', (err) => {
      pushLog(`[AUTH] Callback server error: ${err.message}`)
      callbackServer = null
      resolve(false)
    })

    callbackServer.listen(0, '127.0.0.1', () => {
      const addr = callbackServer?.address()
      if (addr && typeof addr === 'object') {
        callbackPort = addr.port
        pushLog(`[AUTH] Callback server listening on http://127.0.0.1:${callbackPort}`)
        resolve(true)
      } else {
        pushLog(`[AUTH] Failed to get callback server port`)
        resolve(false)
      }
    })
  })
}

/**
 * 停止本地回调服务器
 */
function stopCallbackServer() {
  if (callbackServer) {
    try {
      callbackServer.close()
    } catch {}
    callbackServer = null
    callbackPort = 0
  }
}

/**
 * 获取本地回调 URL（供 Web 端 POST token）
 * 格式：http://127.0.0.1:port
 */
function getCallbackUrl(): string {
  if (callbackPort > 0) {
    return `http://127.0.0.1:${callbackPort}`
  }
  return ''
}

/**
 * 构造 Web 端登录 URL，附加桌面端回调参数
 * 格式：{WEB_APP_URL}/login?mode=desktop&callbackUrl=http://127.0.0.1:port&scheme=podcastai
 */
function buildWebLoginUrl(): string {
  const callbackUrl = getCallbackUrl()
  const params = new URLSearchParams()
  params.set('mode', 'desktop')
  if (callbackUrl) {
    params.set('callbackUrl', callbackUrl)
  }
  params.set('scheme', DESKTOP_SCHEME)
  return `${WEB_APP_URL}/login?${params.toString()}`
}

/**
 * 处理 deep-link 回调：podcastai://login-success?token=...
 * 浏览器登录成功后通过 deep-link 回跳桌面端
 */
function handleDeepLink(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== `${DESKTOP_SCHEME}:`) return
    if (parsed.host !== 'login-success') return

    const params = parsed.searchParams
    const token = params.get('token')
    if (!token) {
      pushLog(`[AUTH] Deep-link missing token: ${url}`)
      return
    }

    const payload: AuthState = {
      token,
      refreshToken: params.get('refreshToken') || null,
      email: params.get('email') || null,
      userId: params.get('userId') || null,
      name: params.get('name') || null,
    }

    const ok = setAuthState(payload)
    if (ok) {
      pushLog(`[AUTH] Deep-link login success (email=${payload.email || 'unknown'})`)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auth:login-success', {
          token: payload.token,
          email: payload.email,
          name: payload.name,
          userId: payload.userId,
        })
        // 把窗口带到前台
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.show()
        mainWindow.focus()
      }
    }
  } catch (err) {
    pushLog(`[AUTH] Failed to handle deep-link: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ─── v1.0.31 IPC: 认证 ───

// 获取当前认证状态（token + 用户信息）
ipcMain.handle('auth:getState', async () => {
  return {
    token: authState.token,
    refreshToken: authState.refreshToken,
    email: authState.email,
    userId: authState.userId,
    name: authState.name,
    callbackUrl: getCallbackUrl(),
    webLoginUrl: buildWebLoginUrl(),
  }
})

// 打开 Web 端登录页（系统浏览器）
ipcMain.handle('auth:openWebLogin', async () => {
  const url = buildWebLoginUrl()
  if (!url) {
    return { success: false, error: 'Callback server not started' }
  }
  try {
    await shell.openExternal(url)
    pushLog(`[AUTH] Opened web login: ${url}`)
    return { success: true, url }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

// 清除认证状态（退出登录）
ipcMain.handle('auth:signOut', async () => {
  clearAuthState()
  pushLog('[AUTH] User signed out')
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth:logout', {})
  }
  return { success: true }
})

// 手动设置 token（用于本地 HTTP 回调服务器的备用通道）
ipcMain.handle('auth:deliverToken', async (_, payload: AuthState) => {
  if (!payload || !payload.token) {
    return { success: false, error: 'Token is required' }
  }
  const ok = setAuthState(payload)
  if (ok) {
    pushLog(`[AUTH] Token delivered via IPC (email=${payload.email || 'unknown'})`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:login-success', {
        token: payload.token,
        email: payload.email,
        name: payload.name,
        userId: payload.userId,
      })
    }
  }
  return { success: ok }
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

// v1.0.17: 保存音频文件到用户选择的路径（可靠的下载方式）
// 渲染进程通过 IPC 传输 ArrayBuffer，主进程写入文件，避免 blob URL 下载在 Electron 中失效
ipcMain.handle('dialog:saveFile', async (_, defaultName: string, buffer: ArrayBuffer) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'WAV Audio', extensions: ['wav'] }],
  })
  if (canceled || !filePath) return { success: false, canceled: true }
  try {
    require('fs').writeFileSync(filePath, Buffer.from(buffer))
    return { success: true, filePath }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})

// ─── 单实例锁 + 自动启动 ───
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  // v1.0.31: 注册 deep-link scheme（必须在 app.ready 之前调用）
  app.setAsDefaultProtocolClient(DESKTOP_SCHEME)

  // v1.0.31: macOS 下通过 open-url 事件接收 deep-link（应用已运行时）
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })

  // v1.0.31: Windows/Linux 下通过 second-instance 事件接收 deep-link
  // 当应用已在运行时，第二个实例启动时会触发此事件
  app.on('second-instance', (event, argv) => {
    event.preventDefault()
    // 从命令行参数中查找 deep-link URL
    const deepLink = argv.find((arg) => arg.startsWith(`${DESKTOP_SCHEME}://`))
    if (deepLink) {
      handleDeepLink(deepLink)
    }
    // 把窗口带到前台
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })

    // v1.0.31: 启动本地回调服务器（接收 Web 端 POST 的 token）
    await startCallbackServer()

    // v1.0.31: 加载持久化的认证状态
    const persisted = loadAuthState()
    if (persisted && persisted.token) {
      authState = persisted
      pushLog(`[AUTH] Loaded persisted token (email=${authState.email || 'unknown'})`)
    } else {
      pushLog('[AUTH] No persisted token, user must login')
    }

    // 自动启动服务
    if (checkRuntimeExists()) {
      pushLog('Auto-starting voice service...')
      const result = await startVoiceService()
      if (result.success) {
        pushLog('✓ Voice service process started, waiting for HTTP ready...')
        // 等待 HTTP 端点就绪（最长 120 秒，CosyVoice2 首次加载较慢）
        const ready = await waitForService(120000)
        if (ready) {
          pushLog('✓ Voice service HTTP endpoint ready')
        } else {
          pushLog('⚠ Voice service HTTP endpoint not ready after 120s. Check logs for errors.')
        }
        // 通知渲染进程服务状态已更新
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('service:state-changed', { ready })
        }
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
  // v1.0.31: 关闭回调服务器
  stopCallbackServer()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  if (serviceProcess) {
    try { serviceProcess.kill('SIGTERM') } catch {}
    serviceProcess = null
  }
  // v1.0.31: 关闭回调服务器
  stopCallbackServer()
})
