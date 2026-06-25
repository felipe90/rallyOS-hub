import { useSportAdapter } from '../../../hooks/useSportAdapter/useSportAdapter';
import { SPORT } from '@shared/types';
import type { MatchStateExtended, SportDisplayScore } from '@shared/types';

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
 * Swap left/right display values so the visual matches `match.swappedSides`.
 *
 * Adapters return RAW data (Player A on left, Player B on right). Display
 * components (TTPointDisplay, PadelPointDisplay) read directly from
 * `sportDisplay.left*` / `sportDisplay.right*` and are NOT swap-aware.
 * When `swappedSides` is true, we invert the display values here so the
 * correct numbers/names land on the correct visual side.
 *
 * Note: KioskPointDisplay has its own swap logic (getDisplayValues) and does
 * NOT go through this path, so this is the single point that fixes the
 * referee scoreboard view.
 */
function applySwapToDisplay(
  sportDisplay: SportDisplayScore,
  swapped: boolean,
): SportDisplayScore {
  if (!swapped) return sportDisplay;

  if (sportDisplay.type === SPORT.TABLE_TENNIS) {
    return {
      type: SPORT.TABLE_TENNIS,
      leftScore: sportDisplay.rightScore,
      rightScore: sportDisplay.leftScore,
      leftSets: sportDisplay.rightSets,
      rightSets: sportDisplay.leftSets,
    };
  }

  // PadelPointDisplay
  return {
    type: SPORT.PADEL,
    leftPoint: sportDisplay.rightPoint,
    rightPoint: sportDisplay.leftPoint,
    leftGames: sportDisplay.rightGames,
    rightGames: sportDisplay.leftGames,
    leftSets: sportDisplay.rightSets,
    rightSets: sportDisplay.leftSets,
  };
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
  const rawDisplay = adapter.computeDisplayData(match);
  const sportDisplay = applySwapToDisplay(rawDisplay, match.swappedSides === true);
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
