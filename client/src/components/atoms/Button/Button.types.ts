import type { ButtonHTMLAttributes, ReactNode, MouseEvent } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- MouseEvent may be needed for onClick handler typing

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'live' | 'score' | 'danger' | 'success' | 'outline';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;  // Made optional for icon-only buttons
  loading?: boolean;
  animate?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  stopPropagation?: boolean;  // Stop event propagation and prevent default
}