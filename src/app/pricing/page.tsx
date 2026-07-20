'use client'

import { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Check, Crown, Sparkles, CheckCircle, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useLocale } from '@/components/locale-provider'
import { PaymentModal, type PlanInfo } from '@/components/payment'

const plans = [
  {
    id: 'free',
    name: 'Free',
    nameZh: '免费版',
    price: 0,
    priceZh: '免费',
    description: 'Perfect for trying out',
    descriptionZh: '适合体验功能',
    features: [
      '100 daily credits',
      'Single-host podcast',
      'Basic voice templates',
      'Standard audio quality',
      'Daily credits reset at midnight',
    ],
    featuresZh: [
      '每日100积分',
      '单人播客模式',
      '基础声音模板',
      '标准音质',
      '每日0点积分重置',
    ],
    popular: false,
  },
  {
    id: 'basic',
    name: 'Basic',
    nameZh: '基础版',
    price: 9.99,
    priceZh: '$9.99/月',
    description: 'Great for regular users',
    descriptionZh: '适合日常使用',
    features: [
      '500 credits per month',
      'Single & dual-host podcasts',
      'Voice cloning',
      'High quality audio',
      'Priority processing',
      'Email support',
    ],
    featuresZh: [
      '每月500积分',
      '单人/双人播客',
      '声音克隆功能',
      '高品质音频',
      '优先处理',
      '邮件支持',
    ],
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    nameZh: '专业版',
    price: 29.99,
    priceZh: '$29.99/月',
    description: 'Best for professionals',
    descriptionZh: '适合专业用户',
    features: [
      '2000 credits per month',
      'All podcast features',
      'Unlimited voice cloning',
      'Premium audio quality',
      'Custom voice templates',
      'API access',
      '24/7 priority support',
      'No expiration for credits',
    ],
    featuresZh: [
      '每月2000积分',
      '所有播客功能',
      '无限声音克隆',
      '顶级音质',
      '自定义声音模板',
      'API访问',
      '24/7优先支持',
      '积分永不过期',
    ],
    popular: false,
  },
]

function PricingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { locale } = useLocale()

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanInfo | null>(null)
  const [demoSuccess, setDemoSuccess] = useState(false)

  // 检测 demo 支付成功回调
  useEffect(() => {
    if (searchParams.get('demo_checkout') === 'success') {
      setDemoSuccess(true)
      // 清理 URL 中的 query param
      const url = new URL(window.location.href)
      url.searchParams.delete('demo_checkout')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  const t = (en: string, zh: string) => locale === 'en' ? en : zh

  const handleSubscribe = (planId: string) => {
    if (planId === 'free') {
      if (!user) {
        router.push('/login')
        return
      }
      router.push('/console')
      return
    }

    // 付费方案：打开支付模态框
    const plan = plans.find(p => p.id === planId)
    if (!plan) return

    setSelectedPlan({
      id: plan.id,
      name: locale === 'en' ? plan.name : plan.nameZh,
      price: {
        cn: plan.price,
        intl: plan.price,
      },
      period: locale === 'en' ? 'month' : '月',
    })
    setPaymentOpen(true)
  }

  const handlePaymentSuccess = () => {
    // 支付成功后的回调，可在此刷新积分等
    // Demo 模式下无需实际刷新，真实模式下可调用 /api/credits 重新拉取
    console.log('[Pricing] Payment succeeded, refreshing credits...')
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Demo 支付成功提示 */}
        {demoSuccess && (
          <Alert className="mb-6 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900 dark:text-green-100">
              {t('Payment Successful!', '支付成功！')}
            </AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              {t(
                'Your subscription is now active. Credits have been added to your account.',
                '您的订阅已激活，积分已添加到您的账户。'
              )}
            </AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 h-6 w-6 p-0"
              onClick={() => setDemoSuccess(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Alert>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            {t('Pricing Plans', '价格方案')}
          </Badge>
          <h1 className="text-4xl font-bold mb-4">
            {t('Choose Your Plan', '选择您的方案')}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t(
              'Select the perfect plan for your podcast creation needs. All plans include core features.',
              '选择最适合您播客创作需求的方案。所有方案都包含核心功能。'
            )}
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">
                    <Crown className="h-3 w-3 mr-1" />
                    {t('Most Popular', '最受欢迎')}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">
                  {locale === 'en' ? plan.name : plan.nameZh}
                </CardTitle>
                <div className="text-4xl font-bold mt-2">
                  {locale === 'en' ? `$${plan.price}` : plan.priceZh}
                  {plan.price > 0 && locale === 'en' && (
                    <span className="text-sm text-muted-foreground">/month</span>
                  )}
                </div>
                <CardDescription>
                  {locale === 'en' ? plan.description : plan.descriptionZh}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {(locale === 'en' ? plan.features : plan.featuresZh).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {plan.price === 0
                    ? t('Get Started', '开始使用')
                    : t('Subscribe Now', '立即订阅')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payment Methods */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            {t('Accepted Payment Methods', '支持的支付方式')}
          </p>
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border">
              <span className="font-semibold">PayPal</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border">
              <span className="font-semibold">Creem</span>
            </div>
          </div>
        </div>

        {/* FAQ Link */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground">
            {t('Have questions?', '有问题？')}{' '}
            <Button variant="link" onClick={() => router.push('/faq')}>
              {t('Check our FAQ', '查看常见问题')}
            </Button>
          </p>
        </div>
      </div>

      {/* 支付模态框 */}
      <PaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        plan={selectedPlan}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PricingPageContent />
    </Suspense>
  )
}
