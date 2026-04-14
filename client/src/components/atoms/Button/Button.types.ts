import type { ButtonHTMLAttributes, ReactNode as _ReactNode, MouseEvent as _MouseEvent } from 'react';
 

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'live' | 'score' | 'danger' | 'success' | 'outline';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: _ReactNode;  // Made optional for icon-only buttons
  loading?: boolean;
  animate?: boolean;
  fullWidth?: boolean;
  icon?: _ReactNode;
  stopPropagation?: boolean;  // Stop event propagation and prevent default
}