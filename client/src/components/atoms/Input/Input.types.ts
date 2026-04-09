import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: string;
}