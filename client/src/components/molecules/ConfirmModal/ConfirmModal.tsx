import { Button } from '../../atoms/Button'
import { Body, Title } from '../../atoms/Typography'

export interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      
      {/* Modal content */}
      <div className="relative bg-surface rounded-lg shadow-xl p-6 w-full max-w-sm">
        <Title className="text-center mb-2">{title}</Title>
        
        <Body className="text-center text-text/70 mb-6">
          {message}
        </Body>

        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            onClick={onCancel}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button 
            variant={variant} 
            onClick={onConfirm}
            className="flex-1"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}