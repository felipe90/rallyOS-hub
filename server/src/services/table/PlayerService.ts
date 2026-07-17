/**
 * PlayerService - Player management
 *
 * Responsibility: Join, leave, and referee management.
 */

import { Court, PlayerConnection } from '../../domain/types';
import { logger } from '../../utils/logger';
import { sanitizeInput } from '../../utils/validation';
import { PinService } from '../security/PinService';
import type { IPinService, IPlayerService } from '../../domain/ports';

export class PlayerService implements IPlayerService {
  private pinService: IPinService;

  constructor(pinService: IPinService) {
    this.pinService = pinService;
  }

  joinCourt(court: Court, socketId: string, name: string, pin?: string): boolean {
    if (pin && !this.pinService.validatePin(court, pin)) {
      logger.warn({ courtId: court.id, courtName: court.name }, 'Invalid PIN attempt');
      return false;
    }

    const sanitizedName = sanitizeInput(name, 100);
    const existing = court.players.find(p => p.socketId === socketId);
    if (existing) {
      existing.name = sanitizedName;
      return true;
    }

    const player: PlayerConnection = {
      socketId,
      name: sanitizedName,
      role: 'SPECTATOR',
      joinedAt: Date.now()
    };

    court.players.push(player);
    logger.info({ courtId: court.id, courtName: court.name, playerName: sanitizedName }, 'Player joined court');
    return true;
  }

  leaveCourt(court: Court, socketId: string): void {
    const index = court.players.findIndex(p => p.socketId === socketId);
    if (index === -1) return;

    const player = court.players[index];
    court.players.splice(index, 1);
    logger.info({ courtId: court.id, courtName: court.name, playerName: player.name }, 'Player left court');
  }

  setReferee(court: Court, socketId: string, pin: string): boolean {
    if (!this.pinService.validatePin(court, pin)) return false;

    const existingReferee = court.players.find(p => p.role === 'REFEREE');
    if (existingReferee && existingReferee.socketId !== socketId) {
      court.players = court.players.filter(p => p.socketId !== existingReferee.socketId);
      logger.info({ courtId: court.id, courtName: court.name, oldReferee: existingReferee.socketId, newReferee: socketId }, 'Replacing existing referee');
    }

    const player = court.players.find(p => p.socketId === socketId);
    if (player) {
      player.role = 'REFEREE';
    } else {
      court.players.push({
        socketId,
        name: 'Referee',
        role: 'REFEREE',
        joinedAt: Date.now()
      });
    }

    logger.info({ courtId: court.id, courtName: court.name, socketId }, 'Referee authenticated');
    return true;
  }

  /**
   * Set a socket as referee without PIN validation.
   * Used by club-mode courts where the joining player IS the referee.
   *
   * @returns The old referee's socketId if one was displaced, null otherwise.
   */
  setRefereeDirect(court: Court, socketId: string, name: string): string | null {
    const existingReferee = court.players.find(p => p.role === 'REFEREE');
    let displacedSocketId: string | null = null;
    if (existingReferee && existingReferee.socketId !== socketId) {
      displacedSocketId = existingReferee.socketId;
      court.players = court.players.filter(p => p.socketId !== existingReferee.socketId);
      logger.info({ courtId: court.id, courtName: court.name, oldReferee: existingReferee.socketId, newReferee: socketId }, 'Replacing existing referee');
    }

    const player = court.players.find(p => p.socketId === socketId);
    if (player) {
      player.role = 'REFEREE';
    } else {
      court.players.push({
        socketId,
        name: sanitizeInput(name, 100),
        role: 'REFEREE',
        joinedAt: Date.now(),
      });
    }

    logger.info({ courtId: court.id, courtName: court.name, socketId }, 'Club referee registered');
    return displacedSocketId;
  }

  isReferee(court: Court, socketId: string): boolean {
    const player = court.players.find(p => p.socketId === socketId);
    return player?.role === 'REFEREE';
  }

  getRefereeSocketId(court: Court): string | null {
    const referee = court.players.find(p => p.role === 'REFEREE');
    return referee?.socketId || null;
  }
}
