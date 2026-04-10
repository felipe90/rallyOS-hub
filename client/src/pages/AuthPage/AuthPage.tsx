import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useSocketContext } from '@/contexts/SocketContext'
import { Button } from '@/components/atoms/Button'
import { PinInput } from '@/components/atoms/PinInput'
import { Typography } from '@/components/atoms/Typography'

export type AuthMode = 'select' | 'owner-pin'

export function AuthPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<AuthMode>('select')
  const navigate = useNavigate()
  const { login, setOwner } = useAuth()
  const { socket, connected } = useSocketContext()

  // Listen for OWNER_VERIFIED event
  useEffect(() => {
    if (!socket) return

    const handleOwnerVerified = (data: { token: string }) => {
      console.log('[AuthPage] Owner verified:', data)
      setIsLoading(false)
      setOwner(true)
      login('owner')
      navigate('/dashboard')
    }

    const handleError = (error: { code: string; message: string }) => {
      if (error.code === 'INVALID_OWNER_PIN') {
        setError('PIN de organizador incorrecto')
        setIsLoading(false)
      }
    }

    socket.on('OWNER_VERIFIED', handleOwnerVerified)
    socket.on('ERROR', handleError)

    return () => {
      socket.off('OWNER_VERIFIED', handleOwnerVerified)
      socket.off('ERROR', handleError)
    }
  }, [socket, login, navigate, setOwner])

  const handleOwnerClick = () => {
    setMode('owner-pin')
    setPin('')
    setError('')
  }

  const handleRefereeClick = () => {
    // RF-02: Árbitr@ goes to Dashboard but can't create tables
    login('referee')
    navigate('/dashboard')
  }

  const handleSpectatorClick = async () => {
    setIsLoading(true)
    try {
      // RF-04: Espectador goes directly to Waiting Room
      login('viewer')
      navigate('/waiting-room')
    } catch (err) {
      setError('Error durante login')
      console.error(err)
      setIsLoading(false)
    }
  }

  const handlePinChange = (value: string) => {
    setPin(value)
  }

  const handlePinSubmit = () => {
    if (pin.length < 4) {
      setError('PIN debe tener 4 dígitos')
      return
    }

    setError('')
    setIsLoading(true)

    // Emit VERIFY_OWNER event
    if (socket && connected) {
      socket.emit('VERIFY_OWNER', { pin })
    } else {
      // Fallback for when socket not available - accept default PIN
      if (pin === '0000') {
        setOwner(true)
        login('owner')
        navigate('/dashboard')
      } else {
        setError('Error de conexión')
        setIsLoading(false)
      }
    }
  }

  const handleBack = () => {
    setMode('select')
    setPin('')
    setError('')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface gap-8 p-4">
      <div className="flex flex-col items-center gap-4">
        <Typography variant="headline">RallyOS</Typography>
        <Typography variant="title">
          {mode === 'select' ? 'Elige tu rol' : 'Ingresa tu PIN de Organizador'}
        </Typography>
      </div>

      {mode === 'select' ? (
        // Selection Mode - 3 buttons
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <Button
            className='bg-primary text-primary-foreground hover:bg-primary/90'
            variant="primary"
            size="lg"
            onClick={handleOwnerClick}
            disabled={isLoading}
            animate={false}
          >
            Organizador
          </Button>
          <Button
            className='bg-secondary text-secondary-foreground hover:bg-secondary/90'
            variant="secondary"
            size="lg"
            onClick={handleRefereeClick}
            disabled={isLoading}
            animate={false}
          >
            Árbitro
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={handleSpectatorClick}
            disabled={isLoading}
            animate={false}
          >
            Espectador
          </Button>
        </div>
      ) : (
        // Owner PIN Mode
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <Typography variant="body" className="text-center text-muted-foreground">
            Ingresa el PIN de organizador del torneo
          </Typography>
          <PinInput
            length={4}
            value={pin}
            onChange={handlePinChange}
            onComplete={handlePinSubmit}
            disabled={isLoading}
            error={error}
            autoFocus
            placeholder="••••"
          />

          {error && (
            <Typography variant="label" className="text-red-500 text-center">
              ⚠️ {error}
            </Typography>
          )}

          <Button
            className='bg-primary text-primary-foreground hover:bg-primary/90'
            variant="primary"
            disabled={pin.length !== 4 || isLoading}
            onClick={handlePinSubmit}
            animate={false}
          >
            {isLoading ? 'Verificando...' : 'Ingresar'}
          </Button>

          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={isLoading}
            animate={false}
          >
            Atrás
          </Button>
        </div>
      )}
    </div>
  )
}