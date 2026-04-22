import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSocketContext } from '../../../contexts/SocketContext'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

export function ConnectionStatus() {
  const { connected, connecting, error } = useSocketContext()
  const [isVisible, setIsVisible] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const status = error ? 'error' : connecting ? 'connecting' : connected ? 'connected' : 'disconnected'

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (status === 'connected') {
      // Start auto-hide timer
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false)
      }, 3000)
    } else {
      // Instantly show for error/connecting/disconnected
      setIsVisible(true)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [status])

  const statusConfig = {
    connected: {
      icon: <Wifi size={14} className="text-[var(--color-score-positive)]" />,
      label: 'Conectado',
      textClass: 'text-[var(--color-score-positive)]',
      bg: 'bg-[var(--color-score-positive)]/10',
    },
    connecting: {
      icon: <Loader2 size={14} className="text-amber animate-spin" />,
      label: 'Conectando',
      textClass: 'text-amber',
      bg: 'bg-amber/10',
    },
    error: {
      icon: <WifiOff size={14} className="text-[var(--color-score-negative)]" />,
      label: 'Sin Conexión',
      textClass: 'text-[var(--color-score-negative)]',
      bg: 'bg-[var(--color-score-negative)]/10',
    },
    disconnected: {
      icon: <WifiOff size={14} className="text-slate-500" />,
      label: 'Desconectado',
      textClass: 'text-slate-500',
      bg: 'bg-white/5',
    },
  }

  const config = statusConfig[status]

  return (
    <AnimatePresence>
      <motion.div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        animate={{ y: isVisible ? 0 : -100, opacity: isVisible ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <div className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full
          backdrop-blur-sm
          ${config.bg}
          border border-white/10
        `}>
          {config.icon}
          <span className={`text-xs font-medium ${config.textClass}`}>
            {config.label}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
