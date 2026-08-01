'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { initSupabaseClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

interface SupabaseContextType {
  supabase: SupabaseClient | null
  user: User | null
  loading: boolean
  error: Error | null
}

const SupabaseContext = createContext<SupabaseContextType>({
  supabase: null,
  user: null,
  loading: true,
  error: null
})

export function useSupabase() {
  return useContext(SupabaseContext)
}

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    let mounted = true
    let subscription: { unsubscribe: () => void } | null = null
    
    async function init() {
      try {
        const client = await initSupabaseClient()
        if (!mounted) return

        setSupabase(client)

        // 获取当前用户（网络失败时不影响页面渲染，仅 console.warn）
        // v1.0.33: 修复 "Failed to fetch" — Supabase 不可达时 getUser() 抛异常，
        // 不应导致整个 init 失败；admin 登录不依赖此调用
        try {
          const { data: { user: initialUser } } = await client.auth.getUser()
          if (mounted) {
            setUser(initialUser)
          }
        } catch (getUserErr) {
          // 网络错误（Supabase 不可达），静默处理
          console.warn('Supabase getUser() failed (network unreachable), continuing in demo mode:', getUserErr instanceof Error ? getUserErr.message : String(getUserErr))
        }

        // 监听认证状态变化
        const { data: { subscription: authSubscription } } = client.auth.onAuthStateChange((_event, session) => {
          if (mounted) {
            setUser(session?.user ?? null)
          }
        })
        subscription = authSubscription

      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to initialize Supabase'))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    
    init()
    
    return () => {
      mounted = false
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])
  
  return (
    <SupabaseContext.Provider value={{ supabase, user, loading, error }}>
      {children}
    </SupabaseContext.Provider>
  )
}