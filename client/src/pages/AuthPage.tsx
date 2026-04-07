import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/atoms/Button'
import { Input } from '../components/atoms/Input'
import { Typography } from '../components/atoms/Typography'

const VALID_PIN = '12345'

export function AuthPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Validate PIN
      if (pin !== VALID_PIN) {
        setError('PIN inválido')
        setIsLoading(false)
        return
      }

      // Login as referee
      login('referee')
      
      // Navigate to dashboard
      navigate('/dashboard')
    } catch (err) {
      setError('Error durante login')
      console.error(err)
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5)
    setPin(value)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface gap-8 p-4">
      <div className="flex flex-col items-center gap-4">
        <Typography variant="headline">RallyOS</Typography>
        <Typography variant="title">Ingresa tu PIN</Typography>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
        <Input
          type="password"
          inputMode="numeric"
          placeholder="••••••"
          value={pin}
          onChange={handleChange}
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
          variant="primary"
          disabled={pin.length !== 5 || isLoading}
          onClick={handleSubmit}
        >
          {isLoading ? 'Ingresando...' : 'Ingresar'}
        </Button>
      </form>

      <Typography variant="caption" className="text-text-muted text-center">
        Introduce el PIN de 5 dígitos para acceder como árbitro
      </Typography>
    </div>
  )
}
