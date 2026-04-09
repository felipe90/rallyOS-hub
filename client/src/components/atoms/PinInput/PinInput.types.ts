export interface PinInputProps {
  length?: number
  onComplete?: (pin: string) => void
  onChange?: (pin: string) => void
  disabled?: boolean
  error?: string
  autoFocus?: boolean
  placeholder?: string
  value?: string
}