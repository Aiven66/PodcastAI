/**
 * PodcastAI Desktop - Type Declarations
 *
 * 扩展 window 类型以包含 preload 注入的 API。
 */

declare global {
  interface Window {
    podcastai?: {
      verifyDesktopToken: (token: string) => Promise<{
        valid: boolean
        verifier?: string
        error?: string
      }>
      getVersion: () => {
        version: string
        platform: string
        arch: string
      }
    }
  }
}

export {}
