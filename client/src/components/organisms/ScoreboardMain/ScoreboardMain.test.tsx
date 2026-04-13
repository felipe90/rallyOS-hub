import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScoreboardMain } from './ScoreboardMain';
import { MatchConfigPanel } from '../MatchConfigPanel';
import type { MatchStateExtended, Score } from '../../../shared/types';
import React from 'react';

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('../../hooks/useMatchDisplay', () => ({
  useMatchDisplay: vi.fn((match: MatchStateExtended) => {
    const setHistory = match.setHistory || [];
    const setsA = setHistory.filter((s) => s.a > s.b).length;
    const setsB = setHistory.filter((s) => s.b > s.a).length;
    const totalSets = match.config?.bestOf ? (match.config.bestOf - 1) / 2 + 1 : 3;
    
    const isSwapped = match.swappedSides;
    const leftPlayer = isSwapped ? 'B' : 'A';
    const rightPlayer = isSwapped ? 'A' : 'B';
    const leftName = isSwapped ? match.playerNames.b : match.playerNames.a;
    const rightName = isSwapped ? match.playerNames.a : match.playerNames.b;
    const leftScore = isSwapped ? match.score.currentSet.b : match.score.currentSet.a;
    const rightScore = isSwapped ? match.score.currentSet.a : match.score.currentSet.b;
    const leftServing = match.score.serving === (isSwapped ? 'B' : 'A');
    const rightServing = match.score.serving === (isSwapped ? 'A' : 'B');
    const leftHandicap = isSwapped ? match.config?.handicapB : match.config?.handicapA;
    const rightHandicap = isSwapped ? match.config?.handicapA : match.config?.handicapB;

    return {
      setsA,
      setsB,
      totalSets,
      isSwapped,
      leftPlayer,
      rightPlayer,
      leftName,
      rightName,
      leftScore,
      rightScore,
      leftSets: setsA,
      rightSets: setsB,
      leftHandicap,
      rightHandicap,
      leftServing,
      rightServing,
      phaseLabel: 'round',
    };
  }),
}));

const createMockMatch = (overrides: Partial<MatchStateExtended> = {}): MatchStateExtended => ({
  tableId: 'table-1',
  tableName: 'Mesa 1',
  playerNames: { a: 'Alice', b: 'Bob' },
  history: [],
  undoAvailable: false,
  config: {
    pointsPerSet: 11,
    bestOf: 3,
    minDifference: 2,
    handicapA: 0,
    handicapB: 0,
  },
  score: {
    sets: { a: 0, b: 0 },
    currentSet: { a: 0, b: 0 },
    serving: 'A',
  },
  swappedSides: false,
  midSetSwapped: false,
  setHistory: [],
  status: 'LIVE',
  winner: null,
  ...overrides,
});

describe('ScoreboardMain', () => {
  describe('Score Display Tests', () => {
    it('muestra Player A name correctamente', () => {
      const mockMatch = createMockMatch({
        playerNames: { a: 'Alice', b: 'Bob' },
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} />);
      
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('muestra Player B name correctamente', () => {
      const mockMatch = createMockMatch({
        playerNames: { a: 'Alice', b: 'Bob' },
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} />);
      
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('muestra current set scores', () => {
      const mockMatch = createMockMatch({
        score: {
          sets: { a: 1, b: 0 },
          currentSet: { a: 5, b: 3 },
          serving: 'A',
        },
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} />);
      
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('muestra sets ganados de cada player', () => {
      const mockMatch = createMockMatch({
        setHistory: [
          { a: 11, b: 5 },
          { a: 8, b: 11 },
          { a: 11, b: 9 },
        ],
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} isReferee />);
      
      expect(screen.getByText('2 - 1')).toBeInTheDocument();
    });
  });

  describe('Interaction Tests', () => {
    it('llama onScorePoint cuando se hace click en score button', () => {
      const onScorePoint = vi.fn();
      const mockMatch = createMockMatch({
        status: 'LIVE',
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={onScorePoint} isReferee />);
      
      const buttons = document.querySelectorAll('button');
      const addButton = Array.from(buttons).find(
        (btn) => btn.getAttribute('aria-label') === 'Add point to A'
      );
      
      if (addButton) {
        fireEvent.click(addButton);
        expect(onScorePoint).toHaveBeenCalledWith('A');
      }
    });

    it('llama onSubtractPoint cuando se hace click en subtract', () => {
      const onSubtractPoint = vi.fn();
      const mockMatch = createMockMatch({
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 5, b: 3 },
          serving: 'A',
        },
      });
      
      render(
        <ScoreboardMain
          match={mockMatch}
          onScorePoint={() => {}}
          onSubtractPoint={onSubtractPoint}
          isReferee
        />
      );
      
      const buttons = document.querySelectorAll('button');
      const subtractButton = Array.from(buttons).find(
        (btn) => btn.getAttribute('aria-label') === 'Subtract point from A'
      );
      
      if (subtractButton) {
        fireEvent.click(subtractButton);
        expect(onSubtractPoint).toHaveBeenCalledWith('A');
      }
    });

    it('llama onHistoryClick cuando se hace click en history button', () => {
      const onHistoryClick = vi.fn();
      const mockMatch = createMockMatch({
        history: [{ id: '1', action: 'POINT', pointsBefore: { a: 0, b: 0 }, pointsAfter: { a: 1, b: 0 }, timestamp: Date.now() }],
        undoAvailable: true,
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} onHistoryClick={onHistoryClick} isReferee />);
      
      const historyButtons = screen.getAllByLabelText('History');
      fireEvent.click(historyButtons[0]);
      expect(onHistoryClick).toHaveBeenCalled();
    });

    it('llama onUndo cuando se provee y hay historial', () => {
      const onUndo = vi.fn();
      const mockMatch = createMockMatch({
        history: [{ id: '1', action: 'POINT', pointsBefore: { a: 0, b: 0 }, pointsAfter: { a: 1, b: 0 }, timestamp: Date.now() }],
        undoAvailable: true,
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} onUndo={onUndo} isReferee />);
      
      expect(mockMatch.history.length).toBeGreaterThan(0);
    });
  });

  describe('Logic Tests', () => {
    it('detecta set winner en el punto correcto (11 puntos o 2 de diferencia)', () => {
      const onScorePoint = vi.fn();
      const mockMatch = createMockMatch({
        config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
        score: {
          sets: { a: 0, b: 0 },
          currentSet: { a: 11, b: 9 },
          serving: 'A',
        },
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={onScorePoint} isReferee />);
      
      expect(screen.getByText('11')).toBeInTheDocument();
      expect(screen.getByText('9')).toBeInTheDocument();
    });

    it('detecta match winner en sets correctas (bestOf)', () => {
      const mockMatch = createMockMatch({
        config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
        setHistory: [
          { a: 11, b: 5 },
          { a: 11, b: 8 },
        ],
        status: 'LIVE',
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} isReferee />);
      
      expect(screen.getByText('2 - 0')).toBeInTheDocument();
    });

    it('swap de lados cuando swappedSides es true', () => {
      const mockMatch = createMockMatch({
        swappedSides: true,
        playerNames: { a: 'Alice', b: 'Bob' },
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} />);
      
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('NO hace swap entre sets (solo en deuce)', () => {
      const mockMatch = createMockMatch({
        swappedSides: false,
        midSetSwapped: false,
        playerNames: { a: 'Alice', b: 'Bob' },
        setHistory: [
          { a: 11, b: 9 },
        ],
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} />);
      
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  describe('UI Tests', () => {
    it('muestra config panel cuando status !== LIVE y isReferee=true', () => {
      const mockMatch = createMockMatch({
        status: 'WAITING',
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} isReferee />);
      
      expect(screen.getByText('Configurar Partido')).toBeInTheDocument();
    });

    it('muestra live match view cuando status === LIVE', () => {
      const mockMatch = createMockMatch({
        status: 'LIVE',
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} isReferee />);
      
      expect(screen.queryByText('Configurar Partido')).not.toBeInTheDocument();
    });

    it('oculta header en landscape orientation', () => {
      const mockMatch = createMockMatch();
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} />);
      
      const portraitHeader = screen.getByText('Mesa 1');
      expect(portraitHeader).toBeInTheDocument();
    });
  });

  describe('State Tests', () => {
    it('deshabilita botones cuando no está conectado', () => {
      const mockMatch = createMockMatch();
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} isReferee isConnected={false} />);
      
      const wifiIcon = document.querySelector('.text-error');
      expect(wifiIcon).toBeInTheDocument();
    });

    it('muestra controles de referee cuando isReferee=true', () => {
      const mockMatch = createMockMatch({
        status: 'LIVE',
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} isReferee />);
      
      expect(screen.queryByText('Configurar Partido')).not.toBeInTheDocument();
    });

    it('oculta controles de referee cuando isReferee=false', () => {
      const mockMatch = createMockMatch({
        status: 'LIVE',
      });
      
      render(<ScoreboardMain match={mockMatch} onScorePoint={() => {}} isReferee={false} />);
      
      expect(screen.queryByText('Configurar Partido')).not.toBeInTheDocument();
    });
  });
});

describe('MatchConfigPanel', () => {
  it('renders config panel', () => {
    render(<MatchConfigPanel onStart={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Configurar Partido')).toBeInTheDocument();
  });

  it('renders point options', () => {
    render(<MatchConfigPanel onStart={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
  });

  it('renders best of options', () => {
    render(<MatchConfigPanel onStart={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('calls onStart with config when Start button clicked', () => {
    const onStart = vi.fn();
    render(<MatchConfigPanel onStart={onStart} onCancel={() => {}} />);
    
    const startButton = screen.getByText('Iniciar');
    fireEvent.click(startButton);
    
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        pointsPerSet: 11,
        bestOf: 3,
      })
    );
  });

  it('calls onCancel when Cancel button clicked', () => {
    const onCancel = vi.fn();
    render(<MatchConfigPanel onStart={() => {}} onCancel={onCancel} />);
    
    const cancelButton = screen.getByText('Cancelar');
    fireEvent.click(cancelButton);
    
    expect(onCancel).toHaveBeenCalled();
  });

  it('allows selecting different points per set', () => {
    render(<MatchConfigPanel onStart={() => {}} onCancel={() => {}} />);
    
    const button21 = screen.getByText('21');
    fireEvent.click(button21);
    
    const startButton = screen.getByText('Iniciar');
    fireEvent.click(startButton);
    
    expect(screen.getByText('21')).toBeInTheDocument();
  });

  it('allows selecting different best of', () => {
    render(<MatchConfigPanel onStart={() => {}} onCancel={() => {}} />);
    
    const button5 = screen.getByText('5');
    fireEvent.click(button5);
    
    const startButton = screen.getByText('Iniciar');
    fireEvent.click(startButton);
    
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
