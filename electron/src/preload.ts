/**
 * PodcastAI Desktop - Preload Script
 *
 * 在 contextIsolation 模式下安全地暴露 IPC API 给渲染进程。
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('podcastai', {
  /**
   * 验证桌面客户端 token
   * @param token 从 custom scheme 回调获取的 token
   * @returns 验证结果
   */
  verifyDesktopToken: (token: string) =>
    ipcRenderer.invoke('verify-desktop-token', token),

  /**
   * 获取客户端版本信息
   */
  getVersion: () => ({
    version: process.env.npm_package_version || '1.0.0',
    platform: process.platform,
    arch: process.arch,
  }),
})
