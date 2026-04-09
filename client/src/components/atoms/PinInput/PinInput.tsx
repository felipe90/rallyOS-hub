import { useState } from 'react'

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

export function PinInput({
  length = 5,
  onComplete,
  onChange,
  disabled = false,
  error,
  autoFocus = false,
  placeholder = '•'.repeat(length),
  value: externalValue
}: PinInputProps) {
  const [internalPin, setInternalPin] = useState('')
  const pin = externalValue !== undefined ? externalValue : internalPin

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, length)
    if (externalValue === undefined) {
      setInternalPin(value)
    }
    onChange?.(value)
    if (value.length === length) {
      onComplete?.(value)
    }
  }

  return (
    <input
      type="password"
      inputMode="numeric"
      maxLength={length}
      placeholder={placeholder}
      value={pin}
      onChange={handleChange}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`w-full px-4 py-2 rounded-md border text-center tracking-[0.5em] font-heading text-xl transition-colors ${
        error
          ? 'border-red-500 bg-red-50 text-text'
          : 'border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary'
      } disabled:opacity-50`}
    />
  )
}
