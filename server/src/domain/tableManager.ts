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
import { AllHistoryEntry } from '../../../shared/types';
import { logger } from '../utils/logger';
import { sanitizeInput } from '../utils/validation';
import { TableRepository } from '../services/table/TableRepository';
import { PlayerService } from '../services/table/PlayerService';
import { MatchOrchestrator } from '../services/table/MatchOrchestrator';
import { TableFormatter } from '../services/table/TableFormatter';
import { PinService } from '../services/security/PinService';
import { QRService } from '../services/qr/QRService';
import { StateStore } from '../services/store/StateStore';
import { PersistedTable } from '../services/store/types';

export class TableManager {
  private repository: TableRepository;
  private playerService: PlayerService;
  private matchOrchestrator: MatchOrchestrator;
  private formatter: TableFormatter;
  private pinService: PinService;
  private qrService: QRService;
  private stateStore?: StateStore;

  public onTableUpdate: (table: TableInfo) => void = () => {};
  public onTournamentFinish: () => void = () => {};
  public onMatchEvent: (tableId: string, event: any) => void = () => {};

  constructor(hubConfig: HubConfig, stateStore?: StateStore) {
    this.repository = new TableRepository();
    this.pinService = new PinService();
    this.playerService = new PlayerService(this.pinService);
    this.matchOrchestrator = new MatchOrchestrator();
    this.formatter = new TableFormatter();
    this.qrService = new QRService(hubConfig);
    this.stateStore = stateStore;
  }

  // Table CRUD
  createTable(name?: string): Table {
    const tableNumber = this.repository.getNextTableNumber();
    const tableName = name ? sanitizeInput(name, 256) : `Mesa ${tableNumber}`;
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
      if (this.stateStore) {
        this.autoSave();
      }
    }
    return deleted;
  }

  finishTournament(): void {
    const count = this.repository.getAll().length;
    this.repository.clear();
    if (this.stateStore) {
      this.stateStore.clear();
    }
    this.onTournamentFinish();
    logger.info({ deletedCount: count }, 'Tournament finished — all tables cleared');
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

    // Rewire callback: MatchOrchestrator may replace matchEngine routing to undefined table.onMatchEvent
    table.matchEngine.setEventCallback((event: any) => {
      this.onMatchEvent(tableId, event);
    });

    this.notifyUpdate(table);
  }

  startMatch(tableId: string, config?: Partial<MatchConfig> & { playerNameA?: string; playerNameB?: string }): MatchStateExtended | null {
    const table = this.repository.get(tableId);
    if (!table) {
      logger.warn({ tableId }, 'startMatch: table not found');
      return null;
    }

    const state = this.matchOrchestrator.startMatch(table, config);

    // Rewire match engine callback — MatchOrchestrator routes to table.onMatchEvent
    // which is never set. Route directly to tableManager.onMatchEvent instead.
    table.matchEngine.setEventCallback((event: any) => {
      this.onMatchEvent(tableId, event);
    });

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

    // Rewire callback: MatchOrchestrator creates new matchEngine routing to undefined table.onMatchEvent
    table.matchEngine.setEventCallback((event: any) => {
      this.onMatchEvent(tableId, event);
    });

    this.notifyUpdate(table);
  }

  getMatchState(tableId: string): MatchStateExtended | null {
    const table = this.repository.get(tableId);
    if (!table) return null;
    return this.matchOrchestrator.getMatchState(table);
  }

  // Aggregated history — ALL_HISTORY event
  getAllHistories(): AllHistoryEntry[] {
    const tables = this.repository.getAll();
    return tables.map((table) => {
      const state = this.matchOrchestrator.getMatchState(table);
      const history = state?.history ?? [];
      const playerNames = table.playerNames ?? { a: 'Player A', b: 'Player B' };

      // Extract handicap from table config if present
      const config = table.matchEngine?.getConfig?.();
      const handicap = config?.handicapA !== undefined || config?.handicapB !== undefined
        ? {
            ...(config?.handicapA !== undefined && { a: config.handicapA }),
            ...(config?.handicapB !== undefined && { b: config.handicapB }),
          }
        : undefined;

      return {
        tableId: table.id,
        tableName: table.name,
        status: table.status,
        playerNames,
        history,
        handicap,
      };
    });
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

    // Rewire callback: MatchOrchestrator creates new matchEngine routing to undefined table.onMatchEvent
    table.matchEngine.setEventCallback((event: any) => {
      this.onMatchEvent(tableId, event);
    });

    table.status = 'WAITING';

    logger.info({ tableId, tableName: table.name, oldRefereeId: oldReferee || 'none', newPin: table.pin }, 'Table reset with new PIN');
    // Only autoSave — skip notifyUpdate (which broadcasts TABLE_LIST without PINs).
    // The client gets the new PIN via PIN_REGENERATED + TABLE_LIST_WITH_PINS,
    // avoiding a race where TABLE_LIST overwrites TABLE_LIST_WITH_PINS state.
    if (this.stateStore) {
      this.autoSave();
    }

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

    // Auto-save to state store (fire-and-forget — errors logged but don't crash)
    if (this.stateStore) {
      this.autoSave();
    }
  }

  /**
   * Persist all LIVE and FINISHED tables to the state store.
   * Errors are caught and logged — the caller is never affected.
   */
  private autoSave(): void {
    try {
      const allTables = this.repository.getAll();
      const persisted: PersistedTable[] = allTables
        .filter((t) => t.status === 'LIVE' || t.status === 'FINISHED')
        .map((t) => this.toPersistedTable(t));
      this.stateStore!.save(persisted);
    } catch (err) {
      logger.error({ err }, 'StateStore: auto-save failed');
    }
  }

  /**
   * Convert a runtime Table into a serializable PersistedTable.
   * Excludes runtime-only fields: MatchEngine instance, PlayerConnection.socketId,
   * and Socket.io callback references.
   */
  private toPersistedTable(table: Table): PersistedTable {
    const state = table.matchEngine.getState();
    return {
      id: table.id,
      number: table.number,
      name: table.name,
      status: table.status,
      pin: table.pin,
      playerNames: { ...table.playerNames },
      createdAt: table.createdAt,
      matchState: {
        config: { ...state.config },
        score: JSON.parse(JSON.stringify(state.score)),
        swappedSides: state.swappedSides,
        midSetSwapped: state.midSetSwapped,
        setHistory: state.setHistory.map((s) => ({ ...s })),
        status: state.status,
        winner: state.winner,
        history: (state.history || []).map((h) => ({
          ...h,
          pointsBefore: { ...h.pointsBefore },
          pointsAfter: { ...h.pointsAfter },
        })),
      },
    };
  }

  /**
   * Load tournament state from disk and reconstruct tables.
   *
   * Reads persisted state via StateStore.load(), reconstructs Table objects
   * and MatchEngine instances via MatchEngine.fromState(), and rewires
   * Socket.io callbacks.
   *
   * Only tables with LIVE or FINISHED status are restored.
   * Corrupted entries are skipped with a warning.
   *
   * @returns true if at least one table was restored, false otherwise.
   */
  public loadTournament(): boolean {
    if (!this.stateStore) {
      logger.warn('TableManager.loadTournament: no StateStore configured');
      return false;
    }

    const persisted = this.stateStore.load();
    if (!persisted || !persisted.tables || persisted.tables.length === 0) {
      return false;
    }

    let restored = 0;

    for (const pt of persisted.tables) {
      // Only restore LIVE or FINISHED tables
      if (pt.status !== 'LIVE' && pt.status !== 'FINISHED') {
        continue;
      }

      try {
        const engine = MatchEngine.fromState({
          ...pt.matchState,
          tableId: pt.id,
          tableName: pt.name,
          playerNames: pt.playerNames,
          history: pt.matchState.history || [],
          undoAvailable: (pt.matchState.history || []).length > 0,
        });

        engine.setTableId(pt.id, pt.name);

        const table: Table = {
          id: pt.id,
          number: pt.number,
          name: pt.name,
          status: pt.status,
          pin: pt.pin,
          matchEngine: engine,
          playerNames: { ...pt.playerNames },
          history: [],
          players: [],
          createdAt: pt.createdAt,
        };

        // Wire callbacks so Socket.io events work after restoration
        engine.setEventCallback((event: any) => {
          this.onMatchEvent(pt.id, event);
        });

        this.repository.create(table);
        restored++;

        logger.info(
          { tableId: pt.id, tableName: pt.name, status: pt.status },
          'TableManager: restored table from state',
        );
      } catch (err) {
        logger.warn(
          { err, tableId: pt.id },
          'TableManager.loadTournament: failed to restore table, skipping',
        );
      }
    }

    if (restored > 0) {
      // Notify listeners about each restored table
      for (const table of this.repository.getAll()) {
        this.notifyUpdate(table);
      }
    }

    return restored > 0;
  }
}
