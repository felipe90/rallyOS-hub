import { SUPPORTED_LANGS } from '@/i18n'

export interface LanguageSwitcherProps {
  language: string
  onChangeLanguage: (lng: string) => void
}

/**
 * Language switcher — floating pill at the bottom-right corner.
 *
 * Atom: receives current language + change function via props.
 */
export function LanguageSwitcher({ language, onChangeLanguage }: LanguageSwitcherProps) {
  const current = language?.split('-')[0] || 'es'

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-0.5 bg-surface border border-outline/20 rounded-full shadow-lg overflow-hidden">
      {SUPPORTED_LANGS.map((lang) => {
        const isActive = current === lang.code.split('-')[0]
        return (
          <button
            key={lang.code}
            onClick={() => onChangeLanguage(lang.code)}
            className={`
              px-3 py-1.5 text-xs font-heading font-medium transition-colors duration-150
              ${isActive
                ? 'bg-primary text-white'
                : 'text-text/60 hover:text-text hover:bg-surface-high'
              }
            `}
            aria-label={lang.code}
          >
            {lang.label}
          </button>
        )
      })}
    </div>
  )
}
