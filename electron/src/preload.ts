/**
 * PodcastAI Desktop - Preload Script
 *
 * 在 contextIsolation 模式下安全地暴露 IPC API 给渲染进程。
 *
 * v1.0.4: 新增 model 命名空间，用于管理 CosyVoice2 模型下载。
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
  },

  /**
   * Shell 操作
   */
  shell: {
    showItemInFolder: (filePath: string) =>
      ipcRenderer.invoke('shell:showItemInFolder', filePath),
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
})
