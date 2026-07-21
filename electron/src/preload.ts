/**
 * PodcastAI Desktop - Preload Script
 *
 * 在 contextIsolation 模式下安全地暴露 IPC API 给渲染进程。
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('podcastai', {
  /**
   * 获取客户端版本信息
   */
  getVersion: () => ipcRenderer.invoke('get-version'),

  /**
   * 服务管理
   */
  service: {
    /** 检测 Python 与 voice-service 安装情况 */
    detect: () => ipcRenderer.invoke('service:detect'),
    /** 启动 Python 语音服务 */
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
   * 持久化设置
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
