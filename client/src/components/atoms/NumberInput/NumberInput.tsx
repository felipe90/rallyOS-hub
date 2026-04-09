import { InputHTMLAttributes } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface BaseInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'size'> {
  error?: boolean
  inputSize?: 'sm' | 'md' | 'lg'
  onIncrement?: () => void
  onDecrement?: () => void
  onChange?: (value: number) => void
  showButtons?: boolean
}

export interface NumberInputProps extends BaseInputProps {}

/**
 * Number input with optional +/- buttons
 * Validates input to ensure only numbers
 */
export function NumberInput({
  error = false,
  inputSize = 'md',
  onIncrement,
  onDecrement,
  onChange,
  showButtons = true,
  className = '',
  ...props
}: NumberInputProps) {
  const sizeStyles = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-base',
    lg: 'px-4 py-3 text-lg'
  }

  const baseStyles = `
    w-full rounded-md border transition-colors
    focus:outline-none focus:ring-2 focus:ring-primary/50
    disabled:opacity-50 disabled:cursor-not-allowed
    text-center font-medium
    ${
      error
        ? 'border-red-500 bg-red-50/50 text-text'
        : 'border-border bg-surface text-text'
    }
    ${sizeStyles[inputSize]}
    ${className}
  `

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value || '0', 10)
    if (!isNaN(value)) {
      onChange?.(value)
    }
  }

  if (!showButtons) {
    return (
      <input
        type="number"
        className={baseStyles}
        onChange={handleChange}
        {...props}
      />
    )
  }

  return (
    <div className="flex items-center gap-1">
      {onDecrement && (
        <button
          type="button"
          onClick={onDecrement}
          className="p-1 rounded hover:bg-surface-high transition-colors disabled:opacity-50"
          disabled={props.disabled}
          aria-label="Decrease"
        >
          <ChevronDown size={20} />
        </button>
      )}
      <input
        type="number"
        className={baseStyles}
        onChange={handleChange}
        {...props}
      />
      {onIncrement && (
        <button
          type="button"
          onClick={onIncrement}
          className="p-1 rounded hover:bg-surface-high transition-colors disabled:opacity-50"
          disabled={props.disabled}
          aria-label="Increase"
        >
          <ChevronUp size={20} />
        </button>
      )}
    </div>
  )
}
