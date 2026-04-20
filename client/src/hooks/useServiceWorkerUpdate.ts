import { useEffect, useState, useCallback } from 'react'

interface UseServiceWorkerUpdate {
  updateAvailable: boolean
  updateApp: () => void
  isUpdating: boolean
}

export function useServiceWorkerUpdate(): UseServiceWorkerUpdate {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const updateApp = useCallback(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      setIsUpdating(true)
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
      
      // Reload after a short delay to let SW update
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handleNewContent = () => {
      setUpdateAvailable(true)
    }

    // Listen for updatefound events
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) {
        registration.addEventListener('updatefound', handleNewContent)
        
        // Check if there's already waiting worker
        if (registration.waiting) {
          setUpdateAvailable(true)
        }
      }
    })

    // Also listen for controllerchange events (SW was updated)
    const handleControllerChange = () => {
      // New SW took control, reload to get fresh content
      if (!updateAvailable) {
        setUpdateAvailable(false)
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [updateAvailable])

  return {
    updateAvailable,
    updateApp,
    isUpdating,
  }
}