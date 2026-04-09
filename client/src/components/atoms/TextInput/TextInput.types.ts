import { InputHTMLAttributes } from 'react'

interface BaseInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  error?: boolean
  inputSize?: 'sm' | 'md' | 'lg'
}

export interface TextInputProps extends BaseInputProps {}