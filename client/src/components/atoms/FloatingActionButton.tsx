import type { ReactNode } from 'react';
import { Button } from './Button';

export interface FloatingActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  'aria-label'?: string;
}

export function FloatingActionButton({
  icon,
  label,
  onClick,
  disabled,
  loading,
  'aria-label': ariaLabel,
}: FloatingActionButtonProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        variant="primary"
        className="rounded-full shadow-lg px-5 h-12"
        onClick={onClick}
        disabled={disabled}
        loading={loading}
        icon={icon}
        aria-label={ariaLabel || label}
      >
        {label}
      </Button>
    </div>
  );
}
