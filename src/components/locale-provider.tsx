'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface LocaleContextType {
  locale: string
  setLocale: (locale: string) => void
  t: (en: string, zh: string) => string
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (en: string) => en
})

export function useLocale() {
  return useContext(LocaleContext)
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') || 'en'
    setLocale(savedLocale)
    setMounted(true)
  }, [])

  const handleSetLocale = (newLocale: string) => {
    setLocale(newLocale)
    localStorage.setItem('locale', newLocale)
  }

  const t = (en: string, zh: string) => locale === 'en' ? en : zh

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <LocaleContext.Provider value={{ locale: 'en', setLocale: handleSetLocale, t }}>
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