/**
 * 支持的语言列表（与桌面客户端 electron/src/renderer.js 中的 LOCALE_OPTIONS 保持一致）
 * locale 代码遵循 BCP 47 简写（zh / ja / ko / es / fr / de / pt / ru / en）
 */
export const SUPPORTED_LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export interface LocaleMeta {
  code: Locale
  /** 该语言的自称（语言切换器中显示） */
  nativeName: string
  /** 英文名（辅助识别） */
  englishName: string
  /** html lang 属性值 */
  htmlLang: string
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { code: 'en', nativeName: 'English', englishName: 'English', htmlLang: 'en' },
  zh: { code: 'zh', nativeName: '中文', englishName: 'Chinese', htmlLang: 'zh-CN' },
  ja: { code: 'ja', nativeName: '日本語', englishName: 'Japanese', htmlLang: 'ja' },
  ko: { code: 'ko', nativeName: '한국어', englishName: 'Korean', htmlLang: 'ko' },
  es: { code: 'es', nativeName: 'Español', englishName: 'Spanish', htmlLang: 'es' },
  fr: { code: 'fr', nativeName: 'Français', englishName: 'French', htmlLang: 'fr' },
  de: { code: 'de', nativeName: 'Deutsch', englishName: 'German', htmlLang: 'de' },
  pt: { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', htmlLang: 'pt' },
  ru: { code: 'ru', nativeName: 'Русский', englishName: 'Russian', htmlLang: 'ru' },
}

/** 非中英语言的翻译字典：key 为英文原文（translation-memory 模式） */
export type TranslationDict = Record<string, string>

/**
 * 从浏览器/系统语言推断支持的 locale
 * @returns 匹配的 locale，无法识别时返回 null
 */
export function detectBrowserLocale(): Locale | null {
  if (typeof navigator === 'undefined') return null
  const candidates = [navigator.language, ...(navigator.languages ?? [])]
  for (const raw of candidates) {
    if (!raw) continue
    const lower = raw.toLowerCase()
    // 精确匹配（zh-CN / zh-TW / pt-BR 等都归入基础语言）
    const base = lower.split('-')[0]
    if ((SUPPORTED_LOCALES as readonly string[]).includes(base)) {
      return base as Locale
    }
  }
  return null
}

/** 校验任意字符串是否为受支持的 locale */
export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}
