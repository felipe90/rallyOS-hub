/**
 * PlayerService - Player management
 *
 * Responsibility: Join, leave, and referee management.
 */

import { Table, PlayerConnection } from '../../domain/types';
import { logger } from '../../utils/logger';

export class PlayerService {
  joinTable(table: Table, socketId: string, name: string, pin?: string): boolean {
    if (pin && table.pin !== pin) {
      logger.warn({ tableId: table.id, tableName: table.name }, 'Invalid PIN attempt');
      return false;
    }

    const existing = table.players.find(p => p.socketId === socketId);
    if (existing) {
      existing.name = name;
      return true;
    }

    const player: PlayerConnection = {
      socketId,
      name,
      role: 'SPECTATOR',
      joinedAt: Date.now()
    };

    table.players.push(player);
    logger.info({ tableId: table.id, tableName: table.name, playerName: name }, 'Player joined table');
    return true;
  }

  leaveTable(table: Table, socketId: string): void {
    const index = table.players.findIndex(p => p.socketId === socketId);
    if (index === -1) return;

    const player = table.players[index];
    table.players.splice(index, 1);
    logger.info({ tableId: table.id, tableName: table.name, playerName: player.name }, 'Player left table');
  }

  setReferee(table: Table, socketId: string, pin: string): boolean {
    if (table.pin !== pin) return false;

    const existingReferee = table.players.find(p => p.role === 'REFEREE');
    if (existingReferee && existingReferee.socketId !== socketId) {
      table.players = table.players.filter(p => p.socketId !== existingReferee.socketId);
      logger.info({ tableId: table.id, tableName: table.name, oldReferee: existingReferee.socketId, newReferee: socketId }, 'Replacing existing referee');
    }

    const player = table.players.find(p => p.socketId === socketId);
    if (player) {
      player.role = 'REFEREE';
    } else {
      table.players.push({
        socketId,
        name: 'Referee',
        role: 'REFEREE',
        joinedAt: Date.now()
      });
    }

    logger.info({ tableId: table.id, tableName: table.name, socketId }, 'Referee authenticated');
    return true;
  }

  isReferee(table: Table, socketId: string): boolean {
    const player = table.players.find(p => p.socketId === socketId);
    return player?.role === 'REFEREE';
  }

  getRefereeSocketId(table: Table): string | null {
    const referee = table.players.find(p => p.role === 'REFEREE');
    return referee?.socketId || null;
  }
}
