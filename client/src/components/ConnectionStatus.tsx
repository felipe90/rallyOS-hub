import { useSocketContext } from '../contexts/SocketContext'

export function ConnectionStatus() {
  const { connected, connecting, error } = useSocketContext()

  if (error) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 p-3 bg-red-500/10 border-b border-red-500/30 text-red-500 text-sm">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <span>⚠️ Error de conexión: {error}</span>
          <span className="text-xs text-red-400">Usando datos locales</span>
        </div>
      </div>
    )
  }

  if (connecting) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 p-3 bg-amber-500/10 border-b border-amber-500/30 text-amber-600 text-sm">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <span className="animate-spin">🔄</span>
          <span>Conectando...</span>
        </div>
      </div>
    )
  }

  if (connected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 p-3 bg-green-500/10 border-b border-green-500/30 text-green-600 text-sm">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <span>✅ Conectado</span>
          <span className="text-xs">Actualizaciones en tiempo real</span>
        </div>
      </div>
    )
  }

  return null
}
