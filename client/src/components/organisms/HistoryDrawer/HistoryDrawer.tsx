import { useI18n } from '@/i18n';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { ScoreChange } from '@shared/types';
import { Body, Caption } from '../../atoms/Typography';
import { X, Undo2 } from 'lucide-react';
import { formatRelativeTime } from '@/services/date';

export interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: ScoreChange[];
  onUndo: (eventId: string) => void;
  className?: string;
}

export function HistoryDrawer({ 
  isOpen, 
  onClose, 
  events,
  onUndo,
  className = '',
}: HistoryDrawerProps) {
  const { i18nText } = useI18n();
  const shouldReduceMotion = useReducedMotion();

  const Backdrop = shouldReduceMotion ? 'div' : motion.div;
  const DrawerPanel = shouldReduceMotion ? 'div' : motion.div;

  const drawerMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
        transition: { type: 'spring' as const, damping: 25, stiffness: 200 },
      };

  const backdropMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <Backdrop
            className="fixed inset-0 bg-black/20 z-40"
            {...backdropMotionProps}
            onClick={onClose}
          />

          <DrawerPanel
            className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-surface z-50 flex flex-col shadow-xl ${className}`}
            {...drawerMotionProps}
          >
            <div className="flex items-center justify-between p-4 bg-surface-low">
              <Body className="font-medium text-text-h">{i18nText('historyDrawerTitle')}</Body>
              <button
                className="p-2 rounded-[--radius-md] hover:bg-surface transition-colors"
                onClick={onClose}
                aria-label={i18nText('commonClose')}
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {events.length === 0 ? (
                <div className="flex items-center justify-center h-full p-8">
                  <Body className="text-text-muted">{i18nText('historyNoEventsYet')}</Body>
                </div>
              ) : (
                <div className="flex flex-col">
                  {events.map((event, index) => {
                    const isEven = index % 2 === 0;

                    const EventWrapper = shouldReduceMotion ? 'div' : motion.div;
                    const eventMotionProps = shouldReduceMotion
                      ? {}
                      : {
                          initial: { opacity: 0, x: 20 },
                          animate: { opacity: 1, x: 0 },
                          transition: { delay: index * 0.05 },
                        };

                    return (
                      <EventWrapper
                        key={event.id}
                        className={`relative p-4 ${isEven ? 'bg-surface' : 'bg-surface-low'} transition-colors group`}
                        {...eventMotionProps}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col gap-1">
                            <span className="font-heading text-lg font-medium text-text-h">
                              {event.pointsAfter.a} - {event.pointsAfter.b}
                            </span>
                            <Caption className="text-text-muted">
                              {event.player === 'A' ? i18nText('commonPlayerA') : i18nText('commonPlayerB')}
                              {' · '}
                              {event.action === 'POINT' ? i18nText('historyEventTypePoint') : 
                                event.action === 'SET_WON' ? i18nText('historyEventTypeSetWon') : i18nText('historyEventTypeCorrection')}
                            </Caption>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Caption className="text-text-muted">
                              {formatRelativeTime(event.timestamp)}
                            </Caption>
                            
                            {index === 0 && (
                              <motion.button
                                className="p-2 rounded-full hover:bg-amber/20 text-amber opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => onUndo(event.id)}
                                whileHover={shouldReduceMotion ? undefined : { scale: 1.1 }}
                                whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                                aria-label={i18nText('historyUndo')}
                              >
                                <Undo2 size={18} />
                              </motion.button>
                            )}
                          </div>
                        </div>
                      </EventWrapper>
                    );
                  })}
                </div>
              )}
            </div>
          </DrawerPanel>
        </>
      )}
    </AnimatePresence>
  );
}
