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
        
        // 获取当前用户
        const { data: { user: initialUser } } = await client.auth.getUser()
        if (mounted) {
          setUser(initialUser)
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