'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Crown, Zap, Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/locale-provider'

interface InsufficientCreditsDialogProps {
  open: boolean
  onClose: () => void
  balance: number
  cost: number
}

export function InsufficientCreditsDialog({
  open,
  onClose,
  balance,
  cost,
}: InsufficientCreditsDialogProps) {
  const router = useRouter()
  const { locale } = useLocale()
  const t = (en: string, zh: string) => locale === 'en' ? en : zh

  const plans = [
    {
      id: 'basic',
      nameEn: 'Basic Plan',
      nameZh: '基础版',
      price: '$9.99',
      periodEn: '/month',
      periodZh: '/月',
      creditsEn: '500 credits/month',
      creditsZh: '500 积分/月',
      featuresEn: ['Dual host podcasts', 'Voice cloning', 'No daily reset', 'Priority support'],
      featuresZh: ['双人播客', '声音克隆', '积分不清零', '优先支持'],
    },
    {
      id: 'pro',
      nameEn: 'Pro Plan',
      nameZh: '专业版',
      price: '$29.99',
      periodEn: '/month',
      periodZh: '/月',
      creditsEn: '2000 credits/month',
      creditsZh: '2000 积分/月',
      featuresEn: ['Everything in Basic', 'API access', 'Unlimited voice clones', 'Custom voices'],
      featuresZh: ['包含基础版全部功能', 'API 接口', '无限声音克隆', '自定义声音'],
      popular: true,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <Crown className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {t('Insufficient Credits', '积分不足')}
              </DialogTitle>
              <DialogDescription>
                {t(
                  `You need ${cost} credits but only have ${balance}. Upgrade to continue creating podcasts.`,
                  `需要 ${cost} 积分，当前剩余 ${balance} 积分。升级方案以继续创建播客。`
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* 免费版提示 */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  {t('Free Tier', '免费版')}
                </p>
                <p className="text-blue-700 dark:text-blue-300 mt-0.5">
                  {t(
                    'You get 100 free credits daily (reset at 0:00). Come back tomorrow or upgrade for more.',
                    '每天 0 点赠送 100 免费积分。明天再来或升级获取更多积分。'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 付费方案 */}
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-lg border p-4 transition-colors ${
                plan.popular
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  {t('Popular', '热门')}
                </span>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold">
                    {locale === 'en' ? plan.nameEn : plan.nameZh}
                  </h4>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">
                      {locale === 'en' ? plan.periodEn : plan.periodZh}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {locale === 'en' ? plan.creditsEn : plan.creditsZh}
                  </p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {(locale === 'en' ? plan.featuresEn : plan.featuresZh).map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-3"
                variant={plan.popular ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  onClose()
                  router.push('/pricing')
                }}
              >
                {t('Choose Plan', '选择方案')}
              </Button>
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>
          {t('Maybe later', '以后再说')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
