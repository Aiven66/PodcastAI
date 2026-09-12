/**
 * PodcastAI Desktop - Electron Main Process v1.0.57
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
 * - v1.0.34: 修复桌面端登录回跳问题
 *            - POST 回调收到 token 时也把窗口带到前台（之前只 deep-link 才会）
 *            - Web 端登录成功页添加"返回桌面客户端"手动按钮（浏览器可能阻止自动 deep-link）
 * - v1.0.38: 声音克隆试听语言自适应 + 桌面客户端登录账号显示
 *            - 克隆完成后试听，根据参考音频语言自动选择预览文本
 *              （中文/英文/日文/韩文），不再硬编码英文
 *            - 主界面侧边栏显示当前登录账号信息（头像首字母+邮箱+退出按钮）
 * - v1.0.50: 彻底解决 LLM 复读循环和脚本幻觉问题
 *            - 动态替换 self.llm.sampling 为严格采样函数（argmax + RAS 双保险）
 *              解决 cosyvoice2.yaml 中 ras_sampling 参数被硬编码无法调整的问题
 *            - 增强三重 token 重复检测：循环 pattern / 长 n-gram / 单 token 高频
 *            - 短文本（克隆预览）专用 max_total_tokens 上限（120 token / 4.8 秒）
 *            - 文本清理新增"以前"、"后来"、"之前"等高频历史时间词
 *            - cosyvoice2.yaml 调严 ras_sampling：top_p 0.8→0.5, top_k 25→10,
 *              win_size 10→20, tau_r 0.1→0.25
 * - v1.0.53: 彻底解决播客音频重复词问题（"得了"、"以前"等）
 *            - model.py 新增 n-gram 频率检测（3-8长度 n-gram 在80 token窗口内出现3次即拦截）
 *              之前仅检测尾部循环 pattern，漏检非循环重复（如"得了...得了...得了"）
 *            - cosyvoice2.yaml 收紧采样：top_p 0.6→0.5, top_k 15→10, win_size 10→15, tau_r 0.25→0.15
 *            - max_token_text_ratio 5→4，max_total_tokens 倍率 6→5，减少模型多余生成
 *            - common.py 默认参数同步收紧（安全网）
 *            - 修正注释：cosyvoice2.yaml 的 sampling 参数通过 ras_sampling 默认参数绑定生效
 *              之前注释错误地说参数被忽略
 * - v1.0.57: 彻底解决播客音频重复词问题（"得了""以前""当时"三连杀）
 *            - 逐句合成顺序反转：先试 strict_clone=False（instruct2）→
 *              失败再回 strict_clone=True（zero_shot）
 *              根因：zero_shot 深度模仿参考音频说话习惯（包括口头禅），
 *              instruct2 只复制音色不复制习惯，从根源避免复读
 *            - 文本清洗策略大改：不再"同义词替换"（"以前"→"当时"结果"当时"又复读），
 *              改为"彻底删除"所有时间词 + 口头禅 + 连词语气词
 *            - model.py 重复检测三重增强：
 *              n-gram 长度 3-8→2-8（捕获"得了"这种 2 token 词）
 *              窗口 80→100 token，次数 ≥3→≥2 次触发
 *              新增单 token 高频检测（4 次/100 窗口即拦截）
 * - v1.0.78: 彻底修复桌面端 ↔ Web 端登录链路三断点
 *            - macOS 关窗后回调服务器被停掉、Dock 重开不重启 →
 *              登录 URL 缺 callbackUrl（日志 07:38:49 铁证）→ token 无处回传。
 *              修复：activate 重开窗口时自动重启回调服务器；
 *              openWebLogin 前若服务器未运行先兜底启动
 *            - 网页端 /login?mode=desktop 默认展示"桌面客户端验证"tab（循环流程）
 *              而非登录表单 → 用户卡在验证界面。
 *              修复：Web 端 desktop 流程默认"登录"tab 并隐藏桌面端 tab
 *            - 反向流程 podcastai://auth（网页"启动桌面客户端"）无任何处理 →
 *              网页卡"等待桌面客户端响应"5 分钟超时。
 *              修复：已登录立即回传 token；未登录挂起，桌面端登录成功后
 *              自动打开 redirect URL 回传，网页端自动完成登录
 *            - safeStorage 在 adhoc 签名应用中跨进程不稳定（A 进程可加密、
 *              B 进程不可用）→ 保存时加密、重启后解不开 → auth.dat 被删、
 *              每次重启都要重新登录。
 *              修复：token 统一 base64 存储（与 keychain 无关，重启/更新后
 *              100% 可恢复）；加载时兼容解密旧 safeStorage 格式
 */

import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'
import * as https from 'https'
import { spawn, execFile, ChildProcess } from 'child_process'

// ─── v1.0.31 认证系统常量 ───
// Web 端部署地址（用于跳转登录）
const WEB_APP_URL = 'https://podcastai.clipopai.com'
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

// ─── v1.0.79: Python 运行时下载状态 ───
type RuntimeStage = 'idle' | 'download' | 'extract' | 'verify' | 'done'

interface RuntimeDownloadState {
  isDownloading: boolean
  stage: RuntimeStage
  bytesDownloaded: number
  totalBytes: number
  speed: number // bytes/sec
  error: string | null
  installed: boolean
}
let runtimeDownloadState: RuntimeDownloadState = {
  isDownloading: false,
  stage: 'idle',
  bytesDownloaded: 0,
  totalBytes: 0,
  speed: 0,
  error: null,
  installed: false,
}
let runtimeDownloadAborted = false

// 运行时归档下载源（GitHub Release 主源 + 预留镜像回退，与 MODEL_DOWNLOAD_URLS 同构）
// v1.0.78: 按平台/架构选择对应归档（mac 用 python/bin/python3，win 用 python/python.exe）
// 运行时归档与安装包统一放在 1.0.78 release 下分发
const RUNTIME_RELEASE_BASE = 'https://github.com/Aiven66/PodcastAI/releases/download/1.0.78'
const RUNTIME_ARCHIVE_VERSION = '3.10.20-20260623'

function getRuntimeArchiveUrl(): string {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const osName = process.platform === 'win32' ? 'win' : 'mac'
  return `${RUNTIME_RELEASE_BASE}/python-runtime-${osName}-${arch}-${RUNTIME_ARCHIVE_VERSION}.tar.gz`
}

// 预留镜像回退（主源失败时依次尝试；后续可追加 CDN 镜像地址）
const RUNTIME_DOWNLOAD_URLS: string[] = [getRuntimeArchiveUrl()]

function pushLog(line: string) {
  const ts = new Date().toISOString().slice(11, 19)
  const entry = `[${ts}] ${line}`
  serviceLogs.push(entry)
  if (serviceLogs.length > MAX_LOGS) serviceLogs.shift()
  // v1.0.36: 同时写入文件日志，便于诊断打包后的问题
  try {
    const logDir = path.join(app.getPath('home'), 'Library', 'Logs', 'podcastai-desktop')
    fs.mkdirSync(logDir, { recursive: true })
    fs.appendFileSync(path.join(logDir, 'main.log'), entry + '\n')
  } catch {}
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
  // v1.0.79: 仅内置只读的 voice-service 源码；python 与模型改为按需下载到可写用户目录
  return path.join(getResourcesDir(), 'voice-runtime')
}

/**
 * v1.0.79: Python 运行时基目录解析
 * 打包后 Resources/voice-runtime 只读且不再内置 python；
 * 优先命中内置 python（开发模式兜底），否则回退到按需下载的用户目录。
 */
function getPythonBaseDir(): string {
  const bundled = path.join(getVoiceRuntimeDir(), 'python')
  const pyExe = process.platform === 'win32'
    ? path.join(bundled, 'python', 'python.exe')
    : path.join(bundled, 'python', 'bin', 'python3')
  if (fs.existsSync(pyExe)) {
    return bundled
  }
  return getPythonRuntimeDir()
}

/** v1.0.79: python 运行时可写安装目录（下载解压后的父目录，内含 python/） */
function getPythonRuntimeDir(): string {
  return path.join(getUserDataDir(), 'python-runtime')
}

function getPythonExe(): string {
  const pythonHome = getPythonHome()
  if (process.platform === 'win32') {
    return path.join(pythonHome, 'python.exe')
  }
  return path.join(pythonHome, 'bin', 'python3')
}

function getVoiceServiceDir(): string {
  return path.join(getVoiceRuntimeDir(), 'voice-service')
}

function getMainPy(): string {
  return path.join(getVoiceServiceDir(), 'main.py')
}

function getPythonHome(): string {
  return path.join(getPythonBaseDir(), 'python')
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

type DownloadFileOptions = {
  getAborted?: () => boolean
  onSpeed?: (speed: number) => void
}

function downloadFile(url: string, destPath: string, onProgress: (downloaded: number, total: number) => void, opts: DownloadFileOptions = {}): Promise<void> {
  const getAborted = opts.getAborted || (() => modelDownloadAborted)
  const onSpeed = opts.onSpeed || (() => {})
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
          downloadFile(redirectUrl, destPath, onProgress, opts).then(resolve).catch(reject)
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
        if (getAborted()) {
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
          onSpeed(speed)
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

// ─── v1.0.79: 目录型模型条目（如 flow.encoder.fp16）的 HF tree API 文件枚举 ───
interface HFRepoFile { rfilename: string; type: string }
const MODEL_REPO_ID = 'FunAudioLLM/CosyVoice2-0.5B'

function hfListDir(url: string): Promise<HFRepoFile[]> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        const loc = res.headers.location
        res.resume()
        if (loc) { hfListDir(loc).then(resolve).catch(reject); return }
        reject(new Error('Redirect without location'))
        return
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return }
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => {
        try {
          resolve(JSON.parse(body) as HFRepoFile[])
        } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

async function listModelDirFiles(dirName: string): Promise<string[]> {
  const apiUrls = [
    `https://huggingface.co/api/models/${MODEL_REPO_ID}/tree/main/${dirName}?recursive=true&expand=false`,
    `https://hf-mirror.com/api/models/${MODEL_REPO_ID}/tree/main/${dirName}?recursive=true&expand=false`,
  ]
  for (const api of apiUrls) {
    try {
      const list = await hfListDir(api)
      const files = list.filter((f) => f.type === 'file').map((f) => f.rfilename)
      if (files.length > 0) return files
      pushLog(`  ⚠ Empty listing from ${api}`)
    } catch (e) {
      pushLog(`  ✗ listModelDirFiles failed on ${api}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  throw new Error(`Failed to list model directory: ${dirName}`)
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

      // 目录类型条目（如 flow.encoder.fp16）：通过 HF tree API 枚举后逐文件下载
      // v1.0.79: 不再内置模型，目录必须能按需补全
      if (MODEL_DIR_ENTRIES.has(filename)) {
        if (modelDownloadAborted) {
          pushLog('Model download aborted')
          modelDownloadState.isDownloading = false
          return { success: false, error: 'Aborted' }
        }
        fs.mkdirSync(destPath, { recursive: true })
        const dirFiles = await listModelDirFiles(filename)
        pushLog(`  Listing directory ${filename}: ${dirFiles.length} files`)
        for (const rel of dirFiles) {
          if (modelDownloadAborted) {
            pushLog('Model download aborted')
            modelDownloadState.isDownloading = false
            return { success: false, error: 'Aborted' }
          }
          const destFile = path.join(destPath, rel)
          if (fs.existsSync(destFile)) {
            modelDownloadState.currentIndex = i + 1
            continue
          }
          fs.mkdirSync(path.dirname(destFile), { recursive: true })
          modelDownloadState.currentFile = `${filename}/${rel}`
          const baseDownloaded = modelDownloadState.bytesDownloaded
          pushLog(`  Downloading (dir): ${filename}/${rel}`)
          await downloadModelWithFallback(`${filename}/${rel}`, destFile, (downloaded, total) => {
            modelDownloadState.bytesDownloaded = baseDownloaded + downloaded
            updateDownloadProgress()
          })
          modelDownloadState.bytesDownloaded = baseDownloaded + (MODEL_FILE_SIZES[filename] || 0)
          updateDownloadProgress()
        }
        modelDownloadState.currentIndex = i + 1
        continue
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

// ─── v1.0.79: Python 运行时下载 / 解压 ───
function pushRuntimeProgress() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('runtime:download-progress', {
      ...runtimeDownloadState,
      percent: runtimeDownloadState.totalBytes > 0
        ? Math.round((runtimeDownloadState.bytesDownloaded / runtimeDownloadState.totalBytes) * 100)
        : 0,
    })
  }
}

function getRuntimeArchivePath(): string {
  return path.join(getUserDataDir(), '.runtime-download.tar.gz')
}

/** 用系统 tar 解压 tar.gz 到目标父目录（macOS / Windows 均自带，避免新增依赖） */
function extractTarGz(src: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true })
    execFile('tar', ['-xzf', src, '-C', destDir], { maxBuffer: 64 * 1024 * 1024 }, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

async function downloadRuntimeWithFallback(onProgress: (downloaded: number, total: number) => void): Promise<void> {
  const destPath = getRuntimeArchivePath()
  let lastError: Error | null = null
  for (const url of RUNTIME_DOWNLOAD_URLS) {
    try {
      pushLog(`  Trying: ${url}`)
      runtimeDownloadState.totalBytes = 0
      runtimeDownloadState.bytesDownloaded = 0
      await downloadFile(url, destPath, onProgress, {
        getAborted: () => runtimeDownloadAborted,
        onSpeed: (speed) => { runtimeDownloadState.speed = speed },
      })
      pushLog(`  ✓ Runtime archive downloaded`)
      return
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      pushLog(`  ✗ Failed: ${url} - ${lastError.message}`)
      try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath) } catch {}
      if (lastError.message === 'Aborted' || runtimeDownloadAborted) throw lastError
    }
  }
  throw lastError || new Error('All runtime download sources failed')
}

/**
 * v1.0.79: 下载并解压 python 运行时归档（含 site-packages）
 * 幂等：运行时已就绪直接返回成功。
 */
async function downloadRuntime(): Promise<{ success: boolean; error?: string }> {
  if (checkRuntimeExists()) {
    runtimeDownloadState.installed = true
    return { success: true }
  }
  if (runtimeDownloadState.isDownloading) {
    return { success: false, error: 'Download already in progress' }
  }

  const installDir = getPythonRuntimeDir()
  const tmpArchive = getRuntimeArchivePath()
  const tmpInstallDir = path.join(installDir, '.extracting')

  fs.mkdirSync(installDir, { recursive: true })
  runtimeDownloadAborted = false
  runtimeDownloadState = {
    isDownloading: true,
    stage: 'download',
    bytesDownloaded: 0,
    totalBytes: 0,
    speed: 0,
    error: null,
    installed: false,
  }
  pushRuntimeProgress()

  try {
    // 1) 下载归档
    runtimeDownloadState.stage = 'download'
    pushLog('Starting Python runtime download...')
    await downloadRuntimeWithFallback((downloaded, total) => {
      runtimeDownloadState.bytesDownloaded = downloaded
      if (total > 0) runtimeDownloadState.totalBytes = total
      pushRuntimeProgress()
    })
    if (runtimeDownloadAborted) {
      runtimeDownloadState.isDownloading = false
      runtimeDownloadState.stage = 'idle'
      try { if (fs.existsSync(tmpArchive)) fs.unlinkSync(tmpArchive) } catch {}
      pushLog('Runtime download aborted')
      return { success: false, error: 'Aborted' }
    }

    // 2) 解压（先到临时目录，校验通过后原子替换，失败清理）
    runtimeDownloadState.stage = 'extract'
    pushRuntimeProgress()
    pushLog('Extracting Python runtime...')
    try { fs.rmSync(tmpInstallDir, { recursive: true, force: true }) } catch {}
    await extractTarGz(tmpArchive, tmpInstallDir)
    // 归档内容根为 python/，解压到 <installDir>/.extracting/python
    const extractedPython = path.join(tmpInstallDir, 'python')
    if (!fs.existsSync(path.join(extractedPython, getPythonExeSubPath()))) {
      throw new Error('Runtime archive missing python executable')
    }

    // 3) 校验通过后原子替换
    runtimeDownloadState.stage = 'verify'
    pushRuntimeProgress()
    const finalPythonDir = path.join(installDir, 'python')
    try { fs.rmSync(finalPythonDir, { recursive: true, force: true }) } catch {}
    try { fs.rmSync(path.join(installDir, '.extracting'), { recursive: true, force: true }) } catch {}
    fs.mkdirSync(installDir, { recursive: true })
    fs.renameSync(tmpInstallDir, path.join(installDir, 'python'))
    // 确保可执行位（tar 通常保留，这里兜底）
    const pyExe = getPythonExe()
    try { fs.chmodSync(pyExe, 0o755) } catch {}

    if (!fs.existsSync(pyExe)) {
      throw new Error('Runtime install verification failed')
    }

    runtimeDownloadState.isDownloading = false
    runtimeDownloadState.stage = 'done'
    runtimeDownloadState.installed = true
    pushRuntimeProgress()
    pushLog('✓ Python runtime installed')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    runtimeDownloadState.isDownloading = false
    runtimeDownloadState.stage = 'idle'
    runtimeDownloadState.error = msg
    try { if (fs.existsSync(tmpArchive)) fs.unlinkSync(tmpArchive) } catch {}
    try { fs.rmSync(tmpInstallDir, { recursive: true, force: true }) } catch {}
    pushLog(`✗ Runtime download failed: ${msg}`)
    return { success: false, error: msg }
  }
}

function getPythonExeSubPath(): string {
  return process.platform === 'win32' ? path.join('python.exe') : 'bin/python3'
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
    // v1.0.35: 修复 macOS GUI 应用不继承 shell PATH 的问题
    // 从 Finder 启动的应用 PATH 只有 /usr/bin:/bin:/usr/sbin:/sbin
    // 导致 ffmpeg（Homebrew 安装在 /opt/homebrew/bin）不可用
    // v1.0.79(win): Windows 用 ';' 作为路径分隔符，且不注入 macOS 专有路径
    const parentPath = process.env.PATH || ''
    const pathSep = process.platform === 'win32' ? ';' : ':'
    const extraPaths = process.platform === 'win32'
      ? []
      : ['/opt/homebrew/bin', '/usr/local/bin', '/snap/bin']
    const mergedPath = extraPaths
      .filter(p => fs.existsSync(p) && !parentPath.split(pathSep).includes(p))
      .reduce((acc, p) => acc + pathSep + p, parentPath)

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      PATH: mergedPath,
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

// v1.0.78: 反向流程（网页端"启动桌面客户端"）挂起的回传地址
// 收到 podcastai://auth?redirect=... 时：已登录则立即回传 token；
// 未登录则先记录，待登录成功后自动回传
let pendingWebAuthRedirect: string | null = null

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
 * 持久化认证状态
 * v1.0.78: 统一使用 base64 编码存储，不再用 safeStorage
 *   实测 adhoc 签名应用 safeStorage 跨进程不稳定（A 进程可加密、B 进程不可用），
 *   一旦"保存时加密、加载时不可用"→ 解密失败删文件 → 登录态丢失（每次重启都要重新登录）。
 *   且应用靠重新打包分发（每次更新签名都变），keychain 绑定必然失效。
 *   base64 虽非加密，但与 keychain 无关，重启/更新后 100% 可恢复。
 */
function saveAuthState(state: AuthState): boolean {
  try {
    const json = JSON.stringify(state)
    const outBuf = Buffer.from(json, 'utf-8').toString('base64')
    fs.writeFileSync(getAuthStorePath(), outBuf, 'utf-8')
    return true
  } catch (err) {
    pushLog(`[AUTH] Failed to save auth state: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

/**
 * 从持久化文件加载认证状态
 * v1.0.78: 兼容读取新旧两种格式
 *   - 新格式：base64（saveAuthState 现在统一写这种）
 *   - 旧格式：safeStorage 加密（v1.0.31-1.0.77 可能写入），
 *     不依赖 isEncryptionAvailable()（该接口对 adhoc 应用不稳定会误报 false），
 *     直接尝试 decryptString，失败说明密钥已不可用（重签名/更新后必然如此）
 */
function loadAuthState(): AuthState | null {
  try {
    const filePath = getAuthStorePath()
    if (!fs.existsSync(filePath)) return null
    const buf = fs.readFileSync(filePath)

    // 1) 优先按 base64 解码（新格式）
    try {
      const json = Buffer.from(buf.toString('utf-8'), 'base64').toString('utf-8')
      const parsed = JSON.parse(json) as AuthState
      if (parsed && typeof parsed === 'object') {
        return normalizeAuthState(parsed)
      }
    } catch {
      // 非 base64-JSON，继续尝试旧格式
    }

    // 2) 旧格式：safeStorage 加密
    try {
      const json = safeStorage.decryptString(buf)
      const parsed = JSON.parse(json) as AuthState
      if (parsed && typeof parsed === 'object') {
        return normalizeAuthState(parsed)
      }
    } catch (decErr) {
      pushLog(`[AUTH] Legacy safeStorage decrypt failed (expected after re-sign): ${decErr instanceof Error ? decErr.message : String(decErr)}`)
    }

    // 3) 两种格式都无法解析：文件已不可恢复，删除
    pushLog('[AUTH] Auth store unreadable (neither base64 nor decryptable), removing')
    try { fs.unlinkSync(filePath) } catch {}
    return null
  } catch (err) {
    pushLog(`[AUTH] Failed to load auth state: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

/** 校验并补全认证状态字段 */
function normalizeAuthState(parsed: Partial<AuthState>): AuthState {
  return {
    token: parsed.token || null,
    refreshToken: parsed.refreshToken || null,
    email: parsed.email || null,
    userId: parsed.userId || null,
    name: parsed.name || null,
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
              // v1.0.34: POST 回调也需要把窗口带到前台
              // 否则用户看不到登录成功，桌面端仍然显示"等待网页登录"
              if (mainWindow.isMinimized()) mainWindow.restore()
              mainWindow.show()
              mainWindow.focus()
            }
            // v1.0.78: 若有网页端发起的挂起反向认证，登录成功后自动回传
            completePendingWebAuthRedirect(payload)
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
 * v1.0.78: 校验反向流程回传地址是否安全
 * 仅允许本项目 Web 端（podcastai.clipopai.com / *.clipopai.com / 本地开发）
 */
function isSafeWebAuthRedirect(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const h = u.hostname
    return (
      h === 'podcastai.clipopai.com' ||
      h.endsWith('.clipopai.com') ||
      h === 'localhost' ||
      h === '127.0.0.1'
    )
  } catch {
    return false
  }
}

/**
 * v1.0.78: 完成反向流程 —— 把 token 回传给网页端 /auth/desktop-callback
 * 由登录成功（本地回调 POST / deep-link）后调用
 */
function completePendingWebAuthRedirect(state: AuthState) {
  if (!pendingWebAuthRedirect || !state.token) return
  try {
    const u = new URL(pendingWebAuthRedirect)
    u.searchParams.set('token', state.token)
    if (state.refreshToken) u.searchParams.set('refreshToken', state.refreshToken)
    if (state.email) u.searchParams.set('email', state.email)
    pendingWebAuthRedirect = null
    pushLog(`[AUTH] Completing web auth redirect → ${u.origin}${u.pathname}`)
    shell.openExternal(u.toString()).catch(() => {})
  } catch (err) {
    pushLog(`[AUTH] Failed to complete web auth redirect: ${err instanceof Error ? err.message : String(err)}`)
    pendingWebAuthRedirect = null
  }
}

/**
 * 处理 deep-link 回调：
 * - podcastai://login-success?token=...  浏览器登录成功后回跳桌面端
 * - podcastai://auth?redirect=...        网页端"启动桌面客户端"发起的反向认证
 */
function handleDeepLink(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== `${DESKTOP_SCHEME}:`) return

    // v1.0.78: 反向流程 —— 网页端登录页"启动桌面客户端"按钮发起
    if (parsed.host === 'auth') {
      const redirect = parsed.searchParams.get('redirect') || ''
      if (!isSafeWebAuthRedirect(redirect)) {
        pushLog(`[AUTH] Rejected unsafe web auth redirect: ${redirect}`)
        return
      }
      // 已登录：立即把 token 回传给网页端
      if (authState.token) {
        pushLog('[AUTH] Web auth request: already logged in, completing immediately')
        pendingWebAuthRedirect = redirect
        completePendingWebAuthRedirect(authState)
      } else {
        // 未登录：记录挂起地址，等用户在桌面端完成登录后自动回传
        pendingWebAuthRedirect = redirect
        pushLog('[AUTH] Web auth request: not logged in, waiting for desktop login')
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('auth:web-auth-requested', {})
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
        }
      }
      return
    }

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
      // v1.0.78: 若有网页端发起的挂起反向认证，登录成功后自动回传
      completePendingWebAuthRedirect(payload)
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
  // v1.0.78: macOS 关闭所有窗口时回调服务器已被 stopCallbackServer 停掉，
  // 从 Dock 重开窗口（activate）不会重跑 whenReady，服务器可能仍是停止状态。
  // 此处兜底：端口为 0 时先重启回调服务器，确保登录 URL 带上 callbackUrl
  if (callbackPort === 0) {
    pushLog('[AUTH] Callback server not running, restarting before opening web login...')
    await startCallbackServer()
  }
  const url = buildWebLoginUrl()
  const callbackUrl = getCallbackUrl()
  if (!callbackUrl) {
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

// ─── v1.0.79: IPC 运行时管理 ───
ipcMain.handle('runtime:status', async () => {
  runtimeDownloadState.installed = checkRuntimeExists()
  return { ...runtimeDownloadState }
})

ipcMain.handle('runtime:download', async () => {
  const result = await downloadRuntime()
  return result
})

ipcMain.handle('runtime:abort', async () => {
  runtimeDownloadAborted = true
  return true
})

ipcMain.handle('runtime:get-download-state', async () => {
  return {
    ...runtimeDownloadState,
    percent: runtimeDownloadState.totalBytes > 0
      ? Math.round((runtimeDownloadState.bytesDownloaded / runtimeDownloadState.totalBytes) * 100)
      : 0,
  }
})

ipcMain.handle('runtime:open-dir', async () => {
  const dir = getPythonRuntimeDir()
  shell.openPath(dir)
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

// v1.0.39: 在主进程抓取 URL 内容，绕过渲染进程的 CORS 限制
// 微信公众号等网站不支持 CORS，渲染进程直接 fetch 会被 Chromium 拦截
// 主进程用 Node.js 原生 http/https 模块抓取，不受 CORS 限制
function fetchUrlInMain(url: string, maxRedirects = 5): Promise<{ success: boolean; html?: string; statusCode?: number; error?: string }> {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url)
      const lib = urlObj.protocol === 'https:' ? https : http
      const options: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        timeout: 20000,
      }

      const req = lib.request(options, (res) => {
        // 处理重定向（3xx）
        if (res.statusCode && [301, 302, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${urlObj.protocol}//${urlObj.hostname}${res.headers.location}`
          pushLog(`[URL Fetch] Redirect ${res.statusCode} -> ${redirectUrl}`)
          res.resume() // 丢弃响应体
          fetchUrlInMain(redirectUrl, maxRedirects - 1).then(resolve)
          return
        }

        if (res.statusCode && res.statusCode >= 400) {
          pushLog(`[URL Fetch] HTTP error: ${res.statusCode}`)
          resolve({ success: false, error: `HTTP ${res.statusCode}` })
          return
        }

        const chunks: Buffer[] = []
        // 处理 gzip/deflate/br 压缩
        let stream: any = res
        const encoding = res.headers['content-encoding']
        try {
          if (encoding === 'gzip') {
            stream = require('zlib').createGunzip()
            res.pipe(stream)
          } else if (encoding === 'deflate') {
            stream = require('zlib').createInflate()
            res.pipe(stream)
          } else if (encoding === 'br') {
            stream = require('zlib').createBrotliDecompress()
            res.pipe(stream)
          }
        } catch (e) {
          pushLog(`[URL Fetch] Decompress setup error: ${e instanceof Error ? e.message : String(e)}`)
        }

        stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        stream.on('end', () => {
          const html = Buffer.concat(chunks).toString('utf-8')
          pushLog(`[URL Fetch] Success: ${html.length} chars from ${urlObj.hostname}`)
          resolve({ success: true, html, statusCode: res.statusCode })
        })
        stream.on('error', (e: Error) => {
          pushLog(`[URL Fetch] Stream error: ${e.message}`)
          resolve({ success: false, error: e.message })
        })
      })

      req.on('error', (e: Error) => {
        pushLog(`[URL Fetch] Request error: ${e.message}`)
        resolve({ success: false, error: e.message })
      })

      req.on('timeout', () => {
        pushLog('[URL Fetch] Request timeout')
        req.destroy()
        resolve({ success: false, error: 'timeout' })
      })

      req.end()
    } catch (e) {
      pushLog(`[URL Fetch] Error: ${e instanceof Error ? e.message : String(e)}`)
      resolve({ success: false, error: String(e) })
    }
  })
}

ipcMain.handle('url:fetch', async (_, url: string) => {
  return fetchUrlInMain(url)
})

// ─── v1.0.79: 启动两级门控（自动起服务 + 自动下载模型/运行时） ───
function autoDownloadModelIfNeeded() {
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
}

async function autoStartVoiceAndModel() {
  if (!checkRuntimeExists()) {
    // 1) python 运行时缺失 → 先自动下载运行时，就绪后再起服务
    pushLog('⚠ Python runtime not found, auto-downloading...')
    const result = await downloadRuntime()
    if (!result.success) {
      pushLog(`⚠ Python runtime auto-download failed: ${result.error}`)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('runtime:download-progress', {
          ...runtimeDownloadState,
          percent: 0,
        })
      }
      return
    }
  }

  if (checkRuntimeExists()) {
    await startVoiceAndModel()
  } else {
    pushLog('⚠ Voice runtime not found, service not started')
  }
}

async function startVoiceAndModel() {
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
  autoDownloadModelIfNeeded()
}

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
    // v1.0.36: 顶层 try-catch 捕获所有异常
    try {
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        // v1.0.78: macOS 关闭全部窗口时 window-all-closed 已停掉回调服务器，
        // 从 Dock 重开窗口必须重启服务器，否则"打开网页登录"的 URL 会缺失
        // callbackUrl，导致网页登录后 token 无法回传（链路断）
        if (!callbackServer || callbackPort === 0) {
          startCallbackServer().then((ok) => {
            pushLog(ok ? '[AUTH] Callback server restarted on activate' : '[AUTH] Failed to restart callback server on activate')
          })
        }
        createWindow()
      }
    })

    // v1.0.31: 启动本地回调服务器（接收 Web 端 POST 的 token）
    await startCallbackServer()
    // v1.0.36: 调试日志
    try {
      const dbgLog = path.join(app.getPath('home'), 'Library', 'Logs', 'podcastai-desktop', 'main.log')
      fs.appendFileSync(dbgLog, `[DEBUG] startCallbackServer done, calling loadAuthState...\n`)
    } catch {}

    // v1.0.31: 加载持久化的认证状态
    const persisted = loadAuthState()
    // v1.0.36: 调试日志
    try {
      const dbgLog = path.join(app.getPath('home'), 'Library', 'Logs', 'podcastai-desktop', 'main.log')
      fs.appendFileSync(dbgLog, `[DEBUG] loadAuthState returned: ${persisted ? 'has token' : 'null'}\n`)
    } catch {}
    if (persisted && persisted.token) {
      authState = persisted
      pushLog(`[AUTH] Loaded persisted token (email=${authState.email || 'unknown'})`)
    } else {
      pushLog('[AUTH] No persisted token, user must login')
    }

    // v1.0.79 两级门控：运行时就绪 → 起服务 + 下载模型；否则先自动下载运行时
    await autoStartVoiceAndModel()
    } catch (topErr) {
      // v1.0.36: 捕获 app.whenReady 中的所有异常
      try {
        const errLog = path.join(app.getPath('home'), 'Library', 'Logs', 'podcastai-desktop', 'main.log')
        fs.appendFileSync(errLog, `[FATAL] Unhandled error in app.whenReady: ${topErr instanceof Error ? topErr.stack : String(topErr)}\n`)
      } catch {}
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
