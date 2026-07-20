/**
 * PodcastAI Desktop - Electron Main Process
 *
 * 加载在线 Web 端，并处理 custom scheme 注册用于桌面客户端验证。
 */

import { app, BrowserWindow, ipcMain, session } from 'electron'
import * as path from 'path'
import * as crypto from 'crypto'

// 配置：在线 Web 端地址（部署后由环境变量覆盖）
const WEB_APP_URL = process.env.PODCASTAI_WEB_URL || 'https://podcastai.vercel.app'
const DEV_SERVER_URL = process.env.PODCASTAI_DEV_URL || 'http://localhost:5000'
const IS_DEV = !!process.env.PODCASTAI_DEV

// 桌面客户端验证 token 缓存
const desktopTokens = new Map<string, { token: string; expiresAt: number }>()

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'PodcastAI',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
  })

  // 加载 Web 端
  const targetUrl = IS_DEV ? DEV_SERVER_URL : WEB_APP_URL
  mainWindow.loadURL(targetUrl)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (IS_DEV) {
      mainWindow?.webContents.openDevTools()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 处理 custom scheme 唤起（podcastai://auth?verifier=xxx&redirect=xxx）
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('podcastai://')) {
      event.preventDefault()
      handleCustomScheme(url)
    }
  })
}

/**
 * 处理 podcastai:// 自定义协议
 * 期望格式：podcastai://auth?verifier=xxx&redirect=http://localhost:5000/auth/desktop-callback
 * 流程：生成临时 token，通过 redirect URL 回传给 Web 端
 */
function handleCustomScheme(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.host !== 'auth' && parsed.pathname !== '/auth') return

    const params = new URLSearchParams(parsed.search)
    const verifier = params.get('verifier') || params.get('challenge')
    const redirect = params.get('redirect')

    if (!verifier || !redirect) {
      console.error('Missing verifier or redirect in custom scheme URL')
      return
    }

    // 生成临时 token（30 秒有效期）
    const token = `desktop_${crypto.randomUUID()}_${Date.now()}`
    desktopTokens.set(token, {
      token: verifier,
      expiresAt: Date.now() + 30 * 1000,
    })

    // 通过 redirect URL 回传 token 给 Web 端
    const callbackUrl = `${redirect}?token=${encodeURIComponent(token)}`
    mainWindow?.loadURL(callbackUrl)

    // 清理过期 token
    setTimeout(() => {
      desktopTokens.delete(token)
    }, 60 * 1000)
  } catch (err) {
    console.error('Failed to handle custom scheme:', err)
  }
}

/**
 * 注册 custom scheme 以处理 podcastai:// 协议
 */
function registerCustomScheme(): void {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('podcastai', process.execPath, [
        path.resolve(process.argv[1]),
      ])
    }
  } else {
    app.setAsDefaultProtocolClient('podcastai')
  }
}

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    // 处理第二实例唤起（custom scheme）
    const schemeUrl = commandLine.find((arg) => arg.startsWith('podcastai://'))
    if (schemeUrl) {
      handleCustomScheme(schemeUrl)
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    registerCustomScheme()

    // 设置 CSP 允许加载 Web 端
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'",
          ],
        },
      })
    })

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// macOS 上通过 open-url 事件处理 custom scheme
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleCustomScheme(url)
})

// IPC 处理器：验证桌面 token
ipcMain.handle('verify-desktop-token', (_event, token: string) => {
  const entry = desktopTokens.get(token)
  if (!entry) {
    return { valid: false, error: 'Token not found' }
  }
  if (Date.now() > entry.expiresAt) {
    desktopTokens.delete(token)
    return { valid: false, error: 'Token expired' }
  }
  return { valid: true, verifier: entry.token }
})
