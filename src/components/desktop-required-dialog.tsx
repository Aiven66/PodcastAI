'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Monitor, Apple, ExternalLink } from 'lucide-react'
import { useLocale } from '@/components/locale-provider'
import Link from 'next/link'

interface DesktopRequiredDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feature?: 'clone' | 'tts'
  customMessage?: string
  customMessageZh?: string
}

/**
 * 桌面客户端下载提示对话框
 *
 * 当用户在网页版尝试使用声音克隆 / 播客音频生成等功能时弹出，
 * 引导用户下载桌面客户端。
 */
export function DesktopRequiredDialog({
  open,
  onOpenChange,
  feature = 'clone',
  customMessage,
  customMessageZh,
}: DesktopRequiredDialogProps) {
  const { locale, t } = useLocale()
  const [macArch, setMacArch] = useState<'arm64' | 'x64' | 'unknown'>('unknown')

  useEffect(() => {
    if (typeof window === 'undefined') return
    // 检测 Mac 架构
    const platform = (navigator.userAgent || '').toLowerCase()
    if (platform.includes('mac')) {
      if (platform.includes('arm')) {
        setMacArch('arm64')
      } else {
        setMacArch('x64')
      }
    }
  }, [])

  const featureName = feature === 'clone'
    ? t('Voice Cloning', '声音克隆')
    : t('Podcast Generation', '播客音频生成')

  const message = customMessage || (locale === 'zh'
    ? `${featureName}功能需要下载桌面客户端才能使用。网页版受限于浏览器沙箱和服务器环境，无法运行 CosyVoice2 语音克隆模型和 Python 语音合成服务。`
    : `${featureName} requires the desktop client. The web version is limited by the browser sandbox and server environment, and cannot run the CosyVoice2 voice cloning model or Python speech synthesis service.`)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            {t('Download Desktop Client', '下载桌面客户端')}
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {message}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 功能说明 */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">
              {t('Why desktop client is needed:', '为什么需要桌面客户端：')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>
                {t(
                  'Voice cloning requires CosyVoice2 AI model running locally',
                  '声音克隆需要在本地运行 CosyVoice2 AI 模型'
                )}
              </li>
              <li>
                {t(
                  'Podcast synthesis requires Python speech service',
                  '播客合成需要 Python 语音服务'
                )}
              </li>
              <li>
                {t(
                  'Audio files need local storage (web version file system is read-only)',
                  '音频文件需要本地存储（网页版文件系统只读）'
                )}
              </li>
              <li>
                {t(
                  'Supports long audio synthesis (1 hour+)',
                  '支持长音频合成（1 小时以上）'
                )}
              </li>
            </ul>
          </div>

          {/* 下载按钮 */}
          <div className="grid grid-cols-1 gap-3">
            {/* Mac 下载 */}
            <Link href="/download" className="block">
              <Button
                variant="default"
                className="w-full justify-start"
                size="lg"
              >
                <Apple className="h-5 w-5 mr-3" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">
                    {t('Download for macOS', '下载 macOS 版本')}
                  </span>
                  <span className="text-xs opacity-80">
                    {macArch === 'arm64'
                      ? t('Apple Silicon (M1/M2/M3)', 'Apple Silicon (M1/M2/M3)')
                      : macArch === 'x64'
                      ? t('Intel Chip', 'Intel 芯片')
                      : t('arm64 / x64', 'arm64 / x64')}
                  </span>
                </div>
                <Download className="h-4 w-4 ml-auto" />
              </Button>
            </Link>

            {/* Windows 下载 */}
            <Link href="/download" className="block">
              <Button
                variant="outline"
                className="w-full justify-start"
                size="lg"
              >
                <Monitor className="h-5 w-5 mr-3" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">
                    {t('Download for Windows', '下载 Windows 版本')}
                  </span>
                  <span className="text-xs opacity-80">
                    {t('Coming Soon', '即将上线')}
                  </span>
                </div>
                <ExternalLink className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
          </div>

          {/* 关闭按钮 */}
          <div className="flex justify-end pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {t('Continue using web version', '继续使用网页版')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
