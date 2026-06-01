import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '@/i18n'
import { isIOS, isStandalone, canFullscreen } from '@/utils/detectPlatform'
import { Share2 } from 'lucide-react'

export function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const { i18nText } = useI18n()

  const isIOSStandalone = isIOS() && isStandalone()
  const isIOSBrowser = isIOS() && !isStandalone()

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const enter = useCallback(() => {
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }, [])

  const dismiss = useCallback(() => {
    setDismissed(true)
  }, [])

  // Nothing to show
  if (dismissed) return null

  // iOS already in standalone mode → already fullscreen
  if (isIOSStandalone) return null

  // iOS in Safari browser → show "Add to Home Screen" prompt
  if (isIOSBrowser) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-end gap-2 max-w-[260px]">
        <div className="flex flex-col gap-1.5 bg-surface/95 backdrop-blur-sm shadow-xl border border-border/40 rounded-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Share2 size={16} className="text-primary" />
              </div>
              <span className="font-heading font-bold text-sm text-text">
                {i18nText('iosFullscreenTitle')}
              </span>
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 size-5 flex items-center justify-center rounded-full bg-surface-low text-text-muted text-xs"
              aria-label={i18nText('commonClose')}
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-text/70 leading-relaxed mt-1">
            {i18nText('iosFullscreenInstructions')}
          </p>
        </div>
      </div>
    )
  }

  // Non-iOS (Android/Desktop) — standard fullscreen button
  if (!canFullscreen() || isFullscreen) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
      <button
        onClick={dismiss}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-surface/80 text-text-muted text-xs"
        aria-label={i18nText('commonClose')}
      >
        ✕
      </button>
      <button
        onClick={enter}
        className="bg-primary hover:bg-primary/80 text-white px-3 py-1.5 rounded-lg shadow-lg text-xs font-medium transition-colors"
      >
        ⛶ {i18nText('fullscreenButton')}
      </button>
    </div>
  )
}
