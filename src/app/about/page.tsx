'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Headphones, Sparkles, Users, Globe } from 'lucide-react'

export default function AboutPage() {
  const [locale, setLocale] = useState('en')

  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') || 'en'
    setLocale(savedLocale)
  }, [])

  const t = (en: string, zh: string) => locale === 'en' ? en : zh

  const features = [
    {
      icon: Headphones,
      title: 'AI-Powered Podcast Creation',
      titleZh: 'AI驱动的播客创作',
      desc: 'Transform any text, link, or file into engaging podcasts with natural voices',
      descZh: '将任何文本、链接或文件转换为引人入胜的播客，配上自然的语音',
    },
    {
      icon: Sparkles,
      title: 'Voice Cloning Technology',
      titleZh: '声音克隆技术',
      desc: 'Clone your own voice or use premium voice templates for unique podcasts',
      descZh: '克隆您自己的声音或使用高级声音模板，创作独特的播客',
    },
    {
      icon: Users,
      title: 'Single & Dual Host Modes',
      titleZh: '单人/双人主持模式',
      desc: 'Create narrative podcasts or interview-style conversations with two hosts',
      descZh: '创建叙述式播客或带有两位主持人的访谈式对话',
    },
    {
      icon: Globe,
      title: 'Global Reach',
      titleZh: '全球覆盖',
      desc: 'Supporting users worldwide with multiple languages and payment options',
      descZh: '支持全球用户，提供多种语言和支付选项',
    },
  ]

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            {t('About Us', '关于我们')}
          </Badge>
          <h1 className="text-4xl font-bold mb-4">
            {t('Welcome to PodcastAI', '欢迎来到PodcastAI')}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            {t(
              'We\'re revolutionizing podcast creation with AI technology, making it accessible to everyone',
              '我们正在用AI技术革新播客创作，让每个人都能轻松创建播客'
            )}
          </p>
        </div>

        {/* Mission */}
        <Card className="mb-12">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold mb-4 text-center">
              {t('Our Mission', '我们的使命')}
            </h2>
            <p className="text-muted-foreground text-center leading-relaxed">
              {t(
                'PodcastAI was founded with a simple mission: to democratize podcast creation. We believe that everyone should have the ability to create professional-quality podcasts without expensive equipment or technical expertise. Our AI-powered platform transforms written content into engaging audio experiences, opening new possibilities for content creators, educators, and businesses worldwide.',
                'PodcastAI的使命很简单：让播客创作大众化。我们相信每个人都应该能够创建专业质量的播客，无需昂贵的设备或专业技术。我们的AI驱动平台将书面内容转化为引人入胜的音频体验，为全球内容创作者、教育工作者和企业开辟新的可能性。'
              )}
            </p>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2">
                      {locale === 'en' ? feature.title : feature.titleZh}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {locale === 'en' ? feature.desc : feature.descZh}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary mb-1">10K+</div>
              <div className="text-sm text-muted-foreground">
                {t('Podcasts Created', '创建播客')}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary mb-1">5K+</div>
              <div className="text-sm text-muted-foreground">
                {t('Active Users', '活跃用户')}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary mb-1">100+</div>
              <div className="text-sm text-muted-foreground">
                {t('Countries', '国家')}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact */}
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            {t('Have questions or feedback?', '有问题或反馈？')}
          </p>
          <Badge variant="outline" className="cursor-pointer">
            <a href="/feedback" className="flex items-center gap-2">
              {t('Contact Us', '联系我们')}
            </a>
          </Badge>
        </div>
      </div>
    </div>
  )
}