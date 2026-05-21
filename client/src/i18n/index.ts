/**
 * i18n initialization module
 *
 * Initializes i18next with browser language detection and static JSON imports.
 * Exports:
 *   - useI18n()  — React hook for components (pages, organisms)
 *   - i18nText   — singleton for services (formatters, validators)
 *   - default    — the i18next instance (for tests)
 */

import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import es from './locales/es.json'
import en from './locales/en-US.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: ['es', 'en-US'],
    resources: {
      es: { translation: es },
      'en-US': { translation: en },
    },
    fallbackLng: 'es',
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'rallyos-lang',
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
    returnNull: false,
    returnEmptyString: false,
  })

/** Singleton — usable outside React (services, formatters) */
export const i18nText = i18n.t.bind(i18n)
export type I18nTextFn = typeof i18nText

/** Change language at runtime — persists to localStorage via detector cache */
export function changeLanguage(lng: string): void {
  void i18n.changeLanguage(lng)
  try {
    localStorage.setItem('rallyos-lang-explicit', 'true')
  } catch {
    // localStorage unavailable — silently degrade
  }
}

/** Supported languages */
export const SUPPORTED_LANGS = [
  { code: 'es', label: 'ES' },
  { code: 'en-US', label: 'EN' },
] as const

/** Hook — usable inside React components (pages, organisms) */
export function useI18n() {
  const { t, i18n: i18nInstance } = useTranslation()
  return {
    i18nText: t,
    language: i18nInstance.language,
    changeLanguage: (lng: string) => void i18nInstance.changeLanguage(lng),
  }
}

export default i18n
