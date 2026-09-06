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
        // Supabase OAuth 回跳参数位于 URL hash（如 /auth/callback#code=xxx），而非 query string
        // useSearchParams 读不到 hash，必须手动解析；query 参数作为兜底（兼容 implicit 流程）
        const hash = window.location.hash.replace(/^#/, '')
        const hashParams = new URLSearchParams(hash)

        const accessToken = hashParams.get('access_token') || searchParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token')
        const code = hashParams.get('code') || searchParams.get('code')
        const errorParam =
          hashParams.get('error_description') ||
          searchParams.get('error_description') ||
          hashParams.get('error') ||
          searchParams.get('error')

        if (errorParam) {
          throw new Error(decodeURIComponent(errorParam))
        }

        if (accessToken && refreshToken) {
          // implicit 流程：直接设置 session
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (sessionError) throw sessionError
        } else if (code) {
          // PKCE 流程：显式交换 code -> session
          // 若 supabase-js 初始化时已自动完成交换（hash 已被清除、code 已消费），以现有会话兜底
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            const existing = await supabase.auth.getSession()
            if (!existing.data.session) throw exchangeError
          }
        } else {
          // 无显式参数：supabase-js 正在后台用回跳数据异步恢复会话（detectSessionInUrl），
          // 恢复尚未完成时 getSession() 会返回 null，必须轮询等待而不是立即判定失败
          const deadline = Date.now() + 8000
          let recovered = false
          while (Date.now() < deadline) {
            const { data } = await supabase.auth.getSession()
            if (data.session) {
              recovered = true
              break
            }
            await new Promise((resolve) => setTimeout(resolve, 300))
          }
          if (!recovered) {
            throw new Error('No authentication session found / 未检测到登录会话')
          }
        }

        // 会话建立后获取用户信息；若仍无法获取则如实报错，避免静默跳转导致"没登录"
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError

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
      } catch (err) {
        console.error('OAuth callback error:', err)
        setError((err as Error).message || 'Authentication failed')
      }
    }

    handleCallback()
  }, [router, searchParams, supabase])

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