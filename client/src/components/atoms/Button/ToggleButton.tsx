import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

export interface ToggleButtonProps {
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
};

const positionStyles = {
  'bottom-right': 'bottom-6 right-6',
  'bottom-left': 'bottom-6 left-6',
  'top-right': 'top-6 right-6',
  'top-left': 'top-6 left-6',
};

const baseStyles = `
  fixed rounded-full bg-surface/80 backdrop-blur-md shadow-lg 
  transition-all duration-300 
  hover:scale-110 active:scale-95 
  cursor-pointer
  flex items-center justify-center
  ring-2 ring-transparent
  hover:ring-primary/30
`.trim().replace(/\s+/g, ' ');

export function ToggleButton({
  icon,
  onClick,
  active = false,
  position = 'bottom-right',
  size = 'md',
  className = '',
}: ToggleButtonProps) {
  const activeStyles = active ? 'ring-2 ring-primary/30' : '';

  return (
    <motion.button
      className={`
        ${baseStyles}
        ${sizeStyles[size]}
        ${positionStyles[position]}
        ${activeStyles}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-label="Toggle orientation"
    >
      <span className="text-text-h">{icon}</span>
    </motion.button>
  );
}