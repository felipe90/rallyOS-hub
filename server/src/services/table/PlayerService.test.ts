/**
 * PlayerService Tests — setRefereeDirect return type
 *
 * Verifies:
 * - setRefereeDirect returns displaced socketId when replacing an existing referee
 * - setRefereeDirect returns null on first registration (no displacement)
 */

import { PlayerService } from './PlayerService';
import { PinService } from '../security/PinService';
import { MatchEngine } from '../../domain/matchEngine';
import type { Court } from '../../domain/types';

// ── Helpers ────────────────────────────────────────────────────────────

function makeCourt(overrides: Partial<Court> = {}): Court {
  return {
    id: 'court-1',
    number: 1,
    name: 'Test Court',
    status: 'WAITING',
    pin: '1234',
    sportRules: new MatchEngine(),
    playerNames: { a: 'Player A', b: 'Player B' },
    history: [],
    players: [],
    createdAt: Date.now(),
    featured: false,
    occupiedAt: null,
    ...overrides,
  };
}

describe('PlayerService — setRefereeDirect', () => {
  let service: PlayerService;

  beforeEach(() => {
    service = new PlayerService(new PinService());
  });

  it('should return null when no existing referee', () => {
    const court = makeCourt();
    const result = service.setRefereeDirect(court, 'socket-1', 'Player');
    expect(result).toBeNull();
  });

  it('should return the displaced socketId when replacing an existing referee', () => {
    const court = makeCourt({
      players: [
        { socketId: 'old-ref', name: 'Old Ref', role: 'REFEREE', joinedAt: Date.now() },
      ],
    });

    const result = service.setRefereeDirect(court, 'new-ref', 'New Player');
    expect(result).toBe('old-ref');
  });

  it('should remove the old referee from the players array on displacement', () => {
    const court = makeCourt({
      players: [
        { socketId: 'old-ref', name: 'Old Ref', role: 'REFEREE', joinedAt: Date.now() },
        { socketId: 'spectator-1', name: 'Spectator', role: 'SPECTATOR', joinedAt: Date.now() },
      ],
    });

    service.setRefereeDirect(court, 'new-ref', 'New Player');
    const oldRefStillPresent = court.players.some(p => p.socketId === 'old-ref');
    expect(oldRefStillPresent).toBe(false);
  });

  it('should assign the new socket as REFEREE', () => {
    const court = makeCourt();
    service.setRefereeDirect(court, 'socket-1', 'Player');
    const player = court.players.find(p => p.socketId === 'socket-1');
    expect(player?.role).toBe('REFEREE');
  });

  it('should return null when the same socket re-registers as referee', () => {
    const court = makeCourt({
      players: [
        { socketId: 'same-sock', name: 'Same Player', role: 'REFEREE', joinedAt: Date.now() },
      ],
    });

    const result = service.setRefereeDirect(court, 'same-sock', 'Same Player');
    expect(result).toBeNull();
  });
});
