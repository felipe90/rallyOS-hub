import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/atoms/Button'
import { Input } from '../components/atoms/Input'
import { Typography } from '../components/atoms/Typography'

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

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5)
    setPin(value)
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
          >
            Espectador
          </Button>
          <Button
            className='bg-secondary text-secondary hover:bg-secondary'
            variant="secondary"
            size="lg"
            onClick={handleRefereeClick}
            disabled={isLoading}
          >
            Árbitro
          </Button>
        </div>
      ) : (
        // PIN Mode
        <form onSubmit={handlePinSubmit} className="flex flex-col gap-4 w-full max-w-sm">
          <Input
            type="password"
            inputMode="numeric"
            placeholder="••••••"
            value={pin}
            onChange={handlePinChange}
            maxLength={5}
            disabled={isLoading}
            autoFocus
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
          >
            {isLoading ? 'Ingresando...' : 'Ingresar'}
          </Button>

          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={isLoading}
          >
            Atrás
          </Button>
        </form>
      )}
    </div>
  )
}
