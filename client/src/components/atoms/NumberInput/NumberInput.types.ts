import { InputHTMLAttributes } from 'react'

interface BaseInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'size'> {
  error?: boolean
  inputSize?: 'sm' | 'md' | 'lg'
  onIncrement?: () => void
  onDecrement?: () => void
  onChange?: (value: number) => void
  showButtons?: boolean
}

export interface NumberInputProps extends BaseInputProps {}