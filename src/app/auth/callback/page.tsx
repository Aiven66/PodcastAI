'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Monitor } from 'lucide-react'
import { useSupabase } from '@/components/supabase-provider'
// 复用 packages/auth 桌面端桥接能力
import {
  syncDesktopAuthAndOpen,
  normalizeDesktopCallbackUrl,
  type DesktopAuthPayload,
} from '../../../../packages/auth/desktop-bridge'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { supabase } = useSupabase()
  const [error, setError] = useState<string | null>(null)
  // v1.0.31: 桌面端流程状态
  const [desktopRedirecting, setDesktopRedirecting] = useState(false)

  useEffect(() => {
    if (!supabase) return

    const handleCallback = async () => {
      try {
        // 获取OAuth回调的token
        const accessToken = searchParams.get('access_token')
        const refreshToken = searchParams.get('refresh_token')

        if (accessToken && refreshToken) {
          // 设置session
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            throw sessionError
          }

          // 获取用户信息
          const { data: { user } } = await supabase.auth.getUser()

          if (user) {
            // 创建或更新profile
            const session = await supabase.auth.getSession()
            if (session.data.session) {
              await fetch('/api/auth/profile', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-session': session.data.session.access_token
                },
                body: JSON.stringify({
                  email: user.email,
                  name: user.user_metadata?.full_name || user.email?.split('@')[0],
                  role: 'user'
                })
              })

              // v1.0.31: 检查是否为桌面端流程（参数由 /login 在 Google 登录前写入 sessionStorage）
              if (typeof window !== 'undefined') {
                const desktopFlowRaw = sessionStorage.getItem('podcastai_desktop_flow')
                if (desktopFlowRaw) {
                  try {
                    const desktopFlow = JSON.parse(desktopFlowRaw) as {
                      callbackUrl?: string
                      scheme?: string
                    }
                    const safeCallback = normalizeDesktopCallbackUrl(desktopFlow.callbackUrl || '')
                    if (safeCallback && desktopFlow.scheme) {
                      sessionStorage.removeItem('podcastai_desktop_flow')
                      const payload: DesktopAuthPayload = {
                        token: session.data.session.access_token,
                        refreshToken: session.data.session.refresh_token,
                        email: user.email,
                        userId: user.id,
                        name: user.user_metadata?.full_name || user.user_metadata?.name || null,
                      }
                      setDesktopRedirecting(true)
                      await syncDesktopAuthAndOpen(payload, desktopFlow.scheme, safeCallback)
                      return // 不跳转首页，等用户关闭浏览器
                    }
                  } catch {
                    // 解析失败，按正常流程跳转首页
                  }
                }
              }
            }

            // 跳转到首页
            router.push('/')
          } else {
            setError('Failed to get user information')
          }
        } else {
          // 尝试使用supabase内置的回调处理
          const { error: authError } = await supabase.auth.getSession()

          if (authError) {
            throw authError
          }

          router.push('/')
        }
      } catch (err) {
        console.error('OAuth callback error:', err)
        setError((err as Error).message || 'Authentication failed')
      }
    }

    handleCallback()
  }, [router, searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="text-primary underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // v1.0.31: 桌面端流程中，正在把 token 推送回桌面端
  if (desktopRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto">
            <Monitor className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Returning to Desktop App...
            </h2>
            <p className="text-sm text-muted-foreground">
              Authentication successful. You can close this browser tab.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}