import { useSocketContext } from '../contexts/SocketContext'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

export function ConnectionStatus() {
  const { connected, connecting, error } = useSocketContext()

  // Determine status
  const status = error ? 'error' : connecting ? 'connecting' : connected ? 'connected' : 'disconnected'

  const statusConfig = {
    connected: {
      bg: 'bg-primary/10',
      border: 'border-primary/20',
      dot: 'bg-primary/20',
      icon: <Wifi size={14} className="text-primary" />,
      subtitle: 'Conectado',
      textClass: 'text-primary',
    },
    connecting: {
      bg: 'bg-amber/10',
      border: 'border-amber/20',
      dot: 'bg-amber/20',
      icon: <Loader2 size={14} className="text-amber animate-spin" />,
      subtitle: 'Conectando',
      textClass: 'text-amber',
    },
    error: {
      bg: 'bg-error/10',
      border: 'border-error/20',
      dot: 'bg-error/20',
      icon: <WifiOff size={14} className="text-error" />,
      subtitle: 'Sin Conexión',
      textClass: 'text-error',
    },
    disconnected: {
      bg: 'bg-surface-low',
      border: 'border-outline/10',
      dot: 'bg-outline/20',
      icon: <WifiOff size={14} className="text-text-muted" />,
      subtitle: 'Desconectado',
      textClass: 'text-text-muted',
    },
  }

  const config = statusConfig[status]

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className={`flex items-center gap-3 px-4 py-2 ${config.bg} border-b ${config.border}`}>
        <div className={`p-1.5 rounded-full ${config.dot}`}>
          {config.icon}
        </div>
        
        <div className="flex flex-col">
          <span className="font-heading font-bold text-sm leading-tight">
            RallyOS
          </span>
          <span className={`font-label text-[9px] uppercase tracking-widest ${config.textClass} font-bold leading-none`}>
            {config.subtitle}
          </span>
        </div>
      </div>
    </div>
  )
}