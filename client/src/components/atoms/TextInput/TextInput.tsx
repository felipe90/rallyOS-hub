import { InputHTMLAttributes } from 'react'

interface BaseInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  error?: boolean
  inputSize?: 'sm' | 'md' | 'lg'
}

export interface TextInputProps extends BaseInputProps {}

/**
 * Reusable text input with optional error state
 * Consistent styling across form inputs
 */
export function TextInput({
  error = false,
  inputSize = 'md',
  className = '',
  ...props
}: TextInputProps) {
  const sizeStyles = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-base',
    lg: 'px-4 py-3 text-lg'
  }

  const baseStyles = `
    w-full rounded-md border transition-colors
    focus:outline-none focus:ring-2 focus:ring-primary/50
    disabled:opacity-50 disabled:cursor-not-allowed
    ${
      error
        ? 'border-red-500 bg-red-50/50 text-text'
        : 'border-border bg-surface text-text placeholder:text-text-muted'
    }
    ${sizeStyles[inputSize]}
    ${className}
  `

  return <input type="text" className={baseStyles} {...props} />
}
