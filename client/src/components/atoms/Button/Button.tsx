import type { ReactNode as _ReactNode, MouseEvent } from 'react';
// Note: ButtonHTMLAttributes and MouseEvent not currently used but may be needed for future expanded props
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import type { ButtonVariant, ButtonSize, ButtonProps } from './Button.types';

export type { ButtonVariant, ButtonSize, ButtonProps } from './Button.types';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white shadow-md hover:shadow-lg',
  secondary: 'bg-surface-low text-text hover:bg-surface-high',
  ghost: 'bg-transparent text-text hover:bg-surface-low',
  live: 'bg-gradient-live text-white shadow-md hover:shadow-lg',
  score: 'bg-primary text-white shadow-lg hover:shadow-xl font-bold',
  danger: 'bg-red-500 text-white shadow-md hover:shadow-lg hover:bg-red-600',
  success: 'bg-green-500 text-white shadow-md hover:shadow-lg hover:bg-green-600',
  outline: 'bg-transparent border-2 border-primary text-primary hover:bg-primary/10',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs rounded-[--radius-sm]',
  sm: 'px-3 py-1.5 text-sm rounded-[--radius-sm]',
  md: 'px-4 py-2 text-base rounded-[--radius-md]',
  lg: 'px-6 py-3 text-lg rounded-[--radius-md]',
  xl: 'px-8 py-4 text-2xl rounded-[--radius-lg]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  loading,
  animate = true,
  fullWidth = false,
  icon,
  stopPropagation = false,
  onClick,
  ...props
}: ButtonProps) {
  const baseStyles = `
    inline-flex items-center justify-center gap-2 font-heading font-medium
    transition-all duration-200 ease-out
    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `;

  // Handler to stop propagation if needed
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      e.stopPropagation();
      e.preventDefault();
    }
    onClick?.(e);
  };

  if (animate) {
    return (
      <motion.button
        className={baseStyles}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        disabled={disabled || loading}
        onClick={handleClick}
        {...(props as HTMLMotionProps<'button'>)}
      >
        {icon && <span className="flex items-center justify-center">{icon}</span>}
        {loading ? (
          <span className="animate-spin inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
        ) : null}
        {children}
      </motion.button>
    );
  }

  return (
    <button className={baseStyles} disabled={disabled || loading} onClick={handleClick} {...props}>
      {icon && <span className="flex items-center justify-center">{icon}</span>}
      {loading ? (
        <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
      ) : null}
      {children}
    </button>
  );
}

/* Score button variant - specific to referee score controls (+/- buttons) */
export function ScoreButton({
  side,
  onAdd,
  onSubtract,
  disabled,
  className = '',
}: {
  side: 'A' | 'B';
  onAdd: () => void;
  onSubtract: () => void;
  disabled?: boolean;
  className?: string;
}) {
  // Player A: bg-surface-low text-primary
  // Player B: bg-primary text-surface
  const buttonColorClass = side === 'A'
    ? 'bg-surface-low text-primary'
    : 'bg-primary text-surface';

  return (
    <div className={`flex flex-col justify-between items-center w-full h-full${className}`}>
      {/* Plus button */}
      <motion.button
        className={`
          ${buttonColorClass}
          font-heading text-4xl
          aspect-square w-32 h-32 rounded-full
          mb-4 mt-4
          flex items-center justify-center
          shadow-md hover:shadow-lg
          active:scale-95 transition-transform
          disabled:opacity-50 disabled:pointer-events-none
        `}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
        onClick={onAdd}
        disabled={disabled}
      >
        +
      </motion.button>

      {/* Minus button */}
      <motion.button
        className={`
          ${buttonColorClass}
          font-heading text-4xl
          aspect-square w-32 h-32 rounded-full
          mb-4 mt-4
          flex items-center justify-center
          shadow-md hover:shadow-lg
          active:scale-95 transition-transform
          disabled:opacity-50 disabled:pointer-events-none
        `}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
        onClick={onSubtract}
        disabled={disabled}
      >
        −
      </motion.button>
    </div>
  );
}