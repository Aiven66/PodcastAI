/**
 * 服务端能力检测工具
 *
 * 用于判断当前运行环境是否支持声音克隆、播客 TTS 等需要本地文件系统
 * 和 Python 语音服务的功能。
 *
 * - Vercel serverless 环境：文件系统只读，无法运行 Python 服务
 * - 本地开发 / 桌面客户端：可以访问 localhost:8907 Python 语音服务
 * - 自托管服务器：配置 VOICE_SERVICE_URL 后可使用远程 Python 服务
 */

/**
 * 判断是否运行在 Vercel serverless 环境
 */
export function isVercelEnvironment(): boolean {
  return Boolean(process.env.VERCEL) || process.env.VERCEL_ENV !== undefined
}

/**
 * 获取 Python 语音服务地址
 * - 优先使用 VOICE_SERVICE_URL 环境变量
 * - 默认 localhost:8907（本地开发 / 桌面客户端）
 */
export function getVoiceServiceUrl(): string {
  return process.env.VOICE_SERVICE_URL || 'http://localhost:8907'
}

/**
 * 判断 Python 语音服务是否配置为远程地址
 * localhost / 127.0.0.1 视为本地服务
 */
export function isRemoteVoiceServiceConfigured(): boolean {
  const url = getVoiceServiceUrl()
  return !url.includes('localhost') && !url.includes('127.0.0.1')
}

/**
 * 判断当前环境是否支持声音克隆 / 播客 TTS 功能
 *
 * 必须满足以下任一条件：
 * 1. 非 Vercel 环境（本地开发 / 桌面客户端 / 自托管服务器）
 * 2. Vercel 环境但配置了远程 Python 语音服务（VOICE_SERVICE_URL 指向远程地址）
 */
export function isVoiceFeatureSupported(): boolean {
  // 非 Vercel 环境：支持（本地开发 / 桌面客户端）
  if (!isVercelEnvironment()) return true
  // Vercel 环境：必须配置远程 Python 语音服务
  return isRemoteVoiceServiceConfigured()
}

/**
 * 生成"需要下载桌面客户端"的错误响应
 */
export function createDesktopRequiredResponse(feature: 'clone' | 'tts') {
  const featureName = feature === 'clone' ? 'Voice Cloning' : 'Podcast Generation'
  const featureNameZh = feature === 'clone' ? '声音克隆' : '播客音频生成'

  return {
    error: `DESKTOP_REQUIRED: ${featureName} requires the desktop client. Please download PodcastAI desktop client to use this feature.`,
    errorZh: `${featureNameZh}功能需要下载桌面客户端才能使用，请前往下载页面下载 PodcastAI 桌面客户端。`,
    code: 'DESKTOP_REQUIRED',
    feature,
    downloadUrl: '/download',
    message: `${featureName} is not available in the web version. Please download the desktop client.`,
    messageZh: `${featureNameZh}功能在网页版不可用，请下载桌面客户端使用。`,
  }
}
