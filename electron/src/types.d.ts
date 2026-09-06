/**
 * PodcastAI Desktop - Type Declarations
 *
 * 扩展 window 类型以包含 preload 注入的 API。
 *
 * v1.0.4: 新增 model 命名空间类型，用于管理 CosyVoice2 模型下载。
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
  healthOk?: boolean
  runtimeExists?: boolean
  pid: number | null
}

export interface AppSettings {
  voiceServicePath?: string
  pythonPath?: string
  autoStartService?: boolean
}

/** 模型完整性检查结果 */
export interface ModelStatus {
  ready: boolean
  existing: number
  total: number
  missing: string[]
}

/** 模型下载实时状态 */
export interface ModelDownloadState {
  isDownloading: boolean
  currentFile: string
  currentIndex: number
  totalFiles: number
  bytesDownloaded: number
  totalBytes: number
  speed: number
  error: string | null
  percent: number
}

/** 运行时下载阶段（v1.0.79） */
export type RuntimeStage = 'idle' | 'download' | 'extract' | 'verify' | 'done'

/** Python 运行时状态（v1.0.79） */
export interface RuntimeDownloadState {
  isDownloading: boolean
  stage: RuntimeStage
  bytesDownloaded: number
  totalBytes: number
  speed: number
  error: string | null
  installed: boolean
  percent: number
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
      model: {
        status: () => Promise<ModelStatus>
        download: () => Promise<{ success: boolean; error?: string }>
        abortDownload: () => Promise<boolean>
        getDownloadState: () => Promise<ModelDownloadState>
        openDir: () => Promise<boolean>
        onDownloadProgress: (callback: (state: ModelDownloadState) => void) => () => void
      }
      runtime: {
        status: () => Promise<RuntimeDownloadState>
        download: () => Promise<{ success: boolean; error?: string }>
        abortDownload: () => Promise<boolean>
        getDownloadState: () => Promise<RuntimeDownloadState>
        openDir: () => Promise<boolean>
        onDownloadProgress: (callback: (state: RuntimeDownloadState) => void) => () => void
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
      /** v1.0.31: 认证系统（桌面端 ↔ Web 端登录打通） */
      auth?: {
        getState: () => Promise<{
          token: string | null
          refreshToken: string | null
          email: string | null
          userId: string | null
          name: string | null
          callbackUrl: string
          webLoginUrl: string
        }>
        openWebLogin: () => Promise<{ success: boolean; url?: string; error?: string }>
        signOut: () => Promise<{ success: boolean }>
        deliverToken: (payload: { token: string; refreshToken?: string; email?: string; userId?: string; name?: string }) => Promise<{ success: boolean; error?: string }>
        onLoginSuccess: (callback: (info: { token: string; email?: string; name?: string; userId?: string }) => void) => () => void
        onLogout: (callback: () => void) => () => void
        /** v1.0.78: 网页端发起的反向认证请求（podcastai://auth） */
        onWebAuthRequested?: (callback: () => void) => () => void
      }
    }
  }
}

export {}
