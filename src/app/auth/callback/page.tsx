'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useSupabase } from '@/components/supabase-provider'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { supabase } = useSupabase()
  const [error, setError] = useState<string | null>(null)

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