import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

/* Button Atom - Kinetic Clubhouse button variants */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'live';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  loading?: boolean;
  animate?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-primary text-white shadow-md hover:shadow-lg',
  secondary: 'bg-surface-low text-text hover:bg-surface-high',
  ghost: 'bg-transparent text-text hover:bg-surface-low',
  live: 'bg-gradient-live text-white shadow-md hover:shadow-lg',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-[--radius-sm]',
  md: 'px-4 py-2 text-base rounded-[--radius-md]',
  lg: 'px-6 py-3 text-lg rounded-[--radius-md]',
};

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '',
  disabled,
  loading,
  animate = true,
  ...props 
}: ButtonProps) {
  const baseStyles = `
    inline-flex items-center justify-center gap-2 font-heading font-medium
    transition-all duration-200 ease-out
    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${className}
  `;

  if (animate) {
    return (
      <motion.button
        className={baseStyles}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        disabled={disabled || loading}
        {...(props as HTMLMotionProps<'button'>)}
      >
        {loading ? (
          <span className="animate-spininline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
        ) : null}
        {children}
      </motion.button>
    );
  }

  return (
    <button className={baseStyles} disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
      ) : null}
      {children}
    </button>
  );
}

/* Score button variant - specific to referee score controls */
export function ScoreButton({ 
  side, 
  onClick, 
  disabled,
  className = '',
}: { 
  side: 'A' | 'B'; 
  onClick: () => void; 
  disabled?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      className={`
        ${side === 'A' ? 'bg-surface-low' : 'bg-primary'} 
        text-text-h font-heading text-[80px] leading-none
        w-full aspect-[4/5] rounded-[--radius-lg]
        flex items-center justify-center
        shadow-md hover:shadow-lg
        active:scale-95 transition-transform
        disabled:opacity-50 disabled:pointer-events-none
        ${className}
      `}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
    >
      {side}
    </motion.button>
  );
}