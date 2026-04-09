import type { LucideProps } from 'lucide-react';

export type IconName = 
  | 'trophy'
  | 'users'
  | 'plus'
  | 'minus'
  | 'undo'
  | 'settings'
  | 'menu'
  | 'x'
  | 'chevron-left'
  | 'chevron-right'
  | 'check'
  | 'clock'
  | 'play'
  | 'pause'
  | 'history'
  | 'layout-grid'
  | 'list'
  | 'qr-code'
  | 'share'
  | 'copy'
  | 'refresh-cw'
  | 'alert-circle'
  | 'info'
  | 'award';

export interface IconProps extends Omit<LucideProps, 'icon'> {
  name: IconName;
  variant?: 'outline' | 'filled';
  size?: number;
}