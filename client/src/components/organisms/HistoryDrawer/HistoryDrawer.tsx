import { motion, AnimatePresence } from 'framer-motion';
import type { ScoreChange } from '../../../shared/types';
import { Body, Caption } from '../../atoms/Typography';
import { X, Undo2 } from 'lucide-react';

export interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: ScoreChange[];
  onUndo: (eventId: string) => void;
  className?: string;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'recién';
  if (diff < 3600000) return `hace ${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)}h`;
  return new Date(timestamp).toLocaleDateString('es-AR', { 
    day: 'numeric', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function HistoryDrawer({ 
  isOpen, 
  onClose, 
  events,
  onUndo,
  className = '',
}: HistoryDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/20 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          <motion.div
            className={`
              fixed right-0 top-0 bottom-0 w-full max-w-md
              bg-surface z-50
              flex flex-col
              shadow-xl
              ${className}
            `}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="flex items-center justify-between p-4 bg-surface-low">
              <Body className="font-medium text-text-h">Historial</Body>
              <button
                className="p-2 rounded-[--radius-md] hover:bg-surface transition-colors"
                onClick={onClose}
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {events.length === 0 ? (
                <div className="flex items-center justify-center h-full p-8">
                  <Body className="text-text/50">Sin eventos aún</Body>
                </div>
              ) : (
                <div className="flex flex-col">
                  {events.map((event, index) => {
                    const isEven = index % 2 === 0;
                    
                    return (
                      <motion.div
                        key={event.id}
                        className={`
                          relative p-4
                          ${isEven ? 'bg-surface' : 'bg-surface-low'}
                          transition-colors
                          group
                        `}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col gap-1">
                            <span className="font-heading text-lg font-medium text-text-h">
                              {event.pointsAfter.a} - {event.pointsAfter.b}
                            </span>
                            <Caption className="text-text/50">
                              {event.player === 'A' ? 'Player A' : 'Player B'}
                              {' · '}
                              {event.action === 'POINT' ? 'Punto' : 
                                event.action === 'SET_WON' ? 'Set ganado' : 'Corrección'}
                            </Caption>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Caption className="text-text/30">
                              {formatRelativeTime(event.timestamp)}
                            </Caption>
                            
                            {index === 0 && (
                              <motion.button
                                className="p-2 rounded-full hover:bg-amber/20 text-amber opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => onUndo(event.id)}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <Undo2 size={18} />
                              </motion.button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}