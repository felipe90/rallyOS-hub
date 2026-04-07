import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Body, Title, Caption } from '../atoms/Typography';

/* StatCard Molecule - Dashboard metric card with optional kinetic graph */
interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  graph?: ReactNode;
  className?: string;
}

export function StatCard({ 
  title, 
  value, 
  change, 
  trend = 'neutral',
  graph,
  className = '',
}: StatCardProps) {
  const trendColors = {
    up: 'text-primary',
    down: 'text-red-500',
    neutral: 'text-text',
  };

  const trendArrows = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };

  return (
    <motion.div
      className={`
        flex flex-col gap-3 p-5 rounded-[--radius-lg]
        bg-surface shadow-sm
        transition-all duration-200
        hover:shadow-md
        ${className}
      `}
      whileHover={{ y: -2 }}
    >
      <Caption className="text-text/50 uppercase tracking-widest">{title}</Caption>
      
      <div className="flex items-end justify-between">
        <Title className="text-text-h">{value}</Title>
        
        {change !== undefined && (
          <span className={`text-sm font-medium ${trendColors[trend]}`}>
            {trendArrows[trend]} {Math.abs(change)}%
          </span>
        )}
      </div>
      
      {graph && (
        <div className="mt-2 h-16">
          {graph}
        </div>
      )}
    </motion.div>
  );
}

/* MiniStatCard - Smaller variant for inline use */
interface MiniStatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
}

export function MiniStatCard({ label, value, icon }: MiniStatCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-[--radius-md] bg-surface-low">
      {icon && <span className="text-text/50">{icon}</span>}
      <div className="flex flex-col">
        <Caption className="text-text/50">{label}</Caption>
        <Body className="font-medium text-text-h">{value}</Body>
      </div>
    </div>
  );
}