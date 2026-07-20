'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Download,
  Crown,
  Headphones,
  Mic2,
  History,
  Apple,
  Monitor,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Shield,
  Clock,
  Volume2,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useLocale } from '@/components/locale-provider'
import { useCredits, ADMIN_DAILY_CREDITS } from '@/hooks/use-credits'

export default function ConsolePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { locale } = useLocale()
  const t = (en: string, zh: string) => (locale === 'en' ? en : zh)

  // 积分系统
  const { balance: credits } = useCredits()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  if (authLoading || !user) {
    return (
      <div className="container mx-auto px-4 py-24 flex flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground mt-4">{t('Loading...', '加载中...')}</p>
      </div>
    )
  }

  const isAdmin = user.email === 'admin@126.com' || user.role === 'admin'
  const dailyLimit = isAdmin ? ADMIN_DAILY_CREDITS : 100
  const initial = (user.email?.[0] || 'U').toUpperCase()

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {t('My Account', '我的账号')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('Manage your account and access desktop features', '管理您的账号并使用桌面端功能')}
        </p>
      </div>

      {/* 醒目下载引导 Banner */}
      <Card className="mb-8 border-primary overflow-hidden relative">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-purple-500/5 to-background" />
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Download className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl md:text-2xl font-bold mb-2">
                {t('Download Desktop Client to Start Creating', '下载桌面客户端开始创作')}
              </h2>
              <p className="text-muted-foreground text-sm md:text-base mb-4">
                {t(
                  'Voice cloning, podcast generation, and history management are available exclusively in the desktop client. The web version supports account management and subscription only.',
                  '声音克隆、播客生成和历史记录管理仅在桌面客户端提供。网页版仅支持账号管理和订阅。'
                )}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground mb-4">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  {t('CosyVoice2 Engine', 'CosyVoice2 引擎')}
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  {t('Voice Cloning', '声音克隆')}
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  {t('Long Audio Synthesis', '长音频合成')}
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  {t('Local Privacy', '本地隐私')}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="h-11">
                  <Link href="/download">
                    <Download className="h-4 w-4 mr-2" />
                    {t('Download for macOS', '下载 macOS 版本')}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-11">
                  <Link href="/download">
                    <Monitor className="h-4 w-4 mr-2" />
                    {t('Windows Coming Soon', 'Windows 即将上线')}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 左侧：账号信息 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 账号卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('Account Info', '账号信息')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 头像 + 名称 */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {user.name || user.email}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                </div>
              </div>

              {/* 角色徽章 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('Role', '角色')}:</span>
                {isAdmin ? (
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500">
                    <Crown className="h-3 w-3 mr-1" />
                    {t('Admin', '管理员')}
                  </Badge>
                ) : (
                  <Badge variant="secondary">{t('User', '用户')}</Badge>
                )}
              </div>

              {/* 用户 ID */}
              <div className="text-xs text-muted-foreground font-mono break-all">
                ID: {user.id}
              </div>
            </CardContent>
          </Card>

          {/* 积分卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('Credits Balance', '积分余额')}</CardTitle>
              <CardDescription>
                {t('Credits can be used in the desktop client', '积分可在桌面客户端中使用')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-3xl font-bold">{credits}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t('Current Balance', '当前余额')}
                </div>
              </div>
              <div className="pt-3 border-t space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('Daily Limit', '每日上限')}</span>
                  <span className="font-medium">{dailyLimit}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('Reset Time', '重置时间')}</span>
                  <span>00:00 UTC</span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                <Link href="/pricing">
                  {t('Get More Credits', '获取更多积分')}
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* 订阅状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('Subscription', '订阅')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{t('Current Plan', '当前套餐')}</span>
                <Badge variant="secondary">
                  {isAdmin ? t('Admin Plan', '管理员套餐') : t('Free Plan', '免费版')}
                </Badge>
              </div>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/pricing">
                  {t('View Plans', '查看套餐')}
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：桌面端功能说明 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 功能说明 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Headphones className="h-5 w-5 text-primary" />
                {t('Desktop Client Features', '桌面客户端功能')}
              </CardTitle>
              <CardDescription>
                {t(
                  'The following features are only available in the desktop client',
                  '以下功能仅在桌面客户端提供'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  {
                    icon: Mic2,
                    titleEn: 'Voice Cloning',
                    titleZh: '声音克隆',
                    descEn: 'Clone any voice with CosyVoice2, high-fidelity reproduction',
                    descZh: '使用 CosyVoice2 克隆任意声音，高保真还原',
                  },
                  {
                    icon: Headphones,
                    titleEn: 'Podcast Generation',
                    titleZh: '播客生成',
                    descEn: 'Convert URL, file, or text to natural-sounding podcasts',
                    descZh: '将链接、文件或文本转换为自然播客',
                  },
                  {
                    icon: History,
                    titleEn: 'History Management',
                    titleZh: '历史记录管理',
                    descEn: 'View, replay, and manage all your generated podcasts',
                    descZh: '查看、回放和管理所有已生成的播客',
                  },
                  {
                    icon: Volume2,
                    titleEn: 'Voice Templates',
                    titleZh: '声音模板',
                    descEn: '50+ professional voice templates in multiple languages',
                    descZh: '50+ 专业声音模板，支持多语言',
                  },
                ].map((f) => {
                  const Icon = f.icon
                  return (
                    <div
                      key={f.titleEn}
                      className="rounded-lg border bg-muted/20 p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm mb-1">{t(f.titleEn, f.titleZh)}</div>
                          <div className="text-xs text-muted-foreground">
                            {t(f.descEn, f.descZh)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* 为什么需要桌面客户端 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {t('Why Desktop Client?', '为什么需要桌面客户端？')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  {t(
                    'Voice cloning and podcast synthesis require running AI models locally, which cannot be done in a browser.',
                    '声音克隆和播客合成需要在本地运行 AI 模型，浏览器无法完成。'
                  )}
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                {[
                  {
                    icon: Mic2,
                    titleEn: 'Local AI Model',
                    titleZh: '本地 AI 模型',
                    descEn: 'CosyVoice2 runs locally on your device, no internet required for synthesis',
                    descZh: 'CosyVoice2 在本地设备运行，合成无需联网',
                  },
                  {
                    icon: Clock,
                    titleEn: 'Long Audio Support',
                    titleZh: '长音频支持',
                    descEn: 'Generate podcasts up to 1 hour+ without browser timeouts',
                    descZh: '生成 1 小时以上播客，无浏览器超时限制',
                  },
                  {
                    icon: Shield,
                    titleEn: 'Privacy Protection',
                    titleZh: '隐私保护',
                    descEn: 'Audio data is processed locally and never uploaded to the cloud',
                    descZh: '音频数据本地处理，永不上传云端',
                  },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.titleEn} className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{t(item.titleEn, item.titleZh)}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t(item.descEn, item.descZh)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* 最终 CTA */}
          <Card className="bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/30">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg md:text-xl font-bold mb-2">
                {t('Ready to Start Creating?', '准备好开始创作了吗？')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                {t(
                  'Download PodcastAI desktop client now and start creating your first podcast in minutes.',
                  '立即下载 PodcastAI 桌面客户端，几分钟内开始创作您的第一个播客。'
                )}
              </p>
              <Button size="lg" asChild>
                <Link href="/download">
                  <Download className="h-4 w-4 mr-2" />
                  {t('Download Now', '立即下载')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 底部平台信息 */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Apple className="h-3.5 w-3.5" />
          {t('macOS 11+ (Apple Silicon & Intel)', 'macOS 11+（Apple Silicon 与 Intel）')}
        </span>
        <span className="flex items-center gap-1.5">
          <Monitor className="h-3.5 w-3.5" />
          {t('Windows 10+ (Coming Soon)', 'Windows 10+（即将上线）')}
        </span>
      </div>
    </div>
  )
}
