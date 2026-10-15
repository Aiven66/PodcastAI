'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  isSupportedLocale,
  translate,
  LOCALE_META,
  type Locale,
} from '@/lib/i18n'

interface LocaleContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (en: string, zh: string) => string
}

const DEFAULT_LOCALE: Locale = 'zh'

const LocaleContext = createContext<LocaleContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (_en: string, zh: string) => zh
})

export function useLocale() {
  return useContext(LocaleContext)
}

const LOCALE_STORAGE_KEY = 'locale'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // 优先级：用户手动选择 > 默认中文
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isSupportedLocale(saved)) {
      setLocale(saved)
    }
    setMounted(true)
  }, [])

  // 同步 <html lang>，便于浏览器翻译插件/无障碍工具识别当前语言
  useEffect(() => {
    if (mounted) {
      document.documentElement.lang = LOCALE_META[locale].htmlLang
    }
  }, [locale, mounted])

  const handleSetLocale = (newLocale: Locale) => {
    setLocale(newLocale)
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale)
  }

  const t = (en: string, zh: string) => {
    if (locale === 'zh') return zh
    if (locale === 'en') return en
    // 其他语言：以英文原文为 key 查字典，未命中回退英文
    return translate(locale, en)
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <LocaleContext.Provider value={{ locale: DEFAULT_LOCALE, setLocale: handleSetLocale, t }}>
        {children}
      </LocaleContext.Provider>
    )
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}
