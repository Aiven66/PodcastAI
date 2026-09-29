'use client'

/**
 * Global Feedback Button
 *
 * 浮动在页面右下角的用户反馈按钮，点击直接新开第三方反馈页面（Tally）
 */

import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { useLocale } from '@/components/locale-provider'

const FEEDBACK_URL = 'https://tally.so/r/5BMYVb'

export function GlobalFeedbackButton() {
  const { t } = useLocale()

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        asChild
        variant="default"
        size="sm"
        className="rounded-full shadow-lg"
      >
        <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
          <MessageSquare className="h-4 w-4 mr-2" />
          {t('Feedback', '反馈')}
        </a>
      </Button>
    </div>
  )
}