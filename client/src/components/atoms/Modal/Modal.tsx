/**
 * Modal atom — accessible, cancelable dialog.
 *
 * Conventions (matches Button atom pattern):
 *  - framer-motion `AnimatePresence` + `useReducedMotion` for anim/exit.
 *  - Closes via backdrop click, Escape key, and the X button.
 *  - Desktop: centered card `card-light max-w-md`.
 *  - Mobile (`fullscreen: true`): fills the viewport below 768px; on
 *    `md:`+ it collapses back to `max-w-md` centered so the owner is never
 *    presented with a fullscreen modal on a tablet/desktop.
 */

import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** Fill viewport under 768px; collapse to max-w-md on desktop. */
  fullscreen?: boolean
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  fullscreen = false,
}: ModalProps) {
  const shouldReduceMotion = useReducedMotion()

  // Escape-to-close (registered on window so focus inside the modal still works).
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  const widthClass = fullscreen
    ? 'w-full h-full max-h-dvh m-0 rounded-none p-4 md:w-auto md:max-w-md md:max-h-[90vh] md:rounded-lg md:p-6'
    : 'w-full max-w-md'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0 }}
          onClick={onClose}
        >
          {/* Backdrop — visual only; close is handled by the overlay onClick. */}
          <div className="absolute inset-0 bg-black/50" />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`card-light relative rounded-lg shadow-xl ${widthClass}`}
            initial={shouldReduceMotion ? false : { scale: 0.97, opacity: 0 }}
            animate={shouldReduceMotion ? undefined : { scale: 1, opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { scale: 0.97, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="font-heading text-lg font-medium text-text-h">
                {title}
              </div>
              <button
                aria-label="close"
                onClick={onClose}
                className="text-text-muted hover:text-text transition-colors p-1 -m-1"
              >
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}