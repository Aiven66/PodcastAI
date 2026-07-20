'use client'

import { useState, useEffect, useCallback } from 'react'

// ── 积分常量 ──
export const DAILY_FREE_CREDITS = 100       // 每日赠送积分
export const ADMIN_DAILY_CREDITS = 10000    // 管理员每日赠送积分
export const PODCAST_COST = 100             // 每次播客生成消耗积分
export const CREDITS_STORAGE_KEY = 'podcastai_credits'
export const CREDITS_DATE_KEY = 'podcastai_credits_date'
const ADMIN_EMAIL = 'admin@126.com'

export interface CreditsInfo {
  balance: number
  todayDate: string  // YYYY-MM-DD
}

// 检查当前登录用户是否是管理员（从 localStorage 读取 demo user）
function isAdminUser(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = localStorage.getItem('podcastai_demo_user')
    if (!stored) return false
    const user = JSON.parse(stored)
    return user?.email?.toLowerCase() === ADMIN_EMAIL
  } catch {
    return false
  }
}

// 根据用户角色获取每日积分额度
function getDailyQuota(): number {
  return isAdminUser() ? ADMIN_DAILY_CREDITS : DAILY_FREE_CREDITS
}

// 获取今天日期字符串（本地时区）
function getTodayStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 积分管理 Hook
 *
 * 规则：
 * - 每日 0 点自动重置为 100 积分（惰性重置：首次访问时检查日期）
 * - 每次成功生成播客消耗 100 积分
 * - 积分不足时返回 canGenerate=false，前端显示付费弹窗
 *
 * 存储策略：
 * - Demo 模式：localStorage（key: podcastai_credits / podcastai_credits_date）
 * - Supabase 模式：优先调用 /api/credits，失败则降级到 localStorage
 */
export function useCredits(sessionToken?: string | null) {
  const [balance, setBalance] = useState(DAILY_FREE_CREDITS)
  const [loading, setLoading] = useState(true)

  // 惰性每日重置：检查存储的日期是否是今天，不是则重置
  const checkDailyReset = useCallback(() => {
    if (typeof window === 'undefined') return DAILY_FREE_CREDITS

    const today = getTodayStr()
    const dailyQuota = getDailyQuota()
    const storedDate = localStorage.getItem(CREDITS_DATE_KEY)
    let storedBalance = parseInt(localStorage.getItem(CREDITS_STORAGE_KEY) || `${dailyQuota}`, 10)

    if (storedBalance < 0) storedBalance = 0

    // 日期变更：重置积分
    if (storedDate !== today) {
      console.log(`[Credits] Daily reset: ${storedDate} -> ${today}, balance reset to ${dailyQuota}`)
      localStorage.setItem(CREDITS_STORAGE_KEY, String(dailyQuota))
      localStorage.setItem(CREDITS_DATE_KEY, today)
      storedBalance = dailyQuota
    }

    // 管理员保护：确保余额不低于配额（避免之前以普通用户身份访问后被压低）
    if (isAdminUser() && storedBalance < dailyQuota) {
      localStorage.setItem(CREDITS_STORAGE_KEY, String(dailyQuota))
      localStorage.setItem(CREDITS_DATE_KEY, today)
      storedBalance = dailyQuota
    }

    return storedBalance
  }, [])

  // 初始化：加载积分
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Demo 模式：从 localStorage 加载，惰性重置
    const localBalance = checkDailyReset()
    setBalance(localBalance)
    setLoading(false)

    // 尝试从后端获取真实积分（Supabase 模式）
    if (sessionToken) {
      fetch('/api/credits', {
        headers: { 'x-session': sessionToken },
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && typeof data.balance === 'number') {
            // 后端积分优先，同时同步到 localStorage
            setBalance(data.balance)
            localStorage.setItem(CREDITS_STORAGE_KEY, String(data.balance))
            localStorage.setItem(CREDITS_DATE_KEY, getTodayStr())
          }
        })
        .catch(() => {
          // 后端不可用，保持 localStorage 的值
        })
        .finally(() => setLoading(false))
    }
  }, [sessionToken, checkDailyReset])

  // 消耗积分（生成播客成功后调用）
  const deductCredits = useCallback((amount: number = PODCAST_COST): boolean => {
    if (typeof window === 'undefined') return false

    // 管理员不扣减积分，保证可以体验所有功能
    if (isAdminUser()) {
      return true
    }

    const currentBalance = checkDailyReset()
    if (currentBalance < amount) {
      return false
    }

    const newBalance = currentBalance - amount
    localStorage.setItem(CREDITS_STORAGE_KEY, String(newBalance))
    localStorage.setItem(CREDITS_DATE_KEY, getTodayStr())
    setBalance(newBalance)

    // 同步到后端（Supabase 模式，失败不影响前端）
    if (sessionToken) {
      fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session': sessionToken },
        body: JSON.stringify({ action: 'deduct', amount }),
      }).catch(() => {})
    }

    return true
  }, [sessionToken, checkDailyReset])

  // 检查是否可以生成播客（管理员始终允许）
  const canGenerate = isAdminUser() || balance >= PODCAST_COST

  // 手动刷新积分
  const refresh = useCallback(() => {
    const localBalance = checkDailyReset()
    setBalance(localBalance)
  }, [checkDailyReset])

  return {
    balance,
    loading,
    canGenerate,
    cost: PODCAST_COST,
    deductCredits,
    refresh,
  }
}
