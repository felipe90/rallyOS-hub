export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: string }).standalone === 'yes'
  )
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export function canFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  return document.fullscreenEnabled
}
