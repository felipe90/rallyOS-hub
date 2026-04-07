import { 
  Trophy, 
  Users, 
  Plus, 
  Minus, 
  Undo2, 
  Settings, 
  Menu, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Clock, 
  Play, 
  Pause, 
  History, 
  LayoutGrid, 
  List,
  QrCode,
  Share2,
  Copy,
  RefreshCcw,
  AlertCircle,
  Info,
  Award,
  type LucideIcon,
  type LucideProps 
} from 'lucide-react';

/* Icon Atom - Wrapper for Lucide icons */
type IconName = 
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

interface IconProps extends Omit<LucideProps, 'icon'> {
  name: IconName;
  variant?: 'outline' | 'filled';
  size?: number;
}

const iconMap: Record<IconName, LucideIcon> = {
  trophy: Trophy,
  users: Users,
  plus: Plus,
  minus: Minus,
  undo: Undo2,
  settings: Settings,
  menu: Menu,
  x: X,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  check: Check,
  clock: Clock,
  play: Play,
  pause: Pause,
  history: History,
  'layout-grid': LayoutGrid,
  list: List,
  'qr-code': QrCode,
  share: Share2,
  copy: Copy,
  'refresh-cw': RefreshCcw,
  'alert-circle': AlertCircle,
  info: Info,
  award: Award,
};

export function Icon({ name, size = 24, className = '', variant = 'outline', ...props }: IconProps) {
  const IconComponent = iconMap[name];
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }
  
  return (
    <IconComponent 
      size={size} 
      className={className} 
      strokeWidth={variant === 'filled' ? 2 : 1.5}
      {...props} 
    />
  );
}

/* Convenience exports for common icon combinations */
export function LayoutGridIcon(props: LucideProps) {
  return <LayoutGrid strokeWidth={1.5} {...props} />;
}

export function ListIcon(props: LucideProps) {
  return <List strokeWidth={1.5} {...props} />;
}

export function HistoryIcon(props: LucideProps) {
  return <History strokeWidth={1.5} {...props} />;
}

export function UndoIcon(props: LucideProps) {
  return <Undo2 strokeWidth={1.5} {...props} />;
}

export function SettingsIcon(props: LucideProps) {
  return <Settings strokeWidth={1.5} {...props} />;
}