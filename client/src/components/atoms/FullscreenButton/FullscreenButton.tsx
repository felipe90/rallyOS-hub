import { useState, useEffect, useCallback } from 'react'

export function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dismissed, setDismissed] = useState(false)

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

  // Not supported or already fullscreen or user dismissed
  if (!document.fullscreenEnabled || isFullscreen || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
      <button
        onClick={dismiss}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-surface/80 text-text/50 text-xs"
        aria-label="Cerrar"
      >
        ✕
      </button>
      <button
        onClick={enter}
        className="bg-primary hover:bg-primary/80 text-white px-3 py-1.5 rounded-lg shadow-lg text-xs font-medium transition-colors"
      >
        ⛶ Pantalla completa
      </button>
    </div>
  )
}
