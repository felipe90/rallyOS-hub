/**
 * TableManager - Orchestrates tables, players, and matches
 *
 * Refactored to compose focused services:
 * - TableRepository: CRUD operations
 * - PlayerService: Player management
 * - MatchOrchestrator: Match lifecycle
 * - TableFormatter: Table transformations
 * - PinService: PIN generation
 * - QRService: QR data generation
 */

import crypto from 'crypto';
import { MatchEngine } from './matchEngine';
import { Table, TableInfo, TableInfoWithPin, Player, MatchConfig, MatchStateExtended, QRData, HubConfig } from './types';
import { logger } from './utils/logger';
import { TableRepository } from './services/table/TableRepository';
import { PlayerService } from './services/table/PlayerService';
import { MatchOrchestrator } from './services/table/MatchOrchestrator';
import { TableFormatter } from './services/table/TableFormatter';
import { PinService } from './services/security/PinService';
import { QRService } from './services/qr/QRService';

export class TableManager {
  private repository: TableRepository;
  private playerService: PlayerService;
  private matchOrchestrator: MatchOrchestrator;
  private formatter: TableFormatter;
  private pinService: PinService;
  private qrService: QRService;

  public onTableUpdate: (table: TableInfo) => void = () => {};
  public onMatchEvent: (tableId: string, event: any) => void = () => {};

  constructor(hubConfig: HubConfig) {
    this.repository = new TableRepository();
    this.playerService = new PlayerService();
    this.matchOrchestrator = new MatchOrchestrator();
    this.formatter = new TableFormatter();
    this.pinService = new PinService();
    this.qrService = new QRService(hubConfig);
  }

  // Table CRUD
  createTable(name?: string): Table {
    const tableNumber = this.repository.getNextTableNumber();
    const tableName = name || `Mesa ${tableNumber}`;
    const pin = this.pinService.generatePin();
    const id = crypto.randomUUID();

    const table: Table = {
      id,
      number: tableNumber,
      name: tableName,
      status: 'WAITING',
      pin,
      matchEngine: new MatchEngine(),
      playerNames: { a: 'Player A', b: 'Player B' },
      history: [],
      players: [],
      createdAt: Date.now()
    };

    table.matchEngine.setTableId(id, tableName);
    table.matchEngine.setEventCallback((event: any) => {
      this.onMatchEvent(id, event);
    });

    this.repository.create(table);
    logger.info({ tableId: id, tableName }, 'Table created');
    this.notifyUpdate(table);

    return table;
  }

  getTable(tableId: string): Table | undefined {
    return this.repository.get(tableId);
  }

  getAllTables(): TableInfo[] {
    return this.formatter.toPublicList(this.repository.getAll());
  }

  deleteTable(tableId: string): boolean {
    const deleted = this.repository.delete(tableId);
    if (deleted) {
      logger.info({ tableId }, 'Table deleted');
    }
    return deleted;
  }

  // Player management
  joinTable(tableId: string, socketId: string, name: string, pin?: string): boolean {
    const table = this.repository.get(tableId);
    if (!table) return false;

    const success = this.playerService.joinTable(table, socketId, name, pin);
    if (success) {
      this.notifyUpdate(table);
    }
    return success;
  }

  leaveTable(tableId: string, socketId: string): void {
    const table = this.repository.get(tableId);
    if (!table) return;

    this.playerService.leaveTable(table, socketId);
    this.notifyUpdate(table);
  }

  setReferee(tableId: string, socketId: string, pin: string): boolean {
    const table = this.repository.get(tableId);
    if (!table) return false;

    const success = this.playerService.setReferee(table, socketId, pin);
    if (success) {
      this.notifyUpdate(table);
    }
    return success;
  }

  isReferee(tableId: string, socketId: string): boolean {
    const table = this.repository.get(tableId);
    if (!table) return false;
    return this.playerService.isReferee(table, socketId);
  }

  getRefereeSocketId(tableId: string): string | null {
    const table = this.repository.get(tableId);
    if (!table) return null;
    return this.playerService.getRefereeSocketId(table);
  }

  // Match orchestration
  configureMatch(tableId: string, config: { playerNames?: { a: string; b: string }; matchConfig?: MatchConfig }): void {
    const table = this.repository.get(tableId);
    if (!table) return;

    this.matchOrchestrator.configureMatch(table, config);
    this.notifyUpdate(table);
  }

  startMatch(tableId: string, config?: Partial<MatchConfig> & { playerNameA?: string; playerNameB?: string }): MatchStateExtended | null {
    const table = this.repository.get(tableId);
    if (!table) {
      logger.warn({ tableId }, 'startMatch: table not found');
      return null;
    }

    const state = this.matchOrchestrator.startMatch(table, config);
    this.notifyUpdate(table);
    return state;
  }

  recordPoint(tableId: string, player: Player): MatchStateExtended | null {
    const table = this.repository.get(tableId);
    if (!table) return null;

    const state = this.matchOrchestrator.recordPoint(table, player);
    if (state) {
      this.notifyUpdate(table);
    }
    return state;
  }

  subtractPoint(tableId: string, player: Player): MatchStateExtended | null {
    const table = this.repository.get(tableId);
    if (!table) return null;

    const state = this.matchOrchestrator.subtractPoint(table, player);
    if (state) {
      this.notifyUpdate(table);
    }
    return state;
  }

  undoLast(tableId: string): MatchStateExtended | null {
    const table = this.repository.get(tableId);
    if (!table) return null;

    const state = this.matchOrchestrator.undoLast(table);
    if (state) {
      this.notifyUpdate(table);
    }
    return state;
  }

  setServer(tableId: string, player: Player): MatchStateExtended | null {
    const table = this.repository.get(tableId);
    if (!table) return null;

    const state = this.matchOrchestrator.setServer(table, player);
    if (state) {
      this.notifyUpdate(table);
    }
    return state;
  }

  swapSides(tableId: string): MatchStateExtended | null {
    const table = this.repository.get(tableId);
    if (!table) return null;

    const state = this.matchOrchestrator.swapSides(table);
    if (state) {
      this.notifyUpdate(table);
    }
    return state;
  }

  resetTable(tableId: string, config?: MatchConfig): void {
    const table = this.repository.get(tableId);
    if (!table) return;

    this.matchOrchestrator.resetTable(table, config);
    this.notifyUpdate(table);
  }

  getMatchState(tableId: string): MatchStateExtended | null {
    const table = this.repository.get(tableId);
    if (!table) return null;
    return this.matchOrchestrator.getMatchState(table);
  }

  // PIN management
  regeneratePin(tableId: string): string | null {
    const table = this.repository.get(tableId);
    if (!table) return null;

    const oldReferee = this.playerService.getRefereeSocketId(table);

    table.pin = this.pinService.generatePin();
    table.players = [];
    table.playerNames = { a: 'Player A', b: 'Player B' };
    this.matchOrchestrator.resetTable(table);
    table.matchEngine.setTableId(table.id, table.name);
    table.matchEngine.setPlayerNames({ a: 'Player A', b: 'Player B' });
    table.status = 'WAITING';

    logger.info({ tableId, tableName: table.name, oldRefereeId: oldReferee || 'none', newPin: table.pin }, 'Table reset with new PIN');
    this.notifyUpdate(table);

    return table.pin;
  }

  // QR
  generateQRData(tableId: string): QRData | null {
    const table = this.repository.get(tableId);
    if (!table) return null;
    return this.qrService.generateQRData(table);
  }

  // Formatting
  tableToInfo(table: Table): TableInfo {
    return this.formatter.toPublicInfo(table);
  }

  getTableWithPin(tableId: string): TableInfoWithPin | null {
    const table = this.repository.get(tableId);
    if (!table) return null;
    return this.formatter.toInfoWithPin(table);
  }

  getAllTablesWithPins(): TableInfoWithPin[] {
    return this.formatter.toListWithPins(this.repository.getAll());
  }

  // Private
  private notifyUpdate(table: Table): void {
    if (this.onTableUpdate) {
      this.onTableUpdate(this.formatter.toPublicInfo(table));
    }
  }
}
