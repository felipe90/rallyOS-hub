import { useSportAdapter } from '../../../hooks/useSportAdapter/useSportAdapter';
import type { MatchStateExtended } from '@shared/types';

export interface SportDisplaySelectorProps {
  match: MatchStateExtended;
  leftPlayerName: string;
  rightPlayerName: string;
  totalSets: number;
  leftServing: boolean;
  rightServing: boolean;
  leftSets: number;
  rightSets: number;
  isReferee?: boolean;
  onScorePoint?: (side: 'A' | 'B') => void;
  onSubtractPoint?: (side: 'A' | 'B') => void;
  onSwapSides?: () => void;
}

/**
 * SportDisplaySelector — Renders the sport-appropriate display component.
 *
 * Delegates to SportDisplayAdapter: resolves the adapter from match.sport,
 * computes display data, and renders the adapter's DisplayComponent.
 * Adding a new sport requires zero changes here.
 */
export function SportDisplaySelector({
  match,
  leftPlayerName,
  rightPlayerName,
  totalSets,
  leftServing,
  rightServing,
  leftSets,
  rightSets,
  isReferee = false,
  onScorePoint,
  onSubtractPoint,
  onSwapSides,
}: SportDisplaySelectorProps) {
  const adapter = useSportAdapter(match);
  const sportDisplay = adapter.computeDisplayData(match);
  const DisplayComp = adapter.DisplayComponent;

  return (
    <DisplayComp
      sportDisplay={sportDisplay}
      leftPlayerName={leftPlayerName}
      rightPlayerName={rightPlayerName}
      totalSets={totalSets}
      leftServing={leftServing}
      rightServing={rightServing}
      leftSets={leftSets}
      rightSets={rightSets}
      isReferee={isReferee}
      onScorePoint={onScorePoint}
      onSubtractPoint={onSubtractPoint}
      onSwapSides={onSwapSides}
    />
  );
}
