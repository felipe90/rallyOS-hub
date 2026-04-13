import { useState, useEffect } from 'react'
import { PinInput } from '../../atoms/PinInput'
import { Button } from '../../atoms/Button'
import { Body, Title } from '../../atoms/Typography'

export interface PinModalProps {
  isOpen: boolean
  tableName: string
  onClose: () => void
  onSubmit: (pin: string) => void
  isLoading?: boolean
  error?: string | null
}

export function PinModal({
  isOpen,
  tableName,
  onClose,
  onSubmit,
  isLoading = false,
  error,
}: PinModalProps) {
  const [pin, setPin] = useState('')

  // Reset PIN when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('')
    }
  }, [isOpen])

  const handleSubmit = () => {
    if (pin.length === 4) {
      onSubmit(pin)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 4) {
      handleSubmit()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Modal content */}
      <div className="relative bg-surface rounded-lg shadow-xl p-6 w-full max-w-sm">
        <Title className="text-center mb-2">Ingresa el PIN</Title>
        
        <Body className="text-center text-text/70 mb-6">
          para entrar a {tableName}
        </Body>

        <div className="mb-6">
          <PinInput
            length={4}
            value={pin}
            onChange={setPin}
            error={error || undefined}
            autoFocus
          />
          
          {error && (
            <Body className="text-center text-red-500 mt-2 text-sm">
              {error}
            </Body>
          )}
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1"
            disabled={isLoading}
          >
            Cancelar
          </Button>
          
          <Button 
            variant="primary" 
            onClick={handleSubmit}
            className="flex-1"
            disabled={pin.length !== 4 || isLoading}
          >
            {isLoading ? 'Verificando...' : 'Entrar'}
          </Button>
        </div>
      </div>
    </div>
  )
}