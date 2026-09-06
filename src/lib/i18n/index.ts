import type { Locale, TranslationDict } from './locales'
import { ja } from './dict/ja'
import { ko } from './dict/ko'
import { es } from './dict/es'
import { fr } from './dict/fr'
import { de } from './dict/de'
import { pt } from './dict/pt'
import { ru } from './dict/ru'

export type { Locale, TranslationDict } from './locales'
export {
  SUPPORTED_LOCALES,
  LOCALE_META,
  detectBrowserLocale,
  isSupportedLocale,
} from './locales'

/**
 * 非 en/zh 语言的翻译字典集合。
 * en 直接使用代码中的英文原文，zh 使用 t(en, zh) 的第二个参数，
 * 其余语言以英文原文为 key 在此查表，未命中时回退英文。
 */
export const DICTIONARIES: Partial<Record<Locale, TranslationDict>> = {
  ja,
  ko,
  es,
  fr,
  de,
  pt,
  ru,
}

/** 翻译一条英文原文到目标语言（en/zh 之外的），未命中回退英文 */
export function translate(locale: Locale, english: string): string {
  if (locale === 'en') return english
  const dict = DICTIONARIES[locale]
  return dict?.[english] ?? english
}
