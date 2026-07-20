'use client'

/**
 * Global Feedback Button
 *
 * 浮动在页面右下角的用户反馈按钮
 * 支持内部反馈页面 + 外部 Tally 表单双通道
 */

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MessageSquare, ExternalLink, ChevronUp, X } from 'lucide-react'
import { useLocale } from '@/components/locale-provider'

const EXTERNAL_FEEDBACK_URL = 'https://tally.so/r/5BMYVb'

export function GlobalFeedbackButton() {
  const { locale } = useLocale()
  const [expanded, setExpanded] = useState(false)
  const t = (en: string, zh: string) => locale === 'en' ? en : zh

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {expanded && (
        <div className="flex flex-col gap-2 w-56 rounded-xl border bg-card p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-medium">{t('Feedback', '反馈')}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setExpanded(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <Button
            asChild
            variant="default"
            size="sm"
            className="w-full justify-start"
            onClick={() => setExpanded(false)}
          >
            <Link href="/feedback">
              <MessageSquare className="h-4 w-4 mr-2" />
              {t('Submit Feedback', '提交反馈')}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setExpanded(false)}
          >
            <a
              href={EXTERNAL_FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('External Form', '外部表单')}
            </a>
          </Button>
        </div>
      )}
      <Button
        variant="default"
        size="sm"
        className="rounded-full shadow-lg"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronUp className="h-4 w-4 mr-2" />
        ) : (
          <MessageSquare className="h-4 w-4 mr-2" />
        )}
        {expanded ? t('Close', '收起') : t('Feedback', '反馈')}
      </Button>
    </div>
  )
}
