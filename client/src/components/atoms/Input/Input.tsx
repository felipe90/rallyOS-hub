import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';

/* Input Atom - Ghost border style (No-Line Rule compliant) */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="font-body text-sm font-medium text-text">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-3 rounded-[--radius-md]
            font-body text-base
            bg-surface-low text-text-h
            placeholder:text-text/50
            transition-all duration-200
            hover:bg-surface-high
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-surface
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'ring-2 ring-red-500/50' : ''}
            ${className}
          `}
          {...props}
        />
        {(error || hint) && (
          <span className={`text-sm ${error ? 'text-red-500' : 'text-text/70'}`}>
            {error || hint}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/* PIN Input - Specialized for referee PIN entry (4 digits) */
interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: string;
}

export function PinInput({ value = '', onChange, length = 4, error }: PinInputProps) {
  const digits = value.padEnd(length, '').slice(0, length).split('');
  
  const handleKeyDown = (index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key >= '0' && e.key <= '9') {
      const newValue = value.slice(0, index) + e.key + value.slice(index + 1);
      onChange(newValue);
      // Move to next input
      if (index < length - 1) {
        const nextInput = document.getElementById(`pin-${index + 1}`);
        nextInput?.focus();
      }
    } else if (e.key === 'Backspace') {
      if (value[index]) {
        const newValue = value.slice(0, index) + value.slice(index + 1);
        onChange(newValue);
      } else if (index > 0) {
        // Move to previous input and clear
        const prevInput = document.getElementById(`pin-${index - 1}`);
        prevInput?.focus();
      }
    }
  };

  return (
    <div className="flex gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          id={`pin-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onKeyDown={handleKeyDown(i)}
          className={`
            w-12 h-16 text-center text-2xl font-heading font-bold
            rounded-[--radius-md]
            bg-surface-low text-text-h
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-primary/30
            ${error ? 'ring-2 ring-red-500/50' : ''}
          `}
        />
      ))}
    </div>
  );
}