import type { TableStatus } from '../../../../shared/types';
import { WaitingBadge, ConfiguringBadge, LiveBadge, FinishedBadge } from '../atoms/Badge';
import { Body } from '../atoms/Typography';

/* TableStatusChip Molecule - Table info card component */
export interface TableStatusChipProps {
  tableNumber: number;
  tableName: string;
  status: TableStatus;
  playerNames?: { a: string; b: string };
  playerCount?: number;
  className?: string;
}

const statusBadge: Record<TableStatus, typeof WaitingBadge> = {
  WAITING: WaitingBadge,
  CONFIGURING: ConfiguringBadge,
  LIVE: LiveBadge,
  FINISHED: FinishedBadge,
};

export function TableStatusChip({
  tableNumber,
  tableName,
  status,
  playerNames,
  playerCount = 0,
  className = '',
}: TableStatusChipProps) {
  const StatusBadgeComponent = statusBadge[status];
  
  return (
    <div
      className={`
        flex flex-col gap-2 p-4 rounded-[--radius-md]
        bg-surface shadow-sm hover:shadow-md
        transition-shadow duration-200
        cursor-pointer
        ${className}
      `}
    >
      <div className="flex items-center justify-between">
        <Body className="font-medium text-text-h">Mesa {tableNumber}</Body>
        <StatusBadgeComponent />
      </div>
      
      <Body className="text-sm text-text/70">{tableName}</Body>
      
      {playerNames && (playerNames.a || playerNames.b) && (
        <div className="flex gap-2 text-sm text-text/50">
          <span>{playerNames.a || '-'}</span>
          <span>vs</span>
          <span>{playerNames.b || '-'}</span>
        </div>
      )}
    </div>
  );
}