import React from 'react';
import { HoldToConfirmButton } from '../../../atoms/Button/HoldToConfirmButton';

interface VSDividerProps {
  onSwapSides?: () => void;
}

/* VS Divider - Visual separator between players */
export function VSDivider({ onSwapSides }: VSDividerProps) {
  return (
    <div className="w-px bg-white/10 relative z-30 flex flex-col items-center justify-center">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white/5 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10">
        <span className="font-heading font-bold text-base text-white/40 italic">VS</span>
      </div>
      
      {/* Swap sides button for referee — right below VS */}
      {onSwapSides && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[44px]">
          <HoldToConfirmButton
            onConfirm={onSwapSides}
            holdDuration={1500}
            variant="neutral"
            ariaLabel="Intercambiar lados"
          />
        </div>
      )}
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
    <div 
      className="absolute top-6 z-20 flex items-center gap-3 px-6 py-3 rounded-full bg-amber/10 border-2 border-amber/20 backdrop-blur-sm"
      style={{ [side === 'A' ? 'left' : 'right']: '2rem' }}
    >
      <div className="w-[clamp(0.75rem,2vw,1.5rem)] h-[clamp(0.75rem,2vw,1.5rem)] bg-amber rounded-full animate-pulse" />
      <span className="text-amber text-[clamp(0.75rem,2vw,1.25rem)] font-bold uppercase tracking-wider">Saque</span>
    </div>
  );
}
