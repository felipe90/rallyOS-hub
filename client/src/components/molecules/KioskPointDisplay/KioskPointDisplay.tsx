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

function ServingIndicator({ active }: { active: boolean }) {
  return (
    <div
      data-testid="serving-indicator"
      className={`flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber/10 border border-amber/20 ${active ? 'visible' : 'invisible'}`}
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
      className="flex flex-col w-full h-full bg-[var(--color-primary-light)] text-white overflow-hidden"
    >
      <div
        data-testid="main-score-area"
        className="flex-1 flex items-center justify-center px-[clamp(1rem,4vw,4rem)] gap-[clamp(1rem,4vw,4rem)] min-h-0"
      >
        <div
          data-testid="left-player-area"
          className="flex-1 flex flex-col items-center justify-center min-w-0"
        >
          <div className="flex flex-col items-center">
            <ServingIndicator active={leftServing} />
            <span
              data-testid="left-player-name"
              className="text-[clamp(2rem,5vw,7rem)] font-heading font-bold text-white text-center leading-tight line-clamp-1"
            >
              {displayLeftName}
            </span>
          </div>
          <div
            data-testid="left-score-panel"
            className="text-[clamp(10rem,30vw,26rem)] font-heading font-bold leading-none text-white px-[clamp(2rem,4vw,5rem)] py-[clamp(0.75rem,2vw,2.5rem)] rounded-2xl bg-[var(--color-primary)] border border-white/10"
          >
            <AnimatedScore
              value={displayValues.leftMain}
              shouldReduceMotion={shouldReduceMotion}
            />
          </div>
          {displayValues.leftGames !== undefined && (
            <span
              data-testid="left-games"
              className="text-[clamp(1.5rem,3vw,4rem)] font-heading font-semibold text-white/70"
            >
              Games: {displayValues.leftGames}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-[clamp(0.5rem,2vw,2rem)] shrink-0">
          <div
            data-testid="left-sets-panel"
            className="flex flex-col items-center justify-center min-w-[clamp(4rem,12vw,14rem)] p-[clamp(0.75rem,1.5vw,2rem)] rounded-2xl bg-[var(--color-primary)] border border-white/10 shadow-lg text-white/70"
          >
            <span className="text-[clamp(1.5rem,3vw,4rem)] font-heading font-semibold">
              Sets
            </span>
            <span className="text-[clamp(5rem,14vw,18rem)] font-heading font-bold leading-none text-white">
              {leftSets}
            </span>
          </div>
          <div
            data-testid="right-sets-panel"
            className="flex flex-col items-center justify-center min-w-[clamp(4rem,12vw,14rem)] p-[clamp(0.75rem,1.5vw,2rem)] rounded-2xl bg-[var(--color-primary)] border border-white/10 shadow-lg text-white/70"
          >
            <span className="text-[clamp(1.5rem,3vw,4rem)] font-heading font-semibold">
              Sets
            </span>
            <span className="text-[clamp(5rem,14vw,18rem)] font-heading font-bold leading-none text-white">
              {rightSets}
            </span>
          </div>
        </div>

        <div
          data-testid="right-player-area"
          className="flex-1 flex flex-col items-center justify-center min-w-0"
        >
          <div className="flex flex-col items-center">
            <ServingIndicator active={rightServing} />
            <span
              data-testid="right-player-name"
              className="text-[clamp(2rem,5vw,7rem)] font-heading font-bold text-white text-center leading-tight line-clamp-1"
            >
              {displayRightName}
            </span>
          </div>
          <div
            data-testid="right-score-panel"
            className="text-[clamp(10rem,30vw,26rem)] font-heading font-bold leading-none text-white px-[clamp(2rem,4vw,5rem)] py-[clamp(0.75rem,2vw,2.5rem)] rounded-2xl bg-[var(--color-primary)] border border-white/10"
          >
            <AnimatedScore
              value={displayValues.rightMain}
              shouldReduceMotion={shouldReduceMotion}
            />
          </div>
          {displayValues.rightGames !== undefined && (
            <span
              data-testid="right-games"
              className="text-[clamp(1.5rem,3vw,4rem)] font-heading font-semibold text-white/70"
            >
              Games: {displayValues.rightGames}
            </span>
          )}
        </div>
      </div>

      <div
        data-testid="set-history-strip"
        className="border-t border-white/10 bg-[var(--color-primary)] p-[clamp(0.75rem,2vw,2rem)] min-h-[clamp(3rem,6vw,6rem)]"
      >
        {swappedHistory.length > 0 && (
          <>
            <div
              className="grid items-center gap-4"
              style={{
                gridTemplateColumns: `auto repeat(${swappedHistory.length}, minmax(0, 1fr))`,
              }}
            >
              <div className="text-[clamp(1.25rem,3vw,4rem)] font-heading font-bold text-white/70 pr-4 leading-tight line-clamp-1">
                {displayLeftName}
              </div>
              {swappedHistory.map((set, index) => (
                <div
                  key={`left-${index}`}
                  data-testid={`left-set-${index}`}
                  className="text-center text-[clamp(1.25rem,3vw,4rem)] font-heading font-bold text-white"
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
              <div className="text-[clamp(1.25rem,3vw,4rem)] font-heading font-bold text-white/70 pr-4 leading-tight line-clamp-1">
                {displayRightName}
              </div>
              {swappedHistory.map((set, index) => (
                <div
                  key={`right-${index}`}
                  data-testid={`right-set-${index}`}
                  className="text-center text-[clamp(1.25rem,3vw,4rem)] font-heading font-bold text-white"
                >
                  {set.right}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
