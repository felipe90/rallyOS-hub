import { useEffect, useState, useCallback } from 'react'
import { useServiceWorkerUpdate } from './useServiceWorkerUpdate'

interface AutoUpdateBannerProps {
  onUpdateAvailable?: () => void
}

export function useAutoUpdateBanner({ onUpdateAvailable }: AutoUpdateBannerProps = {}) {
  const { updateAvailable, updateApp, isUpdating } = useServiceWorkerUpdate()
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const dismiss = useCallback(() => {
    setDismissed(true)
    setShowBanner(false)
  }, [])

  useEffect(() => {
    // Show banner when update is available and user hasn't dismissed
    if (updateAvailable && !dismissed && !isUpdating) {
      setShowBanner(true)
      onUpdateAvailable?.()
    }
  }, [updateAvailable, dismissed, isUpdating, onUpdateAvailable])

  const handleUpdate = useCallback(() => {
    updateApp()
  }, [updateApp])

  // Banner component for lazy rendering
  const Banner = isUpdating ? (
    <div className="fixed bottom-4 left-4 right-4 bg-primary text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-center z-50">
      <span className="text-sm font-medium">Actualizando...</span>
    </div>
  ) : showBanner ? (
    <div className="fixed bottom-4 left-4 right-4 bg-surface px-4 py-3 rounded-lg shadow-lg flex items-center justify-between z-50">
      <span className="text-sm text-text">Nueva versión disponible</span>
      <div className="flex gap-2">
        <button
          onClick={dismiss}
          className="text-sm px-3 py-1 text-text-secondary hover:text-text"
        >
          Después
        </button>
        <button
          onClick={handleUpdate}
          className="text-sm px-3 py-1 bg-primary text-white rounded-md"
        >
          Actualizar
        </button>
      </div>
    </div>
  ) : null

  return {
    showBanner,
    isUpdating,
    Banner,
    checkForUpdate: () => navigator.serviceWorker.getRegistration(),
  }
}