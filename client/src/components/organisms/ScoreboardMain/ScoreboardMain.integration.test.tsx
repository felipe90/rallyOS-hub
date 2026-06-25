/**
 * ScoreboardMain integration tests — REAL TTPointDisplay + real hooks.
 *
 * These tests do NOT mock useMatchDisplay, useSportAdapter, or display
 * components. They render the real ScoreboardMain → real SportDisplaySelector
 * → real TTPointDisplay → real PlayerSide to verify the side-swap scoring
 * fix end-to-end.
 *
 * Only framer-motion is mocked (global in setup.ts) for jsdom rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScoreboardMain } from './ScoreboardMain';
import type { MatchStateExtended } from '@shared/types';
import { SPORT } from '@shared/types';

// navigator.vibrate no existe en jsdom — lo definimos y mockeamos
beforeEach(() => {
  // @ts-expect-error — vibrate no existe en el tipo Navigator de jsdom
  navigator.vibrate = vi.fn(() => true);
});

const createMatch = (overrides: Partial<MatchStateExtended> = {}): MatchStateExtended => ({
  tableId: 'table-1',
  tableName: 'Mesa 1',
  playerNames: { a: 'Alice', b: 'Bob' },
  history: [],
  undoAvailable: false,
  config: {
    sport: SPORT.TABLE_TENNIS,
    pointsPerSet: 11,
    bestOf: 3,
    minDifference: 2,
  } as any,
  score: {
    sets: { a: 0, b: 0 },
    currentSet: { a: 5, b: 3 },
    serving: 'A',
  },
  sport: SPORT.TABLE_TENNIS,
  swappedSides: false,
  midSetSwapped: false,
  setHistory: [],
  status: 'LIVE',
  winner: null,
  courtName: 'Mesa 1',
  ...overrides,
});

describe('ScoreboardMain — Integration (real TTPointDisplay)', () => {
  it('llama onScorePoint("A") al tocar la izquierda sin swap', () => {
    const onScorePoint = vi.fn();
    render(
      <ScoreboardMain
        match={createMatch()}
        onScorePoint={onScorePoint}
        isReferee
      />,
    );

    // Sin swap: la izquierda muestra "Área de Alice" (Player A)
    const leftArea = screen.getByLabelText('Área de Alice');
    fireEvent.click(leftArea);

    expect(onScorePoint).toHaveBeenCalledWith('A');
  });

  it('llama onScorePoint("B") al tocar la derecha sin swap', () => {
    const onScorePoint = vi.fn();
    render(
      <ScoreboardMain
        match={createMatch()}
        onScorePoint={onScorePoint}
        isReferee
      />,
    );

    // Sin swap: la derecha muestra "Área de Bob" (Player B)
    const rightArea = screen.getByLabelText('Área de Bob');
    fireEvent.click(rightArea);

    expect(onScorePoint).toHaveBeenCalledWith('B');
  });

  it('mapea a Player B al tocar izquierda cuando swappedSides=true', () => {
    const onScorePoint = vi.fn();
    render(
      <ScoreboardMain
        match={createMatch({ swappedSides: true })}
        onScorePoint={onScorePoint}
        isReferee
      />,
    );

    // Con swap: la izquierda muestra "Área de Bob" (Player B visualmente)
    const leftArea = screen.getByLabelText('Área de Bob');
    fireEvent.click(leftArea);

    // PlayerSide.side="A" (hardcodeado) → handleScorePoint("A")
    // → actualPlayer = leftPlayer = "B" (porque swappedSides=true)
    // → onScorePoint("B")
    expect(onScorePoint).toHaveBeenCalledWith('B');
  });

  it('mapea a Player A al tocar derecha cuando swappedSides=true', () => {
    const onScorePoint = vi.fn();
    render(
      <ScoreboardMain
        match={createMatch({ swappedSides: true })}
        onScorePoint={onScorePoint}
        isReferee
      />,
    );

    // Con swap: la derecha muestra "Área de Alice" (Player A visualmente)
    const rightArea = screen.getByLabelText('Área de Alice');
    fireEvent.click(rightArea);

    // PlayerSide.side="B" (hardcodeado) → handleScorePoint("B")
    // → actualPlayer = rightPlayer = "A" (porque swappedSides=true)
    // → onScorePoint("A")
    expect(onScorePoint).toHaveBeenCalledWith('A');
  });

  it('no llama onScorePoint cuando isReferee=false', () => {
    const onScorePoint = vi.fn();
    render(
      <ScoreboardMain
        match={createMatch({ swappedSides: true })}
        onScorePoint={onScorePoint}
        isReferee={false}
      />,
    );

    // Sin referee mode: los clicks no deberían llamar onScorePoint
    const leftArea = screen.queryByLabelText('Área de Bob');
    if (leftArea) {
      fireEvent.click(leftArea);
      expect(onScorePoint).not.toHaveBeenCalled();
    }
  });
});
