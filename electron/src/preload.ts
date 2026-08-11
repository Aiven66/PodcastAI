/**
 * PodcastAI Desktop - Preload Script
 *
 * 在 contextIsolation 模式下安全地暴露 IPC API 给渲染进程。
 *
 * v1.0.4: 新增 model 命名空间，用于管理 CosyVoice2 模型下载。
 * v1.0.31: 新增 auth 命名空间 + 注入 podcastaiDesktop bridge
 *          用于桌面客户端与 Web 端登录校验打通。
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('podcastai', {
  /**
   * 获取客户端版本信息
   */
  getVersion: () => ipcRenderer.invoke('get-version'),

  /**
   * 服务管理（v1.0.4: 运行时已内置，仅暴露启动/停止/状态/日志）
   */
  service: {
    /** 兼容旧版：检测环境（v1.0.4 始终返回 built-in 就绪） */
    detect: () => ipcRenderer.invoke('service:detect'),
    /** 启动内置 voice-service */
    start: (options?: { voiceServicePath?: string; pythonPath?: string }) =>
      ipcRenderer.invoke('service:start', options),
    /** 停止服务 */
    stop: () => ipcRenderer.invoke('service:stop'),
    /** 查询进程状态 */
    status: () => ipcRenderer.invoke('service:status'),
    /** 获取累积日志 */
    getLogs: () => ipcRenderer.invoke('service:get-logs'),
    /** 清空日志 */
    clearLogs: () => ipcRenderer.invoke('service:clear-logs'),
    /** 订阅实时日志推送，返回取消订阅函数 */
    onLog: (callback: (line: string) => void) => {
      const handler = (_: unknown, line: string) => callback(line)
      ipcRenderer.on('service:log', handler)
      return () => ipcRenderer.removeListener('service:log', handler)
    },
    /** 订阅服务状态变化事件（自动启动完成/超时后触发） */
    onStateChanged: (callback: (info: { ready: boolean }) => void) => {
      const handler = (_: unknown, info: { ready: boolean }) => callback(info)
      ipcRenderer.on('service:state-changed', handler)
      return () => ipcRenderer.removeListener('service:state-changed', handler)
    },
  },

  /**
   * 模型管理（v1.0.4 新增）
   * CosyVoice2 模型（约 3.6GB）在首次使用时下载，支持进度订阅。
   */
  model: {
    /** 查询模型下载状态：{ ready, existing, total, missing } */
    status: () => ipcRenderer.invoke('model:status'),
    /** 启动模型下载（异步，完成后 resolve） */
    download: () => ipcRenderer.invoke('model:download'),
    /** 中止下载 */
    abortDownload: () => ipcRenderer.invoke('model:abort-download'),
    /** 获取当前下载状态（用于刷新 UI） */
    getDownloadState: () => ipcRenderer.invoke('model:get-download-state'),
    /** 在文件管理器中打开模型目录 */
    openDir: () => ipcRenderer.invoke('model:open-dir'),
    /** 订阅下载进度推送，返回取消订阅函数 */
    onDownloadProgress: (callback: (state: unknown) => void) => {
      const handler = (_: unknown, state: unknown) => callback(state)
      ipcRenderer.on('model:download-progress', handler)
      return () => ipcRenderer.removeListener('model:download-progress', handler)
    },
  },

  /**
   * 持久化设置（v1.0.4: 大部分已内置，保留兼容）
   */
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: {
      voiceServicePath?: string
      pythonPath?: string
      autoStartService?: boolean
    }) => ipcRenderer.invoke('settings:set', settings),
  },

  /**
   * 系统对话框
   */
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    // v1.0.17: 保存文件对话框（用于音频下载，比 <a download> 更可靠）
    saveFile: (defaultName: string, buffer: ArrayBuffer) =>
      ipcRenderer.invoke('dialog:saveFile', defaultName, buffer),
  },

  /**
   * Shell 操作
   */
  shell: {
    showItemInFolder: (filePath: string) =>
      ipcRenderer.invoke('shell:showItemInFolder', filePath),
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },

  /**
   * v1.0.39: URL 抓取（主进程代理，绕过 CORS）
   * 微信公众号等网站不支持 CORS，渲染进程直接 fetch 会被拦截
   */
  url: {
    fetch: (url: string) => ipcRenderer.invoke('url:fetch', url),
  },

  /**
   * v1.0.31: 认证系统
   * 桌面客户端与 Web 端登录校验打通
   */
  auth: {
    /** 获取当前认证状态 { token, email, name, userId, callbackUrl, webLoginUrl } */
    getState: () => ipcRenderer.invoke('auth:getState'),
    /** 打开 Web 端登录页（系统浏览器） */
    openWebLogin: () => ipcRenderer.invoke('auth:openWebLogin'),
    /** 退出登录（清除 token） */
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    /** 手动交付 token（备用通道，通常由本地 HTTP 回调服务器接收） */
    deliverToken: (payload: { token: string; refreshToken?: string; email?: string; userId?: string; name?: string }) =>
      ipcRenderer.invoke('auth:deliverToken', payload),
    /** 订阅登录成功事件 */
    onLoginSuccess: (callback: (info: { token: string; email?: string; name?: string; userId?: string }) => void) => {
      const handler = (_: unknown, info: { token: string; email?: string; name?: string; userId?: string }) => callback(info)
      ipcRenderer.on('auth:login-success', handler)
      return () => ipcRenderer.removeListener('auth:login-success', handler)
    },
    /** 订阅退出登录事件 */
    onLogout: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('auth:logout', handler)
      return () => ipcRenderer.removeListener('auth:logout', handler)
    },
  },
})

// ════════════════════════════════════════════════════════════
// v1.0.31: 注入 podcastaiDesktop bridge
// 兼容 packages/auth/desktop-bridge.ts 的桥接对象发现机制
// (window.clipopDesktop > window.vidshorterDesktop > window.electronAPI > window.api > window.agent)
// 这里注入 window.podcastaiDesktop（自有命名）+ window.electronAPI（兼容包发现）
// ════════════════════════════════════════════════════════════
const desktopBridge = {
  /**
   * 返回本地回调服务器 URL（http://127.0.0.1:port）
   * Web 端通过此 URL POST token 到桌面端
   */
  getMediaBaseUrl: async (): Promise<string> => {
    const state = await ipcRenderer.invoke('auth:getState') as { callbackUrl?: string }
    return state?.callbackUrl || ''
  },

  /**
   * 打开 Web 端登录页（系统浏览器）
   * 兼容 packages/auth/desktop-bridge.ts 的 openAuth/openWebLogin 接口
   */
  openAuth: async (): Promise<{ ok?: boolean }> => {
    const result = await ipcRenderer.invoke('auth:openWebLogin') as { success?: boolean }
    return { ok: !!result?.success }
  },

  /**
   * 打开 Web 端登录页（别名）
   */
  openWebLogin: async (): Promise<{ ok?: boolean }> => {
    const result = await ipcRenderer.invoke('auth:openWebLogin') as { success?: boolean }
    return { ok: !!result?.success }
  },

  /**
   * 打开 Web 端注册页（别名，复用登录页）
   */
  openWebRegister: async (): Promise<{ ok?: boolean }> => {
    const result = await ipcRenderer.invoke('auth:openWebLogin') as { success?: boolean }
    return { ok: !!result?.success }
  },

  /**
   * 获取缓存的 token（从安全存储读取）
   */
  getAuthToken: async (): Promise<string> => {
    const state = await ipcRenderer.invoke('auth:getState') as { token?: string }
    return state?.token || ''
  },

  /**
   * 清除缓存的 token（退出登录）
   */
  clearAuthToken: async (): Promise<{ ok?: boolean }> => {
    await ipcRenderer.invoke('auth:signOut')
    return { ok: true }
  },
}

// 注入到 window.podcastaiDesktop（自有命名）
contextBridge.exposeInMainWorld('podcastaiDesktop', desktopBridge)
// 同时注入到 window.electronAPI（兼容 packages/auth/desktop-bridge.ts 的发现机制）
contextBridge.exposeInMainWorld('electronAPI', desktopBridge)
