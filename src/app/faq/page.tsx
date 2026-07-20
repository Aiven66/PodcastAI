'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp } from 'lucide-react'

const faqs = [
  {
    category: 'General',
    categoryZh: '通用',
    questions: [
      {
        q: 'What is PodcastAI?',
        qZh: 'PodcastAI是什么？',
        a: 'PodcastAI is an AI-powered platform that converts text, links, or files into professional podcasts. It supports single-host and dual-host formats with customizable voices.',
        aZh: 'PodcastAI是一个AI驱动的平台，可以将文本、链接或文件转换为专业播客。支持单人和双人格式，可自定义声音。',
      },
      {
        q: 'How does the credit system work?',
        qZh: '积分系统如何运作？',
        a: 'Free users get 100 daily credits that reset at midnight. Each podcast generation costs 30 credits. Paid plans offer more credits with no expiration.',
        aZh: '免费用户每日获得100积分，午夜重置。每次播客生成消耗30积分。付费方案提供更多积分且永不过期。',
      },
    ],
  },
  {
    category: 'Podcast Creation',
    categoryZh: '播客创建',
    questions: [
      {
        q: 'What input formats are supported?',
        qZh: '支持哪些输入格式？',
        a: 'You can input text directly, paste a URL to extract content, or upload files (PDF, DOC, TXT). The AI will analyze and convert the content into podcast script.',
        aZh: '您可以直接输入文本、粘贴URL提取内容，或上传文件（PDF、DOC、TXT）。AI将分析并将内容转换为播客脚本。',
      },
      {
        q: 'Can I create dual-host podcasts?',
        qZh: '可以创建双人播客吗？',
        a: 'Yes! Our platform supports both single-host narrative style and dual-host interview style podcasts. You can choose different voices for each host.',
        aZh: '是的！我们的平台支持单人叙述风格和双人访谈风格播客。您可以为每位主持人选择不同的声音。',
      },
    ],
  },
  {
    category: 'Voice Cloning',
    categoryZh: '声音克隆',
    questions: [
      {
        q: 'How does voice cloning work?',
        qZh: '声音克隆如何工作？',
        a: 'Upload an audio sample of your voice (10 seconds minimum). Our AI will analyze and create a voice profile that can be used for podcast generation.',
        aZh: '上传您的声音音频样本（至少10秒）。我们的AI将分析并创建声音档案，用于播客生成。',
      },
      {
        q: 'Is voice cloning safe?',
        qZh: '声音克隆安全吗？',
        a: 'Voice cloning is only available for your own voice or with explicit permission. We have strict policies against voice misuse.',
        aZh: '声音克隆仅适用于您自己的声音或获得明确许可。我们对声音滥用有严格政策。',
      },
    ],
  },
  {
    category: 'Pricing & Payment',
    categoryZh: '定价与支付',
    questions: [
      {
        q: 'What payment methods are available?',
        qZh: '支持哪些支付方式？',
        a: 'We accept PayPal and Stripe (credit cards). All transactions are secure and encrypted.',
        aZh: '我们接受PayPal和Stripe（信用卡）。所有交易均安全加密。',
      },
      {
        q: 'Can I cancel my subscription?',
        qZh: '可以取消订阅吗？',
        a: 'Yes, you can cancel anytime. Your subscription remains active until the end of the billing period.',
        aZh: '是的，您可以随时取消。您的订阅在账单周期结束前保持有效。',
      },
    ],
  },
]

export default function FAQPage() {
  const [locale, setLocale] = useState('en')
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') || 'en'
    setLocale(savedLocale)
  }, [])

  const t = (en: string, zh: string) => locale === 'en' ? en : zh

  const toggleQuestion = (key: string) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            {t('FAQ', '常见问题')}
          </Badge>
          <h1 className="text-4xl font-bold mb-4">
            {t('Frequently Asked Questions', '常见问题解答')}
          </h1>
          <p className="text-muted-foreground">
            {t(
              'Find answers to common questions about PodcastAI',
              '查找关于PodcastAI的常见问题答案'
            )}
          </p>
        </div>

        {/* FAQ Categories */}
        <div className="space-y-8">
          {faqs.map((category) => (
            <Card key={category.category}>
              <CardHeader>
                <CardTitle className="text-xl">
                  {locale === 'en' ? category.category : category.categoryZh}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {category.questions.map((faq, index) => {
                  const key = `${category.category}-${index}`
                  const isExpanded = expandedQuestions[key]
                  
                  return (
                    <div 
                      key={key}
                      className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleQuestion(key)}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium pr-4">
                          {locale === 'en' ? faq.q : faq.qZh}
                        </h3>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      {isExpanded && (
                        <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
                          {locale === 'en' ? faq.a : faq.aZh}
                        </p>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contact Support */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            {t('Still have questions?', '还有问题？')}{' '}
            <a href="/feedback" className="text-primary underline">
              {t('Contact our support team', '联系我们的支持团队')}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}