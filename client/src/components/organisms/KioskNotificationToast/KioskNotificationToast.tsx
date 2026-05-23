import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Info, AlertTriangle, AlertCircle, Bell } from 'lucide-react'
import type { KioskNotificationData } from '@shared/types'

// ── Color mapping per type ───────────────────────────────────────────

const COLOR_MAP: Record<KioskNotificationData['type'], string> = {
  info: 'bg-green-600',
  warning: 'bg-amber-500',
  error: 'bg-red-600',
  important: 'bg-primary',
}

const ICON_MAP: Record<KioskNotificationData['type'], React.ComponentType<{ size?: number }>> = {
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
  const shouldReduceMotion = useReducedMotion()

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

  const ToastWrapper = shouldReduceMotion ? 'div' : motion.div
  const toastMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { y: 100, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: 100, opacity: 0 },
        transition: { type: 'spring' as const, stiffness: 500, damping: 30 },
      }

  return (
    <ToastWrapper
      {...toastMotionProps}
      className={`fixed bottom-0 left-0 right-0 z-50 ${colorClass} text-white m-4 rounded-lg shadow-lg`}
      role="alert"
    >
      <div className="flex items-center justify-center gap-6 px-8 py-6 max-w-6xl mx-auto">
        <span className="shrink-0" data-testid={`toast-icon-${notification.type}`}><Icon size={40} /></span>
        <span className="text-lg font-semibold">{notification.message}</span>
      </div>
    </ToastWrapper>
  )
}
