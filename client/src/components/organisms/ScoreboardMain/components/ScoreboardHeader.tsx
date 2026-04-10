import { Wifi, WifiOff } from 'lucide-react';
import { ScoreboardActions } from './ScoreboardActions';

export interface ScoreboardHeaderProps {
  isConnected: boolean;
  setsA: number;
  setsB: number;
  hasHistory: boolean;
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
}

export function ScoreboardHeader({
  isConnected, setsA, setsB, hasHistory, onHistoryClick, onSettingsClick
}: ScoreboardHeaderProps) {
  return (
    <div className="
      hidden landscape:flex items-center justify-between
      px-4 py-3 bg-background/80 backdrop-blur-md border-b border-outline/10
      flex-shrink-0
    ">
      {/* Left empty container to preserve flex centering */}
      <div className="flex-1" />
      
      {/* Center: Current Sets */}
      <div className="flex items-center justify-center flex-shrink-0 bg-surface-low px-4 py-1 rounded-full border border-outline/10">
        <span className="font-label text-[10px] uppercase tracking-widest opacity-60 font-bold mr-3">
          Sets
        </span>
        <span className="font-heading font-bold text-lg text-primary">
          {setsA} - {setsB}
        </span>
      </div>
      
      {/* Right: Actions */}
      <div className="flex-1 flex justify-end gap-2">
        <ScoreboardActions 
           hasHistory={hasHistory} 
           onHistoryClick={onHistoryClick} 
           onSettingsClick={onSettingsClick} 
           isLandscape={true} 
        />
      </div>
    </div>
  );
}
