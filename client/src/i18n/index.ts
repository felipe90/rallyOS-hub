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
      order: ['navigator', 'htmlTag'],
      caches: [], // no localStorage cache for initial release
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

/** Hook — usable inside React components (pages, organisms) */
export function useI18n() {
  const { t } = useTranslation()
  return { i18nText: t }
}

export default i18n
