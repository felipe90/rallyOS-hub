import { useState, useEffect } from 'react'

/**
 * Computes QR size as 5% of viewport width, clamped between 80px and 160px.
 * @returns {number} Clamped QR size in pixels.
 */
export function useResponsiveQrSize(): number {
  const [qrSize, setQrSize] = useState(() =>
    Math.min(Math.max(Math.floor(window.innerWidth * 0.05), 80), 160),
  )

  useEffect(() => {
    const update = () =>
      setQrSize(Math.min(Math.max(Math.floor(window.innerWidth * 0.05), 80), 160))
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return qrSize
}
