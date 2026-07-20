'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import { useSupabase } from '@/components/supabase-provider'
import { useLocale } from '@/components/locale-provider'

export default function FeedbackPage() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { locale } = useLocale()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [initialized, setInitialized] = useState(false)
  
  const [formData, setFormData] = useState({
    subject: '',
    category: 'general',
    message: '',
    email: '',
  })

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user?.email) {
        setFormData(prev => ({ ...prev, email: user.email ?? '' }))
      }
    })
  }, [supabase])

  const t = (en: string, zh: string) => locale === 'en' ? en : zh

  const categories = [
    { id: 'general', name: 'General Inquiry', nameZh: '一般咨询' },
    { id: 'bug', name: 'Bug Report', nameZh: '错误报告' },
    { id: 'feature', name: 'Feature Request', nameZh: '功能请求' },
    { id: 'payment', name: 'Payment Issue', nameZh: '支付问题' },
    { id: 'other', name: 'Other', nameZh: '其他' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    if (!supabase) {
      setLoading(false)
      return
    }
    
    try {
      const session = await supabase.auth.getSession()
      
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.data.session && { 'x-session': session.data.session.access_token }),
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      
      if (data.success) {
        setSubmitted(true)
      } else {
        alert(data.error || t('Failed to submit feedback', '提交失败'))
      }
    } catch (error) {
      alert(t('Failed to submit feedback', '提交失败'))
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6 space-y-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Send className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">
              {t('Thank You!', '谢谢您！')}
            </h2>
            <p className="text-muted-foreground">
              {t(
                'Your feedback has been submitted. We\'ll review it and respond as soon as possible.',
                '您的反馈已提交。我们会尽快审核并回复。'
              )}
            </p>
            <Button onClick={() => router.push('/')}>
              {t('Back to Home', '返回首页')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            <MessageSquare className="h-3 w-3 mr-1" />
            {t('Feedback', '用户反馈')}
          </Badge>
          <h1 className="text-4xl font-bold mb-4">
            {t('We Value Your Feedback', '我们重视您的反馈')}
          </h1>
          <p className="text-muted-foreground">
            {t(
              'Help us improve by sharing your thoughts, suggestions, or issues',
              '分享您的想法、建议或问题，帮助我们改进'
            )}
          </p>
        </div>

        {/* Feedback Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('Submit Feedback', '提交反馈')}</CardTitle>
            <CardDescription>
              {t('Fill out the form below to send us your feedback', '填写以下表单发送您的反馈')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {!user && (
                <div className="space-y-2">
                  <Label htmlFor="email">{t('Email', '邮箱')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('your@email.com', 'your@email.com')}
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="category">{t('Category', '类别')}</Label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <Button
                      key={cat.id}
                      type="button"
                      variant={formData.category === cat.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, category: cat.id }))}
                    >
                      {locale === 'en' ? cat.name : cat.nameZh}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">{t('Subject', '主题')}</Label>
                <Input
                  id="subject"
                  placeholder={t('Brief description of your feedback', '简要描述您的反馈')}
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">{t('Message', '内容')}</Label>
                <Textarea
                  id="message"
                  placeholder={t('Detailed description of your feedback or issue', '详细描述您的反馈或问题')}
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  rows={5}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('Submitting...', '提交中...')}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {t('Submit Feedback', '提交反馈')}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}