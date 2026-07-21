/**
 * PodcastAI Desktop - Type Declarations
 *
 * 扩展 window 类型以包含 preload 注入的 API。
 */

export interface ServiceDetectResult {
  python: string | null
  pythonVersion: string | null
  venvPython: string | null
  voiceServicePath: string | null
  hasMainPy: boolean
  hasVenv: boolean
  hasModels: boolean
  platform: string
}

export interface ServiceStatus {
  running: boolean
  pid: number | null
}

export interface AppSettings {
  voiceServicePath?: string
  pythonPath?: string
  autoStartService?: boolean
}

declare global {
  interface Window {
    podcastai?: {
      getVersion: () => Promise<{
        version: string
        platform: string
        arch: string
      }>
      service: {
        detect: () => Promise<ServiceDetectResult>
        start: (options?: {
          voiceServicePath?: string
          pythonPath?: string
        }) => Promise<{ success: boolean; pid?: number; error?: string }>
        stop: () => Promise<{ success: boolean; error?: string; message?: string }>
        status: () => Promise<ServiceStatus>
        getLogs: () => Promise<string[]>
        clearLogs: () => Promise<boolean>
        onLog: (callback: (line: string) => void) => () => void
      }
      settings: {
        get: () => Promise<AppSettings>
        set: (settings: AppSettings) => Promise<boolean>
      }
      dialog: {
        openDirectory: () => Promise<string | null>
      }
      shell: {
        showItemInFolder: (filePath: string) => Promise<boolean>
        openExternal: (url: string) => Promise<boolean>
      }
    }
  }
}

export {}
