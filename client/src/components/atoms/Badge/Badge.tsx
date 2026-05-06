import type { ReactNode } from 'react';

/* Badge Atom - State chips with background shift */
export type BadgeStatus = 'waiting' | 'configuring' | 'live' | 'finished' | 'default';

interface BadgeProps {
  status?: BadgeStatus;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

const statusStyles: Record<BadgeStatus, string> = {
  waiting: 'bg-surface-low text-text',
  configuring: 'bg-tertiary/10 text-tertiary-dark',
  live: 'bg-amber/20 text-amber-light',
  finished: 'bg-primary/10 text-primary-dark',
  default: 'bg-surface text-text',
};

const statusDotColors: Record<BadgeStatus, string> = {
  waiting: 'bg-border',
  configuring: 'bg-tertiary',
  live: 'bg-amber animate-pulse',
  finished: 'bg-primary',
  default: 'bg-text',
};

export function Badge({ status = 'default', children, className = '', dot = false }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-2 px-3 py-1 rounded-full
        font-body text-sm font-medium
        transition-colors duration-200
        ${statusStyles[status]}
        ${className}
      `}
    >
      {dot && (
        <span className={`w-2 h-2 rounded-full ${statusDotColors[status]}`} />
      )}
      {children}
    </span>
  );
}

/* Convenience components for common badge types */
export function WaitingBadge({ label, className = '' }: { label: string; className?: string }) {
  return <Badge status="waiting" className={className} dot>{label}</Badge>;
}

export function ConfiguringBadge({ label, className = '' }: { label: string; className?: string }) {
  return <Badge status="configuring" className={className} dot>{label}</Badge>;
}

export function LiveBadge({ label, className = '' }: { label: string; className?: string }) {
  return <Badge status="live" className={className} dot>{label}</Badge>;
}

export function FinishedBadge({ label, className = '' }: { label: string; className?: string }) {
  return <Badge status="finished" className={className} dot>{label}</Badge>;
}