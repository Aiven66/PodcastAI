'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Headphones,
  Download,
  ArrowRight,
  Link2,
  FileUp,
  Type,
  Mic2,
  Users,
  Zap,
  Sparkles,
  Clock,
  CheckCircle2,
  Apple,
  Monitor,
  Shield,
  Volume2,
  Waves,
} from 'lucide-react'
import { useLocale } from '@/components/locale-provider'

// ---------- 数据 ----------

const stats = [
  { value: '10K+', labelEn: 'Podcasts Created', labelZh: '已生成播客' },
  { value: '30s', labelEn: 'Avg Generation', labelZh: '平均生成时间' },
  { value: '50+', labelEn: 'Voice Options', labelZh: '声音选项' },
]

const features = [
  {
    icon: Link2,
    titleEn: 'URL to Podcast',
    titleZh: '链接转播客',
    descEn: 'Paste any article URL and instantly convert it into an engaging podcast with AI-powered content extraction and script generation.',
    descZh: '粘贴任意文章链接，AI 自动提取内容并生成播客脚本，即时转换为引人入胜的播客。',
    pointsEn: ['Supports major article platforms', 'Auto content extraction', 'Smart script generation'],
    pointsZh: ['支持主流文章平台', '自动内容提取', '智能脚本生成'],
  },
  {
    icon: FileUp,
    titleEn: 'File Upload',
    titleZh: '文件上传',
    descEn: 'Upload PDFs, documents, or any text file. AI will analyze the content and transform it into a natural podcast conversation.',
    descZh: '上传 PDF、文档或任意文本文件，AI 自动分析内容并转换为自然的播客对话。',
    pointsEn: ['PDF, DOCX, TXT supported', 'Multi-language content', 'Long document processing'],
    pointsZh: ['支持 PDF、DOCX、TXT', '多语言内容', '长文档处理'],
  },
  {
    icon: Type,
    titleEn: 'Text Input',
    titleZh: '文本输入',
    descEn: 'Directly input your text content and let AI transform it into audio with natural pacing and emotion.',
    descZh: '直接输入文本内容，让 AI 转换为富有自然节奏和情感的音频。',
    pointsEn: ['Direct text to speech', 'Natural pacing', 'Emotion-aware synthesis'],
    pointsZh: ['文本直接转语音', '自然节奏', '情感感知合成'],
  },
  {
    icon: Mic2,
    titleEn: 'Voice Cloning',
    titleZh: '声音克隆',
    descEn: 'Clone your own voice or any voice with just a short audio sample. High-fidelity reproduction powered by CosyVoice2.',
    descZh: '只需短音频样本即可克隆您自己的声音或任意声音。由 CosyVoice2 驱动的高保真还原。',
    pointsEn: ['High-fidelity reproduction', 'Short sample required', 'Powered by CosyVoice2'],
    pointsZh: ['高保真还原', '仅需短样本', '由 CosyVoice2 驱动'],
  },
  {
    icon: Users,
    titleEn: 'Dual Host Mode',
    titleZh: '双人主持模式',
    descEn: 'Create interview-style podcasts with two different voices. Natural back-and-forth dialogue like a real conversation.',
    descZh: '创建两个不同声音的访谈式播客，自然来回对话如同真实访谈。',
    pointsEn: ['Interview-style dialogue', 'Two distinct voices', 'Natural turn-taking'],
    pointsZh: ['访谈式对话', '两种独立声音', '自然轮换发言'],
  },
  {
    icon: Zap,
    titleEn: 'AI Analysis',
    titleZh: 'AI 分析',
    descEn: 'Automatic content analysis and highlights extraction. AI identifies the most important points for engaging podcast content.',
    descZh: '自动内容分析和亮点提取，AI 识别最重要的要点以打造精彩播客内容。',
    pointsEn: ['Auto highlights extraction', 'Content summarization', 'Smart topic detection'],
    pointsZh: ['自动亮点提取', '内容摘要', '智能话题识别'],
  },
]

const steps = [
  {
    num: '01',
    titleEn: 'Paste Content',
    titleZh: '粘贴内容',
    descEn: 'Paste an article URL, upload a document, or input text directly.',
    descZh: '粘贴文章链接、上传文档或直接输入文本。',
    icon: Link2,
  },
  {
    num: '02',
    titleEn: 'Choose Voice',
    titleZh: '选择声音',
    descEn: 'Pick from 50+ voice templates or clone your own voice.',
    descZh: '从 50+ 声音模板中选择，或克隆您自己的声音。',
    icon: Mic2,
  },
  {
    num: '03',
    titleEn: 'Generate Podcast',
    titleZh: '生成播客',
    descEn: 'AI generates a natural podcast with realistic voices in minutes.',
    descZh: 'AI 几分钟内生成富有真实声音的自然播客。',
    icon: Sparkles,
  },
]

const advantages = [
  {
    icon: Mic2,
    titleEn: 'CosyVoice2 Engine',
    titleZh: 'CosyVoice2 引擎',
    descEn: 'State-of-the-art voice cloning model running locally for maximum fidelity and privacy.',
    descZh: '先进的语音克隆模型本地运行，确保最高保真度与隐私。',
  },
  {
    icon: Clock,
    titleEn: 'Long Audio Support',
    titleZh: '长音频支持',
    descEn: 'Generate podcasts up to 1 hour+ with stable voice quality throughout.',
    descZh: '生成 1 小时以上的播客，全程音质稳定。',
  },
  {
    icon: Shield,
    titleEn: 'Privacy First',
    titleZh: '隐私优先',
    descEn: 'All voice processing happens locally. Your audio data never leaves your device.',
    descZh: '所有语音处理在本地完成，音频数据永不离开您的设备。',
  },
  {
    icon: Volume2,
    titleEn: 'High Fidelity',
    titleZh: '高保真音质',
    descEn: 'Studio-quality output with natural emotion, pacing, and pronunciation.',
    descZh: '录音棚级音质输出，自然情感、节奏与发音。',
  },
]

const pricingPlans = [
  {
    nameEn: 'Free',
    nameZh: '免费版',
    price: '$0',
    period: '',
    descEn: 'Perfect for trying out',
    descZh: '试用完美',
    features: [
      { en: '100 daily credits', zh: '100 每日积分' },
      { en: '4 voice templates', zh: '4 声音模板' },
      { en: 'Single-host mode', zh: '单人主持模式' },
    ],
    ctaEn: 'Learn more',
    ctaZh: '了解更多',
    popular: false,
  },
  {
    nameEn: 'Basic',
    nameZh: '基础版',
    price: '$9.99',
    period: '/mo',
    descEn: 'For general creators',
    descZh: '适合普通创作者',
    features: [
      { en: '500 daily credits', zh: '500 每日积分' },
      { en: '10 voice templates', zh: '10 声音模板' },
      { en: 'Dual-host mode', zh: '双人主持模式' },
      { en: '1 cloned voice', zh: '1 个克隆声音' },
    ],
    ctaEn: 'Get started',
    ctaZh: '立即开始',
    popular: true,
  },
  {
    nameEn: 'Pro',
    nameZh: '专业版',
    price: '$29.99',
    period: '/mo',
    descEn: 'For advanced users',
    descZh: '适合高级用户',
    features: [
      { en: 'Unlimited credits', zh: '无限积分' },
      { en: 'All voice templates', zh: '全部声音模板' },
      { en: '5 cloned voices', zh: '5 个克隆声音' },
      { en: 'Priority processing', zh: '优先处理' },
    ],
    ctaEn: 'Learn more',
    ctaZh: '了解更多',
    popular: false,
  },
]

// ---------- 主组件 ----------

export default function HomePage() {
  const { locale, t } = useLocale()

  return (
    <div className="flex flex-col">
      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden">
        {/* 背景渐变装饰 */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 h-[600px] w-[1200px] rounded-full bg-primary/10 blur-3xl opacity-30" />

        <div className="container mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-12 md:pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* 左侧：文案 + CTA */}
            <div className="flex flex-col gap-6 text-center lg:text-left">
              <div className="flex justify-center lg:justify-start">
                <Badge variant="secondary" className="px-3 py-1 text-sm">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  {t('AI-Powered Podcast Generation', 'AI 驱动播客生成')}
                </Badge>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                {t('Transform Any Content into', '将任意内容转化为')}
                <br />
                <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  {t('Engaging Podcasts', '引人入胜的播客')}
                </span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0">
                {t(
                  'Convert articles, documents, and text into natural-sounding podcasts with AI-powered voice cloning and synthesis. Powered by CosyVoice2.',
                  '使用 AI 驱动的声音克隆与合成技术，将文章、文档和文本转换为自然播客。由 CosyVoice2 驱动。'
                )}
              </p>

              {/* 主 CTA + 次 CTA */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mt-2">
                <Button size="lg" asChild className="h-12 px-6 text-base">
                  <Link href="/download">
                    <Download className="h-5 w-5 mr-2" />
                    {t('Download Desktop Client', '立即下载桌面客户端')}
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="h-12 px-6 text-base">
                  <Link href="/pricing">
                    {t('View Pricing', '查看价格')}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Link>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center lg:text-left">
                {t(
                  'macOS Apple Silicon & Intel · Windows coming soon · Free to start',
                  'macOS Apple Silicon 与 Intel · Windows 即将上线 · 免费开始'
                )}
              </p>

              {/* 数据指标 */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
                {stats.map((stat) => (
                  <div key={stat.value} className="text-center lg:text-left">
                    <div className="text-2xl md:text-3xl font-bold">{stat.value}</div>
                    <div className="text-xs md:text-sm text-muted-foreground mt-1">
                      {t(stat.labelEn, stat.labelZh)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 右侧：产品 Mockup */}
            <div className="relative">
              <ProductMockup locale={locale} />
            </div>
          </div>
        </div>
      </section>

      {/* ============ Social Proof ============ */}
      <section className="border-y bg-muted/20">
        <div className="container mx-auto px-4 md:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-center md:text-left">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                  <div
                    key={letter}
                    className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-purple-600 border-2 border-background flex items-center justify-center text-xs font-semibold text-white"
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <span className="text-sm text-muted-foreground ml-2">
                {t('Trusted by 10,000+ creators worldwide', '已被全球 10,000+ 创作者信赖')}
              </span>
            </div>
            <div className="hidden md:block h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-sm">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-muted-foreground ml-1">
                {t('4.9/5 average rating', '4.9/5 平均评分')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Features (Alternating) ============ */}
      <section className="container mx-auto px-4 md:px-6 py-16 md:py-24">
        <div className="text-center mb-12 md:mb-16">
          <Badge variant="secondary" className="mb-4">
            {t('Powerful Features', '强大功能')}
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            {t('Everything You Need to Create', '创作所需的一切')}
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto text-lg">
            {t(
              'From content input to voice synthesis, PodcastAI provides a complete podcast creation pipeline.',
              '从内容输入到语音合成，PodcastAI 提供完整的播客创作流水线。'
            )}
          </p>
        </div>

        <div className="space-y-16 md:space-y-24">
          {features.map((feature, idx) => {
            const Icon = feature.icon
            const isReversed = idx % 2 === 1
            return (
              <div
                key={feature.titleEn}
                className={`grid md:grid-cols-2 gap-8 md:gap-12 items-center ${
                  isReversed ? 'md:[direction:rtl]' : ''
                }`}
              >
                {/* 文案 */}
                <div className={`md:[direction:ltr] ${isReversed ? 'md:order-2' : ''}`}>
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 text-primary mb-4">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-3">
                    {t(feature.titleEn, feature.titleZh)}
                  </h3>
                  <p className="text-muted-foreground text-lg mb-4">
                    {t(feature.descEn, feature.descZh)}
                  </p>
                  <ul className="space-y-2 mb-6">
                    {(locale === 'zh' ? feature.pointsZh : feature.pointsEn).map((point) => (
                      <li key={point} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" asChild>
                    <Link href="/download">
                      <Download className="h-4 w-4 mr-2" />
                      {t('Download to try', '下载体验')}
                    </Link>
                  </Button>
                </div>

                {/* 示意图 */}
                <div className={`md:[direction:ltr] ${isReversed ? 'md:order-1' : ''}`}>
                  <FeatureIllustration index={idx} icon={Icon} titleEn={feature.titleEn} titleZh={feature.titleZh} locale={locale} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ============ How It Works ============ */}
      <section className="bg-muted/30 border-y">
        <div className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="text-center mb-12 md:mb-16">
            <Badge variant="secondary" className="mb-4">
              {t('How It Works', '使用流程')}
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              {t('Create Your Podcast in 3 Steps', '三步创建您的播客')}
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto text-lg">
              {t(
                'From content to finished podcast in minutes, no technical skills required.',
                '几分钟内从内容到成品播客，无需技术背景。'
              )}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((step, idx) => {
              const Icon = step.icon
              return (
                <div key={step.num} className="relative">
                  {/* 连接线 */}
                  {idx < steps.length - 1 && (
                    <div className="hidden md:block absolute top-12 left-[60%] right-[-20%] h-px bg-gradient-to-r from-primary/40 to-transparent" />
                  )}
                  <div className="relative flex flex-col items-center text-center">
                    <div className="relative">
                      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                      <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </div>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mb-1">{step.num}</div>
                    <h3 className="text-xl font-bold mb-2">{t(step.titleEn, step.titleZh)}</h3>
                    <p className="text-muted-foreground text-sm max-w-xs">
                      {t(step.descEn, step.descZh)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="text-center mt-12">
            <Button size="lg" asChild>
              <Link href="/download">
                <Download className="h-5 w-5 mr-2" />
                {t('Download to Get Started', '下载开始使用')}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ============ Core Advantages ============ */}
      <section className="container mx-auto px-4 md:px-6 py-16 md:py-24">
        <div className="text-center mb-12 md:mb-16">
          <Badge variant="secondary" className="mb-4">
            {t('Why PodcastAI', '为什么选择 PodcastAI')}
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            {t('Built for Quality & Privacy', '为品质与隐私而生')}
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto text-lg">
            {t(
              'Powered by state-of-the-art AI models running locally on your device.',
              '由运行在本地设备上的先进 AI 模型驱动。'
            )}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {advantages.map((adv) => {
            const Icon = adv.icon
            return (
              <Card key={adv.titleEn} className="text-center">
                <CardHeader>
                  <div className="mx-auto h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">{t(adv.titleEn, adv.titleZh)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {t(adv.descEn, adv.descZh)}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* ============ Pricing Preview ============ */}
      <section className="bg-muted/30 border-y">
        <div className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="text-center mb-12 md:mb-16">
            <Badge variant="secondary" className="mb-4">
              {t('Pricing', '价格')}
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              {t('Simple, Transparent Pricing', '简单透明的价格')}
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto text-lg">
              {t('Start for free, upgrade when you need more.', '免费开始，需要更多时升级。')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingPlans.map((plan) => (
              <Card
                key={plan.nameEn}
                className={plan.popular ? 'border-primary relative' : 'relative'}
              >
                {plan.popular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                    {t('Popular', '热门')}
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{t(plan.nameEn, plan.nameZh)}</CardTitle>
                  <div className="text-4xl font-bold">
                    {plan.price}
                    {plan.period && (
                      <span className="text-sm text-muted-foreground font-normal">{plan.period}</span>
                    )}
                  </div>
                  <CardDescription>{t(plan.descEn, plan.descZh)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {plan.features.map((f) => (
                    <div key={f.en} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{t(f.en, f.zh)}</span>
                    </div>
                  ))}
                  <Button
                    className="w-full mt-4"
                    variant={plan.popular ? 'default' : 'outline'}
                    asChild
                  >
                    <Link href="/pricing">{t(plan.ctaEn, plan.ctaZh)}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Final CTA ============ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-purple-500/5 to-background" />
        <div className="container mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
              <Headphones className="h-8 w-8" />
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              {t('Start Creating Your Podcast Today', '立即开始创作您的播客')}
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
              {t(
                'Download PodcastAI desktop client and transform any content into engaging podcasts in minutes.',
                '下载 PodcastAI 桌面客户端，几分钟内将任意内容转化为精彩播客。'
              )}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <Button size="lg" asChild className="h-12 px-8 text-base">
                <Link href="/download">
                  <Download className="h-5 w-5 mr-2" />
                  {t('Download for macOS', '下载 macOS 版本')}
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-12 px-8 text-base">
                <Link href="/download">
                  <Monitor className="h-5 w-5 mr-2" />
                  {t('Windows Coming Soon', 'Windows 即将上线')}
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Apple className="h-4 w-4" />
                {t('macOS 11+', 'macOS 11+')}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t('Free to start', '免费开始')}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t('No credit card required', '无需信用卡')}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// ---------- 子组件：产品 Mockup（Hero 右侧）----------

function ProductMockup({ locale }: { locale: string }) {
  const t = (en: string, zh: string) => (locale === 'zh' ? zh : en)
  return (
    <div className="relative">
      {/* 主窗口 */}
      <div className="relative rounded-xl border bg-card shadow-2xl overflow-hidden">
        {/* 窗口顶栏 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 text-center text-xs text-muted-foreground">
            PodcastAI
          </div>
        </div>

        {/* 内容区 */}
        <div className="p-5 space-y-4">
          {/* 标题 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Headphones className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold">{t('Podcast Generator', '播客生成器')}</div>
                <div className="text-xs text-muted-foreground">{t('Ready to generate', '准备就绪')}</div>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              AI
            </Badge>
          </div>

          {/* 输入框 mock */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">{t('Content Input', '内容输入')}</div>
            <div className="rounded-md border bg-background p-3 space-y-1.5">
              <div className="h-2 w-3/4 bg-muted rounded-full" />
              <div className="h-2 w-full bg-muted rounded-full" />
              <div className="h-2 w-5/6 bg-muted rounded-full" />
              <div className="h-2 w-2/3 bg-muted rounded-full" />
            </div>
          </div>

          {/* 声音选择 mock */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border bg-background p-2.5 flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{t('Sarah', 'Sarah 晓晓')}</div>
                <div className="text-[10px] text-muted-foreground">{t('Female Host', '女主播')}</div>
              </div>
            </div>
            <div className="rounded-md border-2 border-primary bg-background p-2.5 flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{t('David', 'David 云希')}</div>
                <div className="text-[10px] text-muted-foreground">{t('Male Narrator', '男叙述')}</div>
              </div>
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>

          {/* 进度条 mock */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('Generating...', '生成中...')}</span>
              <span className="font-mono text-primary">75%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full w-3/4 bg-gradient-to-r from-primary to-purple-500 rounded-full" />
            </div>
          </div>

          {/* 播放控制 mock */}
          <div className="rounded-md border bg-background p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
              <svg className="h-4 w-4 text-primary-foreground ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-1/3 bg-primary rounded-full" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-mono">12:34</div>
          </div>
        </div>
      </div>

      {/* 浮动装饰：声音波形 */}
      <div className="absolute -bottom-4 -left-4 rounded-lg border bg-card shadow-lg p-3 hidden md:flex items-center gap-1.5">
        <Waves className="h-5 w-5 text-primary" />
        <div className="flex items-end gap-0.5 h-6">
          {[6, 12, 18, 14, 10, 16, 8].map((h, i) => (
            <div
              key={i}
              className="w-1 bg-primary/60 rounded-full"
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
      </div>

      {/* 浮动装饰：克隆标识 */}
      <div className="absolute -top-3 -right-3 rounded-lg border bg-card shadow-lg p-2.5 hidden md:flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
          <Mic2 className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="text-xs">
          <div className="font-medium">{t('Voice Cloned', '声音已克隆')}</div>
          <div className="text-muted-foreground text-[10px]">CosyVoice2</div>
        </div>
      </div>
    </div>
  )
}

// ---------- 子组件：Feature 示意图 ----------

function FeatureIllustration({
  index,
  icon: Icon,
  titleEn,
  titleZh,
  locale,
}: {
  index: number
  icon: React.ComponentType<{ className?: string }>
  titleEn: string
  titleZh: string
  locale: string
}) {
  const t = (en: string, zh: string) => (locale === 'zh' ? zh : en)

  // 不同功能展示不同的示意图
  const illustrations = [
    // 0: URL to Podcast - 链接输入到播客
    <div key="0" className="rounded-xl border bg-card shadow-lg overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="text-xs text-muted-foreground">{t('Article URL', '文章链接')}</div>
        <div className="rounded-md border bg-background p-2.5 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex-1 text-xs text-muted-foreground truncate">
            https://blog.example.com/article...
          </div>
        </div>
        <div className="flex justify-center">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="text-xs text-muted-foreground">{t('AI Extraction', 'AI 提取')}</div>
        <div className="space-y-1.5">
          <div className="h-2 w-full bg-muted rounded-full" />
          <div className="h-2 w-5/6 bg-muted rounded-full" />
          <div className="h-2 w-3/4 bg-muted rounded-full" />
        </div>
        <div className="flex justify-center">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="rounded-md bg-primary/10 p-3 flex items-center gap-2">
          <Headphones className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="text-xs font-medium">{t('Podcast Ready', '播客已就绪')}</div>
            <div className="text-[10px] text-muted-foreground">12:34 · {t('Single Host', '单人主持')}</div>
          </div>
        </div>
      </div>
    </div>,

    // 1: File Upload
    <div key="1" className="rounded-xl border bg-card shadow-lg overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="text-xs text-muted-foreground">{t('Upload Document', '上传文档')}</div>
        <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center">
          <FileUp className="h-8 w-8 mx-auto text-primary mb-2" />
          <div className="text-xs font-medium">{t('Drop file here', '拖拽文件到此处')}</div>
          <div className="text-[10px] text-muted-foreground mt-1">PDF, DOCX, TXT</div>
        </div>
        <div className="space-y-2">
          {[
            { name: 'research-paper.pdf', size: '2.4 MB', color: 'bg-red-500' },
            { name: 'article.docx', size: '156 KB', color: 'bg-blue-500' },
          ].map((f) => (
            <div key={f.name} className="rounded-md border bg-background p-2 flex items-center gap-2">
              <div className={`h-6 w-6 rounded ${f.color} flex items-center justify-center`}>
                <FileUp className="h-3 w-3 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{f.name}</div>
                <div className="text-[10px] text-muted-foreground">{f.size}</div>
              </div>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            </div>
          ))}
        </div>
      </div>
    </div>,

    // 2: Text Input
    <div key="2" className="rounded-xl border bg-card shadow-lg overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="text-xs text-muted-foreground">{t('Direct Text Input', '直接文本输入')}</div>
        <div className="rounded-md border bg-background p-3 space-y-1.5 font-mono text-xs">
          <div className="text-muted-foreground"># {t('Podcast Script', '播客脚本')}</div>
          <div>{t('Hello and welcome to', '大家好，欢迎收听')}</div>
          <div>{t('today\'s episode where we', '本期节目，我们')}</div>
          <div>{t('explore AI technology', '探讨 AI 技术')}</div>
          <div className="text-muted-foreground"># {t('Host narration', '主持人旁白')}</div>
          <div>{t('Let\'s dive deeper into', '让我们深入了解')}</div>
          <div>{t('this fascinating topic...', '这个有趣的话题...')}</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="text-[10px]">{t('1,247 chars', '1,247 字符')}</Badge>
          <Badge variant="secondary" className="text-[10px]">{t('~5 min audio', '约 5 分钟音频')}</Badge>
        </div>
      </div>
    </div>,

    // 3: Voice Cloning
    <div key="3" className="rounded-xl border bg-card shadow-lg overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="text-xs text-muted-foreground">{t('Voice Cloning Process', '声音克隆流程')}</div>
        {/* 音频波形输入 */}
        <div className="rounded-md border bg-background p-3">
          <div className="text-[10px] text-muted-foreground mb-1.5">{t('Input Sample (10s)', '输入样本（10秒）')}</div>
          <div className="flex items-end gap-0.5 h-8">
            {[4, 8, 14, 20, 16, 10, 18, 22, 14, 8, 12, 18, 10, 6, 14, 20, 12, 8, 16, 10].map((h, i) => (
              <div key={i} className="flex-1 bg-primary/60 rounded-full" style={{ height: `${h}px` }} />
            ))}
          </div>
        </div>
        <div className="flex justify-center items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <Badge variant="secondary" className="text-[10px]">
            <Sparkles className="h-3 w-3 mr-1" />
            CosyVoice2
          </Badge>
          <div className="h-px flex-1 bg-border" />
        </div>
        {/* 克隆结果 */}
        <div className="rounded-md border-2 border-primary bg-primary/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
              <Mic2 className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium">{t('Cloned Voice', '克隆声音')}</div>
              <div className="text-[10px] text-green-600">{t('98% similarity', '98% 相似度')}</div>
            </div>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>
          <div className="flex items-end gap-0.5 h-6">
            {[6, 12, 18, 14, 10, 16, 8, 14, 20, 12].map((h, i) => (
              <div key={i} className="flex-1 bg-primary rounded-full" style={{ height: `${h}px` }} />
            ))}
          </div>
        </div>
      </div>
    </div>,

    // 4: Dual Host
    <div key="4" className="rounded-xl border bg-card shadow-lg overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="text-xs text-muted-foreground">{t('Dual Host Dialogue', '双人主持对话')}</div>
        {/* Host 1 */}
        <div className="rounded-md border bg-background p-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
            <div className="text-xs font-medium">{t('Host', '主持人')}</div>
            <Badge variant="secondary" className="text-[10px] ml-auto">Sarah</Badge>
          </div>
          <div className="text-xs text-muted-foreground pl-8">
            {t('Welcome to today\'s show...', '欢迎来到今天的节目...')}
          </div>
        </div>
        {/* Host 2 */}
        <div className="rounded-md border bg-background p-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500" />
            <div className="text-xs font-medium">{t('Guest', '嘉宾')}</div>
            <Badge variant="secondary" className="text-[10px] ml-auto">David</Badge>
          </div>
          <div className="text-xs text-muted-foreground pl-8">
            {t('Thanks for having me...', '谢谢邀请...')}
          </div>
        </div>
        <div className="rounded-md border bg-background p-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
            <div className="text-xs font-medium">{t('Host', '主持人')}</div>
            <Badge variant="secondary" className="text-[10px] ml-auto">Sarah</Badge>
          </div>
          <div className="text-xs text-muted-foreground pl-8">
            {t('That\'s fascinating, tell me more...', '太有趣了，再多说说...')}
          </div>
        </div>
      </div>
    </div>,

    // 5: AI Analysis
    <div key="5" className="rounded-xl border bg-card shadow-lg overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="text-xs text-muted-foreground">{t('AI Content Analysis', 'AI 内容分析')}</div>
        {/* Highlights */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase">{t('Key Highlights', '核心亮点')}</div>
          {[
            { icon: '📊', text: t('Market growth 250% YoY', '市场年增长 250%'), confidence: '94%' },
            { icon: '💡', text: t('New AI breakthrough', 'AI 新突破'), confidence: '89%' },
            { icon: '🎯', text: t('User adoption trends', '用户采用趋势'), confidence: '92%' },
          ].map((h, i) => (
            <div key={i} className="rounded-md border bg-background p-2.5 flex items-center gap-2">
              <div className="text-base">{h.icon}</div>
              <div className="flex-1 text-xs">{h.text}</div>
              <Badge variant="secondary" className="text-[10px]">{h.confidence}</Badge>
            </div>
          ))}
        </div>
        {/* Topics */}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase">{t('Detected Topics', '识别话题')}</div>
          <div className="flex flex-wrap gap-1.5">
            {['AI', 'Tech', 'Future', t('Innovation', '创新'), 'Market'].map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
            ))}
          </div>
        </div>
      </div>
    </div>,
  ]

  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-3xl blur-2xl" />
      {illustrations[index] || illustrations[0]}
    </div>
  )
}
