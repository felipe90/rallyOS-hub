import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/atoms/Button'
import { PinInput } from '@/components/atoms/PinInput'
import { Typography } from '@/components/atoms/Typography'

const REFEREE_PIN = '12345'

export function AuthPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'select' | 'pin'>('select')
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleRefereeClick = () => {
    setMode('pin')
    setPin('')
    setError('')
  }

  const handleSpectatorClick = async () => {
    setIsLoading(true)
    try {
      // Login as spectator (no PIN needed)
      login('viewer')
      navigate('/dashboard')
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
    setError('')
    setIsLoading(true)

    try {
      // Validate PIN
      if (pin !== REFEREE_PIN) {
        setError('PIN inválido')
        setIsLoading(false)
        return
      }

      // Login as referee
      login('referee')
      navigate('/dashboard')
    } catch (err) {
      setError('Error durante login')
      console.error(err)
      setIsLoading(false)
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
          {mode === 'select' ? 'Elige tu rol' : 'Ingresa tu PIN'}
        </Typography>
      </div>

      {mode === 'select' ? (
        // Selection Mode
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <Button
            className='bg-primary text-primary hover:bg-primary'
            variant="primary"
            size="lg"
            onClick={handleSpectatorClick}
            disabled={isLoading}
            animate={false}
          >
            Espectador
          </Button>
          <Button
            className='bg-secondary text-secondary hover:bg-secondary'
            variant="secondary"
            size="lg"
            onClick={handleRefereeClick}
            disabled={isLoading}
            animate={false}
          >
            Árbitro
          </Button>
        </div>
      ) : (
        // PIN Mode
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <PinInput
            length={5}
            value={pin}
            onChange={handlePinChange}
            onComplete={handlePinSubmit}
            disabled={isLoading}
            error={error}
            autoFocus
            placeholder="•••••"
          />

          {error && (
            <Typography variant="label" className="text-red-500">
              ⚠️ {error}
            </Typography>
          )}

          <Button
            className='bg-primary text-primary hover:bg-primary'
            variant="primary"
            disabled={pin.length !== 5 || isLoading}
            onClick={handlePinSubmit}
            animate={false}
          >
            {isLoading ? 'Ingresando...' : 'Ingresar'}
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
