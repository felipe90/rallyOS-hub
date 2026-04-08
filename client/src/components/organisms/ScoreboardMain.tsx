import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import type { MatchStateExtended, TableStatus, Player } from '../../../../shared/types';
import { ScoreDisplay, ScorePair } from '../molecules/ScoreDisplay';
import { MatchContext, SetScore } from '../molecules/MatchContext';
import { ScoreButton } from '../atoms/Button';
import { Button } from '../atoms/Button';
import { Body, Label, Title } from '../atoms/Typography';
import { Undo2, History, Settings, Wifi, WifiOff } from 'lucide-react';

/* ScoreboardMain Organism - Landscape referee/viewer scoreboard (Tactical Design) */
export interface ScoreboardMainProps {
  match: MatchStateExtended;
  onScorePoint: (player: 'A' | 'B') => void;
  onSubtractPoint?: (player: 'A' | 'B') => void;
  onUndo?: () => void;
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
  isReferee?: boolean;
  isConnected?: boolean;
  className?: string;
}

/* VS Divider - Visual separator between players */
function VSDivider() {
  return (
    <div className="w-px bg-outline/20 relative z-30">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-surface rounded-full flex items-center justify-center shadow-lg border border-outline/10">
        <span className="font-heading font-bold text-xs text-outline italic">VS</span>
      </div>
    </div>
  )
}

/* Subtle background decorations */
function BackgroundDecor() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <div className="absolute top-0 left-0 w-[30vw] h-[30vw] rounded-full bg-primary/5 blur-[100px]" />
      <div className="absolute bottom-0 right-0 w-[30vw] h-[30vw] rounded-full bg-tertiary/5 blur-[100px]" />
    </div>
  )
}

export function ScoreboardMain({
  match,
  onScorePoint,
  onSubtractPoint,
  onUndo,
  onHistoryClick,
  onSettingsClick,
  isReferee = false,
  isConnected = true,
  className = '',
}: ScoreboardMainProps) {
  const { score, status, playerNames, history, setHistory, config } = match
  
  // Calculate sets won for each player
  const setsA = setHistory.filter(s => s.a > s.b).length
  const setsB = setHistory.filter(s => s.b > s.a).length
  const totalSets = config?.bestOf ? Math.ceil(config.bestOf / 2) * 2 - 1 : 3

  // Determine phase label
  const phaseLabel = status === 'FINISHED' ? 'final' : 'quarterfinal'

  // If not LIVE and referee, show config panel
  if (isReferee && status !== 'LIVE' && status !== 'FINISHED') {
    // Import MatchConfigPanel from the same file
    return (
      <div className="flex flex-col h-full">
        <MatchConfigPanelInternal
          defaultConfig={{
            pointsPerSet: config?.pointsPerSet || 11,
            bestOf: config?.bestOf || 3,
            handicapA: config?.handicapA || 0,
            handicapB: config?.handicapB || 0,
          }}
          onStart={(cfg) => {
            // This would be handled by parent component
            onScorePoint('A') // Placeholder - parent handles actual start
          }}
          onCancel={() => {}}
        />
      </div>
    )
  }

  return (
    <div className={`
      flex flex-col h-full
      landscape:flex-row landscape:gap-0
      ${className}
    `}>
      {/* Sidebar (Portrait mode - shows history and controls) */}
      <div className="
        flex flex-col gap-2 p-4 bg-surface-low
        landscape:hidden landscape:w-0 landscape:overflow-hidden
      ">
        {/* Header */}
        <div className="flex items-center justify-between p-2 bg-surface rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-full ${isConnected ? 'bg-primary/20' : 'bg-error/20'}`}>
              {isConnected 
                ? <Wifi size={14} className="text-primary" />
                : <WifiOff size={14} className="text-error" />
              }
            </div>
            <Body className="font-medium text-text-h text-sm">{match.tableName}</Body>
          </div>
          
          <div className="flex gap-2">
            {history && history.length > 0 && onHistoryClick && (
              <motion.button
                className="p-1 rounded-[--radius-md] bg-surface-high hover:bg-surface transition-colors"
                onClick={onHistoryClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="History"
              >
                <History size={16} />
              </motion.button>
            )}
            {onSettingsClick && (
              <motion.button
                className="p-1 rounded-[--radius-md] bg-surface-high hover:bg-surface transition-colors"
                onClick={onSettingsClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Settings"
              >
                <Settings size={16} />
              </motion.button>
            )}
          </div>
        </div>

        {/* Match Phase */}
        <div className="p-2 bg-surface rounded-lg">
          <MatchContext
            phase={phaseLabel}
            status={status}
            bestOf={config?.bestOf}
            pointsPerSet={config?.pointsPerSet}
          />
        </div>

        {/* Sets History - Compact */}
        {setHistory && setHistory.length > 0 && (
          <div className="px-2 py-1 bg-surface rounded-lg overflow-x-auto">
            <div className="flex gap-1">
              {setHistory.map((set, i) => (
                <SetScore
                  key={i}
                  setNumber={i + 1}
                  scoreA={set.a}
                  scoreB={set.b}
                  isCurrentSet={false}
                  isComplete={true}
                />
              ))}
              {status === 'LIVE' && (
                <SetScore
                  setNumber={setHistory.length + 1}
                  scoreA={score.currentSet.a}
                  scoreB={score.currentSet.b}
                  isCurrentSet={true}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col landscape:min-h-screen landscape:justify-center relative">
        {/* Landscape Header - Only visible in landscape */}
        <div className="
          hidden landscape:flex items-center justify-between
          px-6 py-2 bg-background/80 backdrop-blur-md border-b border-outline/10
          landscape:flex-row
        ">
          {/* Left: Logo + Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${isConnected ? 'bg-primary/20' : 'bg-error/20'}`}>
                {isConnected 
                  ? <Wifi size={16} className="text-primary" />
                  : <WifiOff size={16} className="text-error" />
                }
              </div>
              <div className="flex flex-col">
                <span className="font-heading font-bold text-sm leading-tight">RallyOS</span>
                <Label className="text-[9px] uppercase tracking-widest text-primary font-bold leading-none">
                  {isConnected ? 'Synced' : 'Offline'}
                </Label>
              </div>
            </div>
            
            <div className="h-6 w-px bg-outline/30" />
            
            {/* Phase */}
            <div className="flex flex-col">
              <span className="font-heading font-bold text-[10px] tracking-widest uppercase opacity-60 leading-none">
                {phaseLabel === 'final' ? 'Final' : 'Cuartos de Final'}
              </span>
              <span className="font-label text-[10px] font-bold text-tertiary uppercase tracking-tighter">
                {status === 'LIVE' ? 'Live Match' : status === 'FINISHED' ? 'Finished' : 'Waiting'}
              </span>
            </div>
          </div>
          
          {/* Center: Current Sets */}
          <div className="flex items-center bg-surface-low px-4 py-1 rounded-full border border-outline/10">
            <span className="font-label text-[10px] uppercase tracking-widest opacity-60 font-bold mr-3">
              Sets
            </span>
            <span className="font-heading font-bold text-lg text-primary">
              {setsA} - {setsB}
            </span>
          </div>
          
          {/* Right: Actions */}
          <div className="flex gap-2">
            {history && history.length > 0 && onHistoryClick && (
              <motion.button
                className="p-2 rounded-[--radius-md] bg-surface hover:bg-surface-high transition-colors"
                onClick={onHistoryClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="History"
              >
                <History size={20} />
              </motion.button>
            )}
            {onSettingsClick && (
              <motion.button
                className="p-2 rounded-[--radius-md] bg-surface hover:bg-surface-high transition-colors"
                onClick={onSettingsClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Settings"
              >
                <Settings size={20} />
              </motion.button>
            )}
          </div>
        </div>

        {/* Main Score Display - New Tactical Layout for Landscape */}
        <div className="
          flex-1 flex items-center justify-center 
          p-4 landscape:p-8 bg-surface
          landscape:h-full landscape:min-h-screen
        ">
          {isReferee ? (
            // Referee view with tap zones
            <div className="flex w-full h-full landscape:flex-row">
              {/* Player A Column */}
              <section className={`
                flex-1 flex flex-col relative overflow-hidden
                bg-surface-container-low
              `}>
                {/* Tap Zone: Add (top) */}
                <ScoreButton 
                  side="A" 
                  onAdd={() => onScorePoint('A')} 
                  onSubtract={() => onSubtractPoint?.('A')} 
                  disabled={false} 
                />
                
                {/* Score Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                  <div className="text-center mb-[-1rem]">
                    <Title className="text-xl tracking-tight">{playerNames?.a || 'Player A'}</Title>
                    {config?.handicapA !== undefined && config.handicapA !== 0 && (
                      <span className={`
                        inline-block px-3 py-0.5 rounded-full text-xs font-bold uppercase mt-1
                        ${config.handicapA > 0 ? 'bg-surface-high text-primary' : 'bg-surface-high text-error'}
                      `}>
                        {config.handicapA > 0 ? `+${config.handicapA}` : config.handicapA} HCP
                      </span>
                    )}
                  </div>
                  
                  <div className="font-heading font-bold text-[18rem] leading-none text-primary tracking-tighter drop-shadow-2xl">
                    {score.currentSet.a}
                  </div>
                  
                  {/* Sets Won Indicators */}
                  <div className="flex gap-2 mt-[-0.5rem]">
                    {Array.from({ length: totalSets }).map((_, i) => (
                      <div 
                        key={i}
                        className={`
                          w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,107,95,0.5)]
                          ${i < setsA ? 'bg-primary' : 'bg-outline/30'}
                        `}
                      />
                    ))}
                  </div>
                  
                  {score.serving === 'A' && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-amber rounded-full animate-pulse mt-[10rem]" />
                  )}
                </div>
              </section>
              
              {/* VS Divider */}
              <VSDivider />
              
              {/* Player B Column */}
              <section className={`
                flex-1 flex flex-col relative overflow-hidden
                bg-surface
              `}>
                {/* Tap Zone: Add (top) */}
                <ScoreButton 
                  side="B" 
                  onAdd={() => onScorePoint('B')} 
                  onSubtract={() => onSubtractPoint?.('B')} 
                  disabled={false} 
                />
                
                {/* Score Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                  <div className="text-center mb-[-1rem]">
                    <Title className="text-xl tracking-tight">{playerNames?.b || 'Player B'}</Title>
                    {config?.handicapB !== undefined && config.handicapB !== 0 && (
                      <span className={`
                        inline-block px-3 py-0.5 rounded-full text-xs font-bold uppercase mt-1
                        ${config.handicapB > 0 ? 'bg-surface-high text-primary' : 'bg-surface-high text-error'}
                      `}>
                        {config.handicapB > 0 ? `+${config.handicapB}` : config.handicapB} HCP
                      </span>
                    )}
                  </div>
                  
                  <div className="font-heading font-bold text-[18rem] leading-none text-text-h tracking-tighter drop-shadow-2xl">
                    {score.currentSet.b}
                  </div>
                  
                  {/* Sets Won Indicators */}
                  <div className="flex gap-2 mt-[-0.5rem]">
                    {Array.from({ length: totalSets }).map((_, i) => (
                      <div 
                        key={i}
                        className={`
                          w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,107,95,0.5)]
                          ${i < setsB ? 'bg-primary' : 'bg-outline/30'}
                        `}
                      />
                    ))}
                  </div>
                  
                  {score.serving === 'B' && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-amber rounded-full animate-pulse mt-[10rem]" />
                  )}
                </div>
              </section>
              
              {/* Background Decor */}
              <BackgroundDecor />

              {/* Referee Controls - Portrait: bottom, Landscape: right side */}
              {status === 'LIVE' && (
                <div className="
                  flex gap-4 p-4 bg-surface
                  landscape:flex-col landscape:w-32 landscape:h-full landscape:gap-2 landscape:p-3
                ">
                  {/* Undo Button */}
                  <motion.button
                    className={`
                      flex-1 aspect-[4/5] rounded-[--radius-lg]
                      flex flex-col items-center justify-center gap-2
                      shadow-md hover:shadow-lg
                      transition-all text-xs landscape:text-[10px]
                      ${history && history.length > 0 ? 'bg-surface-low' : 'bg-surface-low opacity-50'}
                      landscape:aspect-auto landscape:h-20
                    `}
                    onClick={onUndo}
                    disabled={!history || history.length === 0}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Undo2 size={24} className="landscape:w-4 landscape:h-4" />
                    <Body className="text-xs landscape:text-[10px]">Deshacer</Body>
                  </motion.button>
                </div>
              )}
            </div>
          ) : (
            // Viewer mode (simpler display)
            <ScorePair
              score={score.currentSet}
              serving={score.serving}
              playerNames={playerNames}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* MatchConfigPanel - Configuration before match starts */
export interface MatchConfigPanelProps {
  defaultConfig?: {
    pointsPerSet: number;
    bestOf: number;
    handicapA?: number;
    handicapB?: number;
  };
  onStart: (config: { pointsPerSet: number; bestOf: number; handicapA?: number; handicapB?: number }) => void;
  onCancel: () => void;
}

function MatchConfigPanelInternal({
  defaultConfig = { pointsPerSet: 11, bestOf: 3, handicapA: 0, handicapB: 0 },
  onStart,
  onCancel,
}: MatchConfigPanelProps) {
  const [pointsPerSet, setPointsPerSet] = useState(defaultConfig.pointsPerSet || 11);
  const [bestOf, setBestOf] = useState(defaultConfig.bestOf || 3);
  const [handicapA, setHandicapA] = useState(defaultConfig.handicapA || 0);
  const [handicapB, setHandicapB] = useState(defaultConfig.handicapB || 0);

  const handleStart = () => {
    onStart({ pointsPerSet, bestOf, handicapA, handicapB });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-surface">
      <Body className="text-2xl mb-8 font-heading">Configurar Partido</Body>
      
      <div className="flex flex-col gap-6 w-full max-w-md">
        {/* Puntos por set */}
        <div className="flex flex-col gap-2">
          <Body className="font-medium text-lg">Puntos por set</Body>
          <div className="flex gap-2">
            {[11, 15, 21].map((points) => (
              <button
                key={points}
                className={`
                  flex-1 p-4 rounded-[--radius-md]
                  font-heading text-lg font-medium transition-colors
                  ${pointsPerSet === points 
                    ? 'bg-primary text-white' 
                    : 'bg-surface-low hover:bg-surface-high'}
                `}
                onClick={() => setPointsPerSet(points)}
              >
                {points}
              </button>
            ))}
          </div>
        </div>
        
        {/* Mejor de */}
        <div className="flex flex-col gap-2">
          <Body className="font-medium text-lg">Mejor de</Body>
          <div className="flex gap-2">
            {[1, 3, 5].map((bo) => (
              <button
                key={bo}
                className={`
                  flex-1 p-4 rounded-[--radius-md]
                  font-heading text-lg font-medium transition-colors
                  ${bestOf === bo 
                    ? 'bg-primary text-white' 
                    : 'bg-surface-low hover:bg-surface-high'}
                `}
                onClick={() => setBestOf(bo)}
              >
                {bo}
              </button>
            ))}
          </div>
        </div>

        {/* Handicap */}
        <div className="flex flex-col gap-2 pt-4 border-t border-surface-high">
          <Body className="font-medium text-lg">Handicap</Body>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2 items-center">
              <Label>Equipo A</Label>
              <div className="flex items-center gap-2 bg-surface-low rounded-[--radius-md] p-2">
                <button
                  onClick={() => setHandicapA(handicapA - 1)}
                  className="p-2 hover:bg-surface-high rounded-[--radius-sm] transition-colors"
                >
                  −
                </button>
                <div className="w-12 text-center font-heading text-xl font-bold">
                  {handicapA}
                </div>
                <button
                  onClick={() => setHandicapA(handicapA + 1)}
                  className="p-2 hover:bg-surface-high rounded-[--radius-sm] transition-colors"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2 items-center">
              <Label>Equipo B</Label>
              <div className="flex items-center gap-2 bg-surface-low rounded-[--radius-md] p-2">
                <button
                  onClick={() => setHandicapB(handicapB - 1)}
                  className="p-2 hover:bg-surface-high rounded-[--radius-sm] transition-colors"
                >
                  −
                </button>
                <div className="w-12 text-center font-heading text-xl font-bold">
                  {handicapB}
                </div>
                <button
                  onClick={() => setHandicapB(handicapB + 1)}
                  className="p-2 hover:bg-surface-high rounded-[--radius-sm] transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleStart} className="flex-1">
            Iniciar
          </Button>
        </div>
      </div>
    </div>
  );
}

/* Export MatchConfigPanel for external use */
export function MatchConfigPanel({
  defaultConfig,
  onStart,
  onCancel,
}: MatchConfigPanelProps) {
  return (
    <MatchConfigPanelInternal
      defaultConfig={defaultConfig}
      onStart={onStart}
      onCancel={onCancel}
    />
  );
}