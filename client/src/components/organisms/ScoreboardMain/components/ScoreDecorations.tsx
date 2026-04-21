import React from 'react';

/* VS Divider - Visual separator between players */
export function VSDivider() {
  return (
    <div className="w-px bg-outline/20 relative z-30">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-surface rounded-full flex items-center justify-center shadow-lg border border-outline/10">
        <span className="font-heading font-bold text-xs text-outline italic">VS</span>
      </div>
    </div>
  );
}

/* Subtle background decorations */
export function BackgroundDecor() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <div className="absolute top-0 left-0 w-[30vw] h-[30vw] rounded-full bg-primary/5 blur-[100px]" />
      <div className="absolute bottom-0 right-0 w-[30vw] h-[30vw] rounded-full bg-tertiary/5 blur-[100px]" />
    </div>
  );
}

export function ServingIndicator({ side }: { side: 'A' | 'B' }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-4 h-4 bg-amber rounded-full animate-pulse" />
      <span className="text-tertiary text-lg font-medium">Servicio</span>
    </div>
  );
}
