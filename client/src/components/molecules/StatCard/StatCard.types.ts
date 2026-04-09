export interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  graph?: React.ReactNode;
  className?: string;
}

export interface MiniStatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}