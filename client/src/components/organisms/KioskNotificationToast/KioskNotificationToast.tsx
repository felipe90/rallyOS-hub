import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Info, AlertTriangle, AlertCircle, Bell } from 'lucide-react'
import type { KioskNotificationData } from '@shared/types'

// ── Color mapping per type ───────────────────────────────────────────

const COLOR_MAP: Record<KioskNotificationData['type'], string> = {
  info: 'bg-green-500/90',
  warning: 'bg-yellow-500/90',
  error: 'bg-red-500/90',
  important: 'bg-blue-500/90',
}

const ICON_MAP: Record<KioskNotificationData['type'], React.ComponentType<{ className?: string }>> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  important: Bell,
}

// ── Sound config per type ────────────────────────────────────────────

interface SoundConfig {
  waveform: OscillatorType
  frequency: number
  durationMs: number
  secondFrequency?: number
}

const SOUND_MAP: Record<KioskNotificationData['type'], SoundConfig> = {
  info: { waveform: 'sine', frequency: 880, durationMs: 200 },
  warning: { waveform: 'sine', frequency: 660, durationMs: 300 },
  error: { waveform: 'square', frequency: 440, durationMs: 400 },
  important: { waveform: 'sine', frequency: 1047, durationMs: 500, secondFrequency: 1319 },
}

// ── Sound engine ─────────────────────────────────────────────────────

const INITIAL_GAIN = 0.3
const SECONDARY_GAIN = 0.2
const FADE_TARGET = 0.001
const CLEANUP_DELAY_MS = 100

function playSound(type: KioskNotificationData['type']): void {
  try {
    const config = SOUND_MAP[type]
    const ctx = new AudioContext()
    const durationSeconds = config.durationMs / 1000

    // Primary oscillator
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.type = config.waveform
    oscillator.frequency.setValueAtTime(config.frequency, ctx.currentTime)
    gainNode.gain.setValueAtTime(INITIAL_GAIN, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(FADE_TARGET, ctx.currentTime + durationSeconds)
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + durationSeconds)

    // Dual oscillator for "important" bell sound
    if (config.secondFrequency) {
      const oscillator2 = ctx.createOscillator()
      const gainNode2 = ctx.createGain()
      oscillator2.type = config.waveform
      oscillator2.frequency.setValueAtTime(config.secondFrequency, ctx.currentTime)
      gainNode2.gain.setValueAtTime(SECONDARY_GAIN, ctx.currentTime)
      gainNode2.gain.exponentialRampToValueAtTime(FADE_TARGET, ctx.currentTime + durationSeconds)
      oscillator2.connect(gainNode2)
      gainNode2.connect(ctx.destination)
      oscillator2.start(ctx.currentTime)
      oscillator2.stop(ctx.currentTime + durationSeconds)
    }

    // Clean up AudioContext after sound finishes
    setTimeout(() => {
      ctx.close?.()?.catch(() => {})
    }, config.durationMs + CLEANUP_DELAY_MS)
  } catch {
    // Silent fallback — kiosk already has autoplay policy configured,
    // but if AudioContext is unavailable for any reason, degrade gracefully.
  }
}

// ── Component props ──────────────────────────────────────────────────

export interface KioskNotificationToastProps {
  notification: KioskNotificationData
  onDismiss: () => void
}

// ── Component ────────────────────────────────────────────────────────

export function KioskNotificationToast({ notification, onDismiss }: KioskNotificationToastProps) {
  const Icon = ICON_MAP[notification.type]
  const colorClass = COLOR_MAP[notification.type]

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Play sound on mount
  useEffect(() => {
    playSound(notification.type)
  }, [notification.type])

  // Auto-dismiss after duration
  useEffect(() => {
    dismissTimerRef.current = setTimeout(() => {
      onDismiss()
    }, notification.duration * 1000)

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current)
      }
    }
  }, [notification.duration, onDismiss])

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`fixed bottom-0 left-0 right-0 z-50 ${colorClass} text-white m-4`}
      role="alert"
    >
      <div className="flex items-center gap-3 px-6 py-4 max-w-4xl mx-auto">
        <Icon className="w-6 h-6 flex-shrink-0" data-testid={`toast-icon-${notification.type}`} />
        <span className="text-lg font-semibold flex-1">{notification.message}</span>
      </div>
    </motion.div>
  )
}
