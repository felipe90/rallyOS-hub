import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SPORT } from '@shared/types';
import type { MatchStateExtended, SportDisplayScore } from '@shared/types';
import { useI18n } from '@/i18n';
import { useSportAdapter } from '../../../hooks/useSportAdapter/useSportAdapter';

export interface KioskPointDisplayProps {
  match: MatchStateExtended;
  leftName: string;
  rightName: string;
  leftSets: number;
  rightSets: number;
  totalSets: number;
  leftServing: boolean;
  rightServing: boolean;
}

function isPadelDisplay(sportDisplay: SportDisplayScore): sportDisplay is {
  type: typeof SPORT.PADEL;
  leftPoint: string;
  rightPoint: string;
  leftGames: number;
  rightGames: number;
  leftSets: number;
  rightSets: number;
} {
  return sportDisplay.type === SPORT.PADEL;
}

interface DisplayValues {
  leftMain: string | number;
  rightMain: string | number;
  leftGames?: number;
  rightGames?: number;
}

function getDisplayValues(
  sportDisplay: SportDisplayScore,
  isSwapped: boolean,
): DisplayValues {
  if (isPadelDisplay(sportDisplay)) {
    return {
      leftMain: isSwapped ? sportDisplay.rightPoint : sportDisplay.leftPoint,
      rightMain: isSwapped ? sportDisplay.leftPoint : sportDisplay.rightPoint,
      leftGames: isSwapped ? sportDisplay.rightGames : sportDisplay.leftGames,
      rightGames: isSwapped ? sportDisplay.leftGames : sportDisplay.rightGames,
    };
  }

  return {
    leftMain: isSwapped ? sportDisplay.rightScore : sportDisplay.leftScore,
    rightMain: isSwapped ? sportDisplay.leftScore : sportDisplay.rightScore,
  };
}

function ServingIndicator() {
  return (
    <div
      data-testid="serving-indicator"
      className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber/10 border border-amber/20"
    >
      <div className="w-3 h-3 bg-amber rounded-full animate-pulse" />
      <span className="text-amber text-sm font-bold uppercase tracking-wider">Saque</span>
    </div>
  );
}

function AnimatedScore({
  value,
  shouldReduceMotion,
}: {
  value: string | number;
  shouldReduceMotion: boolean | null;
}) {
  if (shouldReduceMotion) {
    return <span data-testid="score-value">{value}</span>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={value}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="inline-block"
        data-testid="score-value"
      >
        {value}
      </motion.div>
    </AnimatePresence>
  );
}

export function KioskPointDisplay({
  match,
  leftName,
  rightName,
  leftSets,
  rightSets,
  leftServing,
  rightServing,
}: KioskPointDisplayProps) {
  const { i18nText } = useI18n();
  const adapter = useSportAdapter(match);
  const sportDisplay = adapter.computeDisplayData(match);
  const finishedSets = adapter.formatSetHistory(match.setHistory || []);
  const shouldReduceMotion = useReducedMotion();

  const isSwapped = match.swappedSides === true;
  const displayValues = getDisplayValues(sportDisplay, isSwapped);
  const displayLeftName = leftName || i18nText('commonPlayerA');
  const displayRightName = rightName || i18nText('commonPlayerB');

  const swappedHistory = finishedSets.map((set) => ({
    ...set,
    left: isSwapped ? set.right : set.left,
    right: isSwapped ? set.left : set.right,
  }));

  return (
    <div
      data-testid="kiosk-point-display"
      className="flex flex-col w-full h-full bg-surface text-text-h overflow-hidden"
    >
      <div
        data-testid="main-score-area"
        className="flex-1 flex items-center justify-center px-[clamp(1rem,4vw,4rem)] gap-[clamp(1rem,4vw,4rem)] min-h-0"
      >
        <div
          data-testid="left-player-area"
          className="flex-1 flex flex-col items-center justify-center min-w-0"
        >
          <div className="flex items-center gap-[clamp(0.5rem,1vw,1rem)]">
            <span
              data-testid="left-player-name"
              className="text-[clamp(2rem,4vw,4rem)] font-heading font-bold text-text-h text-center truncate"
            >
              {displayLeftName}
            </span>
            {leftServing && <ServingIndicator />}
          </div>
          <div
            data-testid="left-score-panel"
            className="text-[clamp(10rem,22vw,20rem)] font-heading font-bold leading-none text-text-h px-[clamp(1rem,3vw,3rem)] py-[clamp(0.5rem,1.5vw,1.5rem)] rounded-2xl bg-primary/10 border border-primary/20"
          >
            <AnimatedScore
              value={displayValues.leftMain}
              shouldReduceMotion={shouldReduceMotion}
            />
          </div>
          {displayValues.leftGames !== undefined && (
            <span
              data-testid="left-games"
              className="text-[clamp(1.5rem,3vw,3rem)] font-heading font-semibold text-text-muted"
            >
              Games: {displayValues.leftGames}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-[clamp(0.5rem,2vw,2rem)] shrink-0">
          <div
            data-testid="left-sets-panel"
            className="flex flex-col items-center justify-center min-w-[clamp(4rem,10vw,10rem)] aspect-square rounded-2xl bg-primary/10 border border-primary/20 shadow-lg"
          >
            <span className="text-[clamp(1.5rem,3vw,3rem)] font-heading font-semibold text-text-muted">
              Sets
            </span>
            <span className="text-[clamp(5rem,10vw,10rem)] font-heading font-bold leading-none text-text-h">
              {leftSets}
            </span>
          </div>
          <div
            data-testid="right-sets-panel"
            className="flex flex-col items-center justify-center min-w-[clamp(4rem,10vw,10rem)] aspect-square rounded-2xl bg-primary/10 border border-primary/20 shadow-lg"
          >
            <span className="text-[clamp(1.5rem,3vw,3rem)] font-heading font-semibold text-text-muted">
              Sets
            </span>
            <span className="text-[clamp(5rem,10vw,10rem)] font-heading font-bold leading-none text-text-h">
              {rightSets}
            </span>
          </div>
        </div>

        <div
          data-testid="right-player-area"
          className="flex-1 flex flex-col items-center justify-center min-w-0"
        >
          <div className="flex items-center gap-[clamp(0.5rem,1vw,1rem)]">
            {rightServing && <ServingIndicator />}
            <span
              data-testid="right-player-name"
              className="text-[clamp(2rem,4vw,4rem)] font-heading font-bold text-text-h text-center truncate"
            >
              {displayRightName}
            </span>
          </div>
          <div
            data-testid="right-score-panel"
            className="text-[clamp(10rem,22vw,20rem)] font-heading font-bold leading-none text-text-h px-[clamp(1rem,3vw,3rem)] py-[clamp(0.5rem,1.5vw,1.5rem)] rounded-2xl bg-primary/10 border border-primary/20"
          >
            <AnimatedScore
              value={displayValues.rightMain}
              shouldReduceMotion={shouldReduceMotion}
            />
          </div>
          {displayValues.rightGames !== undefined && (
            <span
              data-testid="right-games"
              className="text-[clamp(1.5rem,3vw,3rem)] font-heading font-semibold text-text-muted"
            >
              Games: {displayValues.rightGames}
            </span>
          )}
        </div>
      </div>

      {swappedHistory.length > 0 && (
        <div
          data-testid="set-history-strip"
          className="border-t border-border/20 bg-primary/10 p-[clamp(0.75rem,2vw,2rem)]"
        >
          <div
            className="grid items-center gap-4"
            style={{
              gridTemplateColumns: `auto repeat(${swappedHistory.length}, minmax(0, 1fr))`,
            }}
          >
            <div className="text-[clamp(1.25rem,2.5vw,2.5rem)] font-heading font-bold text-text-muted pr-4 truncate">
              {displayLeftName}
            </div>
            {swappedHistory.map((set, index) => (
              <div
                key={`left-${index}`}
                data-testid={`left-set-${index}`}
                className="text-center text-[clamp(1.25rem,2.5vw,2.5rem)] font-heading font-bold text-text-h"
              >
                {set.left}
              </div>
            ))}
          </div>
          <div
            className="grid items-center gap-4 mt-2"
            style={{
              gridTemplateColumns: `auto repeat(${swappedHistory.length}, minmax(0, 1fr))`,
            }}
          >
            <div className="text-[clamp(1.25rem,2.5vw,2.5rem)] font-heading font-bold text-text-muted pr-4 truncate">
              {displayRightName}
            </div>
            {swappedHistory.map((set, index) => (
              <div
                key={`right-${index}`}
                data-testid={`right-set-${index}`}
                className="text-center text-[clamp(1.25rem,2.5vw,2.5rem)] font-heading font-bold text-text-h"
              >
                {set.right}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
