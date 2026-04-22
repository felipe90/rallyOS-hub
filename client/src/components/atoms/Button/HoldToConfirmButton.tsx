import { useRef, useState, useCallback, ReactNode } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Trash2, ArrowLeftRight } from 'lucide-react';

export interface HoldToConfirmButtonProps {
  onConfirm: () => void;
  holdDuration?: number;
  className?: string;
  ariaLabel?: string;
  variant?: 'danger' | 'neutral';
}

export function HoldToConfirmButton({
  onConfirm,
  holdDuration = 2000,
  className = '',
  ariaLabel = 'Hold to confirm',
  variant = 'danger',
}: HoldToConfirmButtonProps) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const controls = useAnimation();

  const clearHold = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(0);
    setIsHolding(false);
    controls.start({ scale: 1 });
  }, [controls]);

  const handlePointerDown = useCallback(() => {
    setIsHolding(true);
    startTimeRef.current = Date.now();

    controls.start({ scale: 0.95 });

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min(elapsed / holdDuration, 1);
      setProgress(newProgress);

      if (elapsed >= holdDuration) {
        // Hold completed
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setProgress(0);
        setIsHolding(false);
        controls.start({ scale: 1 });
        onConfirm();
      }
    }, 16); // ~60fps updates
  }, [holdDuration, onConfirm, controls]);

  const handlePointerUp = useCallback(() => {
    if (progress < 1) {
      clearHold();
    }
  }, [progress, clearHold]);

  const handlePointerLeave = useCallback(() => {
    clearHold();
  }, [clearHold]);

  // SVG circle properties for the fill ring
  const size = 40;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <motion.button
      className={`
        relative flex items-center justify-center
        w-12 h-12 rounded-full
        bg-white/5 hover:bg-white/10
        ${variant === 'danger' ? 'text-[var(--color-score-negative)] hover:text-[var(--color-score)]' : 'text-[var(--color-score-muted)] hover:text-white'}
        transition-colors duration-200
        select-none touch-none
        ${className}
      `}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      animate={controls}
      aria-label={ariaLabel}
      type="button"
    >
      {/* Progress ring */}
      <svg
        width={size}
        height={size}
        className="absolute inset-0 m-auto rotate-[-90deg] pointer-events-none"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          opacity={0.15}
        />
        {/* Progress fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-75 ease-linear"
          opacity={isHolding ? 1 : 0}
        />
      </svg>

      {/* Icon */}
      {variant === 'danger' ? (
        <Trash2 size={18} className="relative z-10" />
      ) : (
        <ArrowLeftRight size={18} className="relative z-10" />
      )}
    </motion.button>
  );
}
