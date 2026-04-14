import { useState } from 'react';
import { Button } from '../../atoms/Button';
import { Body, Label } from '../../atoms/Typography';

/* MatchConfigPanel - Configuration before match starts */
export interface MatchConfigPanelProps {
  defaultConfig?: {
    pointsPerSet: number;
    bestOf: number;
    handicapA?: number;
    handicapB?: number;
    playerNameA?: string;
    playerNameB?: string;
  };
  onStart: (config: { 
    pointsPerSet: number; 
    bestOf: number; 
    handicapA?: number; 
    handicapB?: number;
    playerNameA?: string;
    playerNameB?: string;
  }) => void;
  onCancel: () => void;
}

export function MatchConfigPanel({
  defaultConfig = { pointsPerSet: 11, bestOf: 3, handicapA: 0, handicapB: 0, playerNameA: '', playerNameB: '' },
  onStart,
  onCancel,
}: MatchConfigPanelProps) {
  const [pointsPerSet, setPointsPerSet] = useState(defaultConfig.pointsPerSet || 11);
  const [bestOf, setBestOf] = useState(defaultConfig.bestOf || 3);
  const [handicapA, setHandicapA] = useState(defaultConfig.handicapA || 0);
  const [handicapB, setHandicapB] = useState(defaultConfig.handicapB || 0);
  const [playerNameA, setPlayerNameA] = useState(defaultConfig.playerNameA || '');
  const [playerNameB, setPlayerNameB] = useState(defaultConfig.playerNameB || '');

  const handleStart = () => {
    onStart({ 
      pointsPerSet, 
      bestOf, 
      handicapA, 
      handicapB,
      playerNameA: playerNameA.trim() || 'Player A',
      playerNameB: playerNameB.trim() || 'Player B'
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-surface">
      <Body className="text-2xl mb-8 font-heading">Configurar Partido</Body>
      
      <div className="flex flex-col gap-6 w-full max-w-md">
        {/* Nombres de jugadores */}
        <div className="flex flex-col gap-2 pb-4 border-b border-surface-high">
          <Body className="font-medium text-lg">Jugadores</Body>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Jugador A"
              value={playerNameA}
              onChange={(e) => setPlayerNameA(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="text"
              placeholder="Jugador B"
              value={playerNameB}
              onChange={(e) => setPlayerNameB(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Body className="text-sm text-text-muted">Deja en blanco para usar nombres por defecto</Body>
        </div>
        
        {/* Puntos por set */}
        <div className="flex flex-col gap-2">
          <Body className="font-medium text-lg">Puntos por set</Body>
          <div className="flex gap-2">
            {[11, 15, 21].map((points) => (
              <Button
                key={points}
                variant={pointsPerSet === points ? 'primary' : 'secondary'}
                size="lg"
                fullWidth
                onClick={() => setPointsPerSet(points)}
              >
                {points}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Mejor de */}
        <div className="flex flex-col gap-2">
          <Body className="font-medium text-lg">Mejor de</Body>
          <div className="flex gap-2">
            {[1, 3, 5].map((bo) => (
              <Button
                key={bo}
                variant={bestOf === bo ? 'primary' : 'secondary'}
                size="lg"
                fullWidth
                onClick={() => setBestOf(bo)}
              >
                {bo}
              </Button>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHandicapA(handicapA - 1)}
                  className="!p-2"
                >
                  −
                </Button>
                <div className="w-12 text-center font-heading text-xl font-bold">
                  {handicapA}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHandicapA(handicapA + 1)}
                  className="!p-2"
                >
                  +
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2 items-center">
              <Label>Equipo B</Label>
              <div className="flex items-center gap-2 bg-surface-low rounded-[--radius-md] p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHandicapB(handicapB - 1)}
                  className="!p-2"
                >
                  −
                </Button>
                <div className="w-12 text-center font-heading text-xl font-bold">
                  {handicapB}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHandicapB(handicapB + 1)}
                  className="!p-2"
                >
                  +
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleStart} className="flex-1 bg-primary">
            Iniciar
          </Button>
        </div>
      </div>
    </div>
  );
}
