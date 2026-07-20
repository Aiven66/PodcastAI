'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useLocale } from '@/components/locale-provider'

/**
 * Desktop App Callback Page
 *
 * 桌面客户端完成身份验证后，通过 custom scheme 回传 token 到此页面。
 * 页面接收 token 后，通过自定义事件 `podcastai:desktop-auth` 通知
 * AuthProvider 的 signInWithDesktop Promise resolve。
 */
function DesktopCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { verifyDesktopToken } = useAuth()
  const { locale } = useLocale()
  const t = (en: string, zh: string) => locale === 'en' ? en : zh

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const token = searchParams.get('token') || searchParams.get('access_token')
    const error = searchParams.get('error')

    if (error) {
      setStatus('error')
      setErrorMsg(decodeURIComponent(error))
      return
    }

    if (!token) {
      setStatus('error')
      setErrorMsg(t('No token received from desktop app', '未收到桌面客户端的 token'))
      return
    }

    // 通过自定义事件通知 AuthProvider 的 signInWithDesktop Promise
    window.dispatchEvent(new CustomEvent('podcastai:desktop-auth', {
      detail: { token }
    }))

    // 同时调用 verifyDesktopToken 验证并设置用户状态
    verifyDesktopToken(token)
      .then(() => {
        setStatus('success')
        // 短暂延迟后跳转首页
        setTimeout(() => router.push('/'), 800)
      })
      .catch((err) => {
        setStatus('error')
        setErrorMsg(err instanceof Error ? err.message : t('Token verification failed', 'Token 验证失败'))
      })
  }, [searchParams, router, verifyDesktopToken, t])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        {status === 'processing' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">
                {t('Completing Authentication...', '正在完成认证...')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('Verifying token from desktop app', '正在验证桌面客户端的 token')}
              </p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">
                {t('Authentication Successful!', '认证成功！')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('Redirecting to home...', '正在跳转首页...')}
              </p>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mx-auto">
              <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">
                {t('Authentication Failed', '认证失败')}
              </h2>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
            </div>
            <button
              onClick={() => router.push('/login')}
              className="text-primary underline text-sm"
            >
              {t('Back to Login', '返回登录')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function DesktopCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <DesktopCallbackContent />
    </Suspense>
  )
}
