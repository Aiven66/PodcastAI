'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Apple, Monitor, Download, Loader2, CheckCircle2, AlertCircle, Shield, Zap, Headphones } from 'lucide-react'
import { useLocale } from '@/components/locale-provider'

interface ReleaseAsset {
  name: string
  platform: 'mac' | 'windows'
  arch?: 'arm64' | 'x64'
  url: string
  size?: string
  version?: string
}

// 客户端下载配置 - 指向 GitHub Release，确保稳定可下载
const GITHUB_RELEASE_BASE = 'https://github.com/Aiven66/PodcastAI/releases/download/v1.0.0'

const RELEASE_ASSETS: ReleaseAsset[] = [
  {
    name: 'PodcastAI-1.0.0-arm64-mac.zip',
    platform: 'mac',
    arch: 'arm64',
    url: `${GITHUB_RELEASE_BASE}/PodcastAI-1.0.0-arm64-mac.zip`,
    size: '约 91 MB',
    version: '1.0.0',
  },
  {
    name: 'PodcastAI-1.0.0-mac.zip',
    platform: 'mac',
    arch: 'x64',
    url: `${GITHUB_RELEASE_BASE}/PodcastAI-1.0.0-mac.zip`,
    size: '约 95 MB',
    version: '1.0.0',
  },
  {
    name: 'PodcastAI-win-x64.exe',
    platform: 'windows',
    arch: 'x64',
    url: `${GITHUB_RELEASE_BASE}/PodcastAI-win-x64.exe`,
    size: '约 90 MB',
    version: '1.0.0',
  },
]

// Windows 客户端暂未发布（需要在 Windows 机器上构建）
const WINDOWS_AVAILABLE = false

export default function DownloadPage() {
  const { locale } = useLocale()
  const t = (en: string, zh: string) => locale === 'en' ? en : zh
  const [downloading, setDownloading] = useState<string | null>(null)
  const [osDetected, setOsDetected] = useState<'mac' | 'windows' | 'unknown'>('unknown')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ua = window.navigator.userAgent
    if (/Macintosh|MacIntel|MacPPC|Mac68K/i.test(ua)) setOsDetected('mac')
    else if (/Win32|Win64|Windows|WinCE/i.test(ua)) setOsDetected('windows')
    else setOsDetected('unknown')
  }, [])

  const handleDownload = (asset: ReleaseAsset) => {
    setDownloading(asset.name)
    // 实际下载链接（部署后可替换为 CDN URL）
    window.location.href = asset.url
    setTimeout(() => setDownloading(null), 3000)
  }

  const macAssets = RELEASE_ASSETS.filter(a => a.platform === 'mac')
  const windowsAssets = RELEASE_ASSETS.filter(a => a.platform === 'windows')

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            <Download className="h-3 w-3 mr-1" />
            {t('Desktop App', '桌面客户端')}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('Download PodcastAI Desktop', '下载 PodcastAI 桌面客户端')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t(
              'Get the native desktop experience with faster performance, offline capabilities, and secure local voice processing.',
              '获得原生桌面体验，更快的性能、离线能力和安全的本地语音处理。'
            )}
          </p>
        </div>

        {/* Auto-detected OS hint */}
        {osDetected !== 'unknown' && (
          <Alert className="mb-8 border-primary bg-primary/5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              {osDetected === 'mac'
                ? t('We detected you are using macOS. Download the Mac version below.', '检测到您正在使用 macOS，请下载 Mac 版本。')
                : t('We detected you are using Windows. Download the Windows version below.', '检测到您正在使用 Windows，请下载 Windows 版本。')}
            </AlertDescription>
          </Alert>
        )}

        {/* Download cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Mac */}
          <Card className={osDetected === 'mac' ? 'border-primary shadow-lg' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 text-white">
                    <Apple className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">macOS</CardTitle>
                    <CardDescription>{t('Apple Silicon & Intel', 'Apple Silicon 和 Intel')}</CardDescription>
                  </div>
                </div>
                {osDetected === 'mac' && (
                  <Badge variant="default">{t('Recommended', '推荐')}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {macAssets.map((asset) => (
                <div key={asset.name} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {asset.arch === 'arm64' ? 'Apple Silicon (M1/M2/M3)' : 'Intel (x64)'}
                      </span>
                      <Badge variant="outline" className="text-xs">v{asset.version}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{asset.size} · .zip</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleDownload(asset)}
                    disabled={downloading === asset.name}
                  >
                    {downloading === asset.name ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {t('Download', '下载')}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Windows */}
          <Card className={osDetected === 'windows' ? 'border-primary shadow-lg' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white">
                    <Monitor className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Windows</CardTitle>
                    <CardDescription>{t('Windows 10/11 (x64)', 'Windows 10/11 (x64)')}</CardDescription>
                  </div>
                </div>
                {osDetected === 'windows' && WINDOWS_AVAILABLE && (
                  <Badge variant="default">{t('Recommended', '推荐')}</Badge>
                )}
                {!WINDOWS_AVAILABLE && (
                  <Badge variant="secondary">{t('Coming Soon', '即将上线')}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {WINDOWS_AVAILABLE ? (
                windowsAssets.map((asset) => (
                  <div key={asset.name} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">Windows x64</span>
                        <Badge variant="outline" className="text-xs">v{asset.version}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{asset.size} · .exe</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleDownload(asset)}
                      disabled={downloading === asset.name}
                    >
                      {downloading === asset.name ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      {t('Download', '下载')}
                    </Button>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">Windows x64</span>
                      <Badge variant="outline" className="text-xs">v1.0.0</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('In development - use web version for now', '开发中 - 暂请使用网页版')}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" disabled>
                    {t('Coming Soon', '即将上线')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <Card>
            <CardContent className="pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-3">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{t('Faster Performance', '更快性能')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('Native app runs faster than web with local processing.', '原生应用比网页运行更快，支持本地处理。')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-3">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{t('Secure & Private', '安全私密')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('Voice data stays on your device. No upload required.', '语音数据保留在本地，无需上传。')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-3">
                <Headphones className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{t('Local Voice Engine', '本地语音引擎')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('Built-in CosyVoice2 engine for high-quality cloning.', '内置 CosyVoice2 引擎，高质量声音克隆。')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Installation guide */}
        <Card>
          <CardHeader>
            <CardTitle>{t('Installation Guide', '安装指南')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Apple className="h-4 w-4" /> macOS
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>{t('Download the .zip file for your Mac architecture', '下载适合您 Mac 架构的 .zip 文件')}</li>
                <li>{t('Double-click to extract, drag PodcastAI to Applications', '双击解压，将 PodcastAI 拖到应用程序文件夹')}</li>
                <li>{t('First launch: right-click → Open (to bypass Gatekeeper)', '首次启动：右键 → 打开（绕过 Gatekeeper）')}</li>
                <li>{t('Sign in with your account or use desktop verification', '使用账号登录或桌面客户端验证')}</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Monitor className="h-4 w-4" /> Windows
              </h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>{t('Download the .exe installer', '下载 .exe 安装程序')}</li>
                <li>{t('Run the installer and follow the setup wizard', '运行安装程序并按向导操作')}</li>
                <li>{t('Launch PodcastAI from Start Menu', '从开始菜单启动 PodcastAI')}</li>
                <li>{t('Sign in with your account or use desktop verification', '使用账号登录或桌面客户端验证')}</li>
              </ol>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t(
                  'Desktop app requires macOS 11+ or Windows 10+. Voice cloning requires Apple Silicon Mac (M1+) or a Windows PC with GPU.',
                  '桌面客户端需要 macOS 11+ 或 Windows 10+。声音克隆需要 Apple Silicon Mac (M1+) 或带 GPU 的 Windows PC。'
                )}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
