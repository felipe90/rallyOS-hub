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

// Static classes so Tailwind JIT sees them at build time (no dynamic /90)
const COLOR_MAP_KIOSK: Record<KioskNotificationData['type'], string> = {
  info: 'bg-green-600/90',
  warning: 'bg-amber-500/90',
  error: 'bg-red-600/90',
  important: 'bg-primary/90',
}

const ICON_MAP: Record<KioskNotificationData['type'], React.ComponentType<{ size?: number }>> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  important: Bell,
}

// ── Sound config per type (V2 — ADSR + note sequences) ──────────────

interface SoundConfig {
  notes: Array<{ freq: number; startOffset: number; duration: number; waveform: OscillatorType }>
  adsr: { attack: number; decay: number; sustain: number; release: number }
  totalDuration: number
  gain: number
}

const SOUND_MAP_V2: Record<KioskNotificationData['type'], SoundConfig> = {
  info: {
    notes: [
      { freq: 523, startOffset: 0, duration: 0.18, waveform: 'sine' },
      { freq: 659, startOffset: 0.18, duration: 0.18, waveform: 'sine' },
      { freq: 784, startOffset: 0.36, duration: 0.18, waveform: 'sine' },
    ],
    adsr: { attack: 0.02, decay: 0.05, sustain: 0.7, release: 0.05 },
    totalDuration: 0.6,
    gain: 0.4,
  },
  warning: {
    notes: [
      { freq: 392, startOffset: 0, duration: 0.18, waveform: 'triangle' },     // G4
      { freq: 523, startOffset: 0.2, duration: 0.18, waveform: 'triangle' },   // C5
    ],
    adsr: { attack: 0.03, decay: 0.04, sustain: 0.6, release: 0.04 },
    totalDuration: 0.4,
    gain: 0.4,
  },
  error: {
    notes: [
      { freq: 523, startOffset: 0, duration: 0.4, waveform: 'sawtooth' },      // C5
      { freq: 370, startOffset: 0.1, duration: 0.3, waveform: 'sawtooth' },    // F#4 (tritone)
      { freq: 440, startOffset: 0.2, duration: 0.3, waveform: 'sawtooth' },    // A4 (sub-oscillator)
    ],
    adsr: { attack: 0.01, decay: 0.4, sustain: 0.3, release: 0.1 },
    totalDuration: 0.8,
    gain: 0.35,
  },
  important: {
    notes: [
      { freq: 262, startOffset: 0, duration: 0.25, waveform: 'triangle' },
      { freq: 392, startOffset: 0.2, duration: 0.25, waveform: 'triangle' },
      { freq: 523, startOffset: 0.4, duration: 0.3, waveform: 'triangle' },
    ],
    adsr: { attack: 0.02, decay: 0.08, sustain: 0.8, release: 0.1 },
    totalDuration: 0.9,
    gain: 0.45,
  },
}

// ── Sound engine (V2 — ADSR synthesis) ───────────────────────────────

let _audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!_audioCtx || _audioCtx.state === 'closed') _audioCtx = new AudioContext()
  return _audioCtx
}

/** Reset the singleton AudioContext (for test isolation) */
export function _resetAudioContext(): void {
  _audioCtx = null
}

// ── ADSR helper ──

function applyAdsr(
  gainNode: GainNode,
  ctx: AudioContext,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
  duration: number,
  gain: number,
) {
  const t = ctx.currentTime
  gainNode.gain.setValueAtTime(0, t)
  gainNode.gain.linearRampToValueAtTime(gain, t + attack)
  gainNode.gain.linearRampToValueAtTime(gain * sustain, t + attack + decay)
  gainNode.gain.setValueAtTime(gain * sustain, t + duration - release)
  gainNode.gain.linearRampToValueAtTime(0.001, t + duration)
}

async function playSoundV2(type: KioskNotificationData['type'], reduceMotion: boolean): Promise<void> {
  try {
    const config = SOUND_MAP_V2[type]
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()

    const gain = reduceMotion ? config.gain * 0.6 : config.gain
    const totalDuration = reduceMotion ? config.totalDuration * 0.5 : config.totalDuration
    const durationScale = reduceMotion ? 0.5 : 1

    for (const note of config.notes) {
      const osc = ctx.createOscillator()
      const gn = ctx.createGain()
      const waveform = reduceMotion && note.waveform === 'sawtooth' ? 'sine' : note.waveform
      osc.type = waveform
      const noteDuration = note.duration * durationScale
      const noteStart = note.startOffset * durationScale
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + noteStart)
      applyAdsr(gn, ctx, config.adsr.attack, config.adsr.decay, config.adsr.sustain, config.adsr.release, noteDuration, gain)
      osc.connect(gn)
      gn.connect(ctx.destination)
      osc.start(ctx.currentTime + noteStart)
      osc.stop(ctx.currentTime + noteStart + noteDuration + 0.05)
    }

    // AudioContext singleton stays alive for the kiosk session
  } catch (err) {
    console.warn('[KioskSound] Audio error:', err)
  }
}

// ── Component props ──────────────────────────────────────────────────

export interface KioskNotificationToastProps {
  notification: KioskNotificationData
  onDismiss: () => void
  kioskMode?: boolean
}

// ── Component ────────────────────────────────────────────────────────

export function KioskNotificationToast({ notification, onDismiss, kioskMode = false }: KioskNotificationToastProps) {
  const Icon = ICON_MAP[notification.type]
  const colorClass = COLOR_MAP[notification.type]
  const shouldReduceMotion = useReducedMotion()
  const isKiosk = kioskMode

  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Play sound on mount
  useEffect(() => {
    playSoundV2(notification.type, shouldReduceMotion ?? false)
  }, [notification.type, shouldReduceMotion])

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
      className={`fixed bottom-0 left-0 right-0 z-[100] text-white m-4 ${
        isKiosk
          ? `${COLOR_MAP_KIOSK[notification.type]} min-h-[15vh] rounded-xl shadow-2xl`
          : `${colorClass} rounded-lg shadow-lg`
      }`}
      role="alert"
    >
      <div className={`flex items-center justify-center ${
        isKiosk ? 'gap-8 px-8 py-6' : 'gap-6 px-8 py-6 max-w-6xl mx-auto'
      }`}>
        <span className="shrink-0" data-testid={`toast-icon-${notification.type}`}>
          <Icon size={isKiosk ? 80 : 40} />
        </span>
        <span className={isKiosk ? 'text-5xl md:text-6xl lg:text-7xl font-black leading-tight' : 'text-lg font-semibold'}>
          {notification.message}
        </span>
      </div>
    </ToastWrapper>
  )
}
