import { ReactNode } from 'react'
import { Typography } from '../../atoms/Typography'

export interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: ReactNode
  helperText?: string
}

/**
 * Form field wrapper with label, error, and helper text
 * Ensures consistent form UX across the app
 */
export function FormField({
  label,
  error,
  required,
  children,
  helperText
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-1">
        <Typography variant="label" className="font-medium">
          {label}
        </Typography>
        {required && <span className="text-red-500 font-bold">*</span>}
      </label>
      <div>{children}</div>
      {error && (
        <Typography variant="caption" className="text-red-500">
          {error}
        </Typography>
      )}
      {helperText && !error && (
        <Typography variant="caption" className="text-text-muted">
          {helperText}
        </Typography>
      )}
    </div>
  )
}
