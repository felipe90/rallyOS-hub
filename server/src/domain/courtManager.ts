/**
 * CourtManager - Orchestrates tables, players, and matches
 *
 * Refactored to compose focused services:
 * - CourtRepository: CRUD operations
 * - PlayerService: Player management
 * - MatchOrchestrator: Match lifecycle
 * - CourtFormatter: Table transformations
 * - PinService: PIN generation
 * - QRService: QR data generation
 */

import crypto from 'crypto';
import { MatchEngine } from './matchEngine';
import { Court, TableInfo, TableInfoWithPin, Player, MatchConfig, MatchStateExtended, QRData, HubConfig, Sport, SPORT } from './types';
import { AllHistoryEntry } from '../../../shared/types';
import { logger } from '../utils/logger';
import { sanitizeInput } from '../utils/validation';
import { CourtRepository } from '../services/table/CourtRepository';
import { PlayerService } from '../services/table/PlayerService';
import { MatchOrchestrator } from '../services/table/MatchOrchestrator';
import { SportRegistry } from './sports/sport.registry';
import { CourtFormatter } from '../services/table/CourtFormatter';
import { PinService } from '../services/security/PinService';
import { QRService } from '../services/qr/QRService';
import { StateStore } from '../services/store/StateStore';
import { PersistedCourt } from '../services/store/types';

export class CourtManager {
  private repository: CourtRepository;
  private playerService: PlayerService;
  private matchOrchestrator: MatchOrchestrator;
  private formatter: CourtFormatter;
  private pinService: PinService;
  private qrService: QRService;
  private stateStore?: StateStore;

  public onTableUpdate: (table: TableInfo) => void = () => {};
  public onTournamentFinish: () => void = () => {};
  public onMatchEvent: (courtId: string, event: any) => void = () => {};

  constructor(hubConfig: HubConfig, stateStore?: StateStore) {
    this.repository = new CourtRepository();
    this.pinService = new PinService();
    this.playerService = new PlayerService(this.pinService);
    const registry = new SportRegistry();
    this.matchOrchestrator = new MatchOrchestrator(registry);
    this.formatter = new CourtFormatter();
    this.qrService = new QRService(hubConfig);
    this.stateStore = stateStore;
  }

  // Table CRUD
  createCourt(name?: string): Court {
    const courtNumber = this.repository.getNextTableNumber();
    const courtName = name ? sanitizeInput(name, 256) : `Cancha ${courtNumber}`;
    const pin = this.pinService.generatePin();
    const id = crypto.randomUUID();

    const court: Court = {
      id,
      number: courtNumber,
      name: courtName,
      status: 'WAITING',
      pin,
      sportRules: new MatchEngine(),
      playerNames: { a: 'Player A', b: 'Player B' },
      history: [],
      players: [],
      createdAt: Date.now(),
      featured: false,
    };

    court.sportRules.setTableId(id, courtName);
    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(id, event);
    });

    this.repository.create(court);
    logger.info({ courtId: id, courtName }, 'Court created');
    this.notifyUpdate(court);

    return court;
  }

  getCourt(courtId: string): Court | undefined {
    return this.repository.get(courtId);
  }

  getAllCourts(): TableInfo[] {
    return this.formatter.toPublicList(this.repository.getAll());
  }

  deleteCourt(courtId: string): boolean {
    const deleted = this.repository.delete(courtId);
    if (deleted) {
      logger.info({ courtId }, 'Court deleted');
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
    logger.info({ deletedCount: count }, 'Tournament finished — all courts cleared');
  }

  // Player management
  joinTable(courtId: string, socketId: string, name: string, pin?: string): boolean {
    const court = this.repository.get(courtId);
    if (!court) return false;

    const success = this.playerService.joinCourt(court, socketId, name, pin);
    if (success) {
      this.notifyUpdate(court);
    }
    return success;
  }

  leaveTable(courtId: string, socketId: string): void {
    const court = this.repository.get(courtId);
    if (!court) return;

    this.playerService.leaveCourt(court, socketId);
    this.notifyUpdate(court);
  }

  setReferee(courtId: string, socketId: string, pin: string): boolean {
    const court = this.repository.get(courtId);
    if (!court) return false;

    const success = this.playerService.setReferee(court, socketId, pin);
    if (success) {
      this.notifyUpdate(court);
    }
    return success;
  }

  isReferee(courtId: string, socketId: string): boolean {
    const court = this.repository.get(courtId);
    if (!court) return false;
    return this.playerService.isReferee(court, socketId);
  }

  getRefereeSocketId(courtId: string): string | null {
    const court = this.repository.get(courtId);
    if (!court) return null;
    return this.playerService.getRefereeSocketId(court);
  }

  // Match orchestration
  configureMatch(courtId: string, config: { playerNames?: { a: string; b: string }; matchConfig?: MatchConfig }): void {
    const court = this.repository.get(courtId);
    if (!court) return;

    this.matchOrchestrator.configureMatch(court, config);

    // Rewire callback: MatchOrchestrator may replace matchEngine routing to undefined court.onMatchEvent
    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(courtId, event);
    });

    this.notifyUpdate(court);
  }

  startMatch(courtId: string, config?: Partial<MatchConfig> & { playerNameA?: string; playerNameB?: string }): MatchStateExtended | null {
    const court = this.repository.get(courtId);
    if (!court) {
      logger.warn({ courtId }, 'startMatch: court not found');
      return null;
    }

    const state = this.matchOrchestrator.startMatch(court, config);

    // Rewire match engine callback — MatchOrchestrator routes to court.onMatchEvent
    // which is never set. Route directly to courtManager.onMatchEvent instead.
    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(courtId, event);
    });

    this.notifyUpdate(court);
    return state;
  }

  recordPoint(courtId: string, player: Player): MatchStateExtended | null {
    const court = this.repository.get(courtId);
    if (!court) return null;

    const state = this.matchOrchestrator.recordPoint(court, player);
    if (state) {
      this.notifyUpdate(court);
    }
    return state;
  }

  subtractPoint(courtId: string, player: Player): MatchStateExtended | null {
    const court = this.repository.get(courtId);
    if (!court) return null;

    const state = this.matchOrchestrator.subtractPoint(court, player);
    if (state) {
      this.notifyUpdate(court);
    }
    return state;
  }

  undoLast(courtId: string): MatchStateExtended | null {
    const court = this.repository.get(courtId);
    if (!court) return null;

    const state = this.matchOrchestrator.undoLast(court);
    if (state) {
      this.notifyUpdate(court);
    }
    return state;
  }

  setServer(courtId: string, player: Player): MatchStateExtended | null {
    const court = this.repository.get(courtId);
    if (!court) return null;

    const state = this.matchOrchestrator.setServer(court, player);
    if (state) {
      this.notifyUpdate(court);
    }
    return state;
  }

  swapSides(courtId: string): MatchStateExtended | null {
    const court = this.repository.get(courtId);
    if (!court) return null;

    const state = this.matchOrchestrator.swapSides(court);
    if (state) {
      this.notifyUpdate(court);
    }
    return state;
  }

  resetTable(courtId: string, config?: MatchConfig): void {
    const court = this.repository.get(courtId);
    if (!court) return;

    this.matchOrchestrator.resetTable(court, config);

    // Rewire callback: MatchOrchestrator creates new matchEngine routing to undefined court.onMatchEvent
    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(courtId, event);
    });

    this.notifyUpdate(court);
  }

  getMatchState(courtId: string): MatchStateExtended | null {
    const court = this.repository.get(courtId);
    if (!court) return null;
    return this.matchOrchestrator.getMatchState(court);
  }

  // Aggregated history — ALL_HISTORY event
  getAllHistories(): AllHistoryEntry[] {
    const courts = this.repository.getAll();
    return courts.map((court) => {
      const state = this.matchOrchestrator.getMatchState(court);
      const history = state?.history ?? [];
      const playerNames = court.playerNames ?? { a: 'Player A', b: 'Player B' };

      // Extract handicap from court config if present (TT only)
      const cfg = court.sportRules?.getConfig?.();
      const cfgAny = cfg as any;
      const hasHandicap = cfg && cfg.sport === SPORT.TABLE_TENNIS && (cfgAny.handicapA !== undefined || cfgAny.handicapB !== undefined);
      const handicap = hasHandicap
        ? {
            ...(cfgAny.handicapA !== undefined && { a: cfgAny.handicapA }),
            ...(cfgAny.handicapB !== undefined && { b: cfgAny.handicapB }),
          }
        : undefined;

      return {
        tableId: court.id,
        tableName: court.name,
        status: court.status,
        playerNames,
        history,
        handicap,
      };
    });
  }

  // PIN management
  regeneratePin(courtId: string): string | null {
    const court = this.repository.get(courtId);
    if (!court) return null;

    const oldReferee = this.playerService.getRefereeSocketId(court);

    court.pin = this.pinService.generatePin();
    court.players = [];
    court.playerNames = { a: 'Player A', b: 'Player B' };
    this.matchOrchestrator.resetTable(court);
    court.sportRules.setTableId(court.id, court.name);
    court.sportRules.setPlayerNames({ a: 'Player A', b: 'Player B' });

    // Rewire callback: MatchOrchestrator creates new matchEngine routing to undefined court.onMatchEvent
    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(courtId, event);
    });

    court.status = 'WAITING';

    logger.info({ courtId, courtName: court.name, oldRefereeId: oldReferee || 'none', newPin: court.pin }, 'Court reset with new PIN');
    // Only autoSave — skip notifyUpdate (which broadcasts TABLE_LIST without PINs).
    // The client gets the new PIN via PIN_REGENERATED + TABLE_LIST_WITH_PINS,
    // avoiding a race where TABLE_LIST overwrites TABLE_LIST_WITH_PINS state.
    if (this.stateStore) {
      this.autoSave();
    }

    return court.pin;
  }

  // QR
  generateQRData(courtId: string): QRData | null {
    const court = this.repository.get(courtId);
    if (!court) return null;
    return this.qrService.generateQRData(court);
  }

  // Formatting
  courtToInfo(court: Court): TableInfo {
    return this.formatter.toPublicInfo(court);
  }

  getCourtWithPin(courtId: string): TableInfoWithPin | null {
    const court = this.repository.get(courtId);
    if (!court) return null;
    return this.formatter.toInfoWithPin(court);
  }

  getAllCourtsWithPins(): TableInfoWithPin[] {
    return this.formatter.toListWithPins(this.repository.getAll());
  }

  // Private
  private notifyUpdate(court: Court): void {
    if (this.onTableUpdate) {
      this.onTableUpdate(this.formatter.toPublicInfo(court));
    }

    // Auto-save to state store (fire-and-forget — errors logged but don't crash)
    if (this.stateStore) {
      this.autoSave();
    }
  }

  /**
   * Persist all LIVE and FINISHED courts to the state store.
   * Errors are caught and logged — the caller is never affected.
   */
  private autoSave(): void {
    try {
      const allCourts = this.repository.getAll();
      const persisted: PersistedCourt[] = allCourts
        .filter((c) => c.status === 'LIVE' || c.status === 'FINISHED')
        .map((c) => this.toPersistedCourt(c));
      this.stateStore!.save(persisted);
    } catch (err) {
      logger.error({ err }, 'StateStore: auto-save failed');
    }
  }

  /**
   * Convert a runtime Court into a serializable PersistedCourt.
   * Excludes runtime-only fields: MatchEngine instance, PlayerConnection.socketId,
   * and Socket.io callback references.
   */
  private toPersistedCourt(court: Court): PersistedCourt {
    const state = court.sportRules.getState();
    const isPadel = state.sport === SPORT.PADEL;
    const s = state as any;

    return {
      id: court.id,
      number: court.number,
      name: court.name,
      status: court.status,
      pin: court.pin,
      playerNames: { ...court.playerNames },
      createdAt: court.createdAt,
      matchState: {
        config: { ...state.config },
        score: isPadel
          ? { sets: s.sets ?? { a: 0, b: 0 }, currentSet: s.games ?? { a: 0, b: 0 }, serving: s.serving ?? 'A' }
          : JSON.parse(JSON.stringify(s.score ?? { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' })),
        swappedSides: state.swappedSides,
        midSetSwapped: state.midSetSwapped,
        setHistory: (s.setHistory || []).map((s: any) => ({ ...s })),
        status: state.status,
        winner: state.winner,
        sport: state.sport || SPORT.TABLE_TENNIS,
        history: (s.history || []).map((h: any) => ({
          ...h,
          pointsBefore: { ...h.pointsBefore },
          pointsAfter: { ...h.pointsAfter },
        })),
        ...(isPadel ? {
          padelPoints: s.padelPoints ?? { a: 0, b: 0 },
          isTiebreak: s.isTiebreak ?? false,
          tiebreakPoints: s.tiebreakPoints ?? { a: 0, b: 0 },
          goldenPoint: s.goldenPoint ?? false,
        } : {}),
      },
    };
  }

  /**
   * Load tournament state from disk and reconstruct courts.
   *
   * Reads persisted state via StateStore.load(), reconstructs Court objects
   * and MatchEngine instances via MatchEngine.fromState(), and rewires
   * Socket.io callbacks.
   *
   * Only courts with LIVE or FINISHED status are restored.
   * Corrupted entries are skipped with a warning.
   *
   * @returns true if at least one court was restored, false otherwise.
   */
  public loadTournament(): boolean {
    if (!this.stateStore) {
      logger.warn('CourtManager.loadTournament: no StateStore configured');
      return false;
    }

    const persisted = this.stateStore.load();
    if (!persisted || !persisted.tables || persisted.tables.length === 0) {
      return false;
    }

    let restored = 0;

    for (const pt of persisted.tables) {
      // Only restore LIVE or FINISHED courts
      if (pt.status !== 'LIVE' && pt.status !== 'FINISHED') {
        continue;
      }

      try {
        const engine = MatchEngine.fromState({
          ...pt.matchState as any,
          tableId: pt.id,
          tableName: pt.name,
          playerNames: pt.playerNames,
          history: pt.matchState.history || [],
          undoAvailable: (pt.matchState.history || []).length > 0,
        } as MatchStateExtended);

        engine.setTableId(pt.id, pt.name);

    const court: Court = {
          id: pt.id,
          number: pt.number,
          name: pt.name,
          status: pt.status,
          pin: pt.pin,
          sportRules: engine,
          playerNames: { ...pt.playerNames },
          history: [],
          players: [],
          createdAt: pt.createdAt,
          featured: false,
        };

        // Wire callbacks so Socket.io events work after restoration
        engine.setEventCallback((event: any) => {
          this.onMatchEvent(pt.id, event);
        });

        this.repository.create(court);
        restored++;

        logger.info(
          { courtId: pt.id, courtName: pt.name, status: pt.status },
          'CourtManager: restored court from state',
        );
      } catch (err) {
        logger.warn(
          { err, courtId: pt.id },
          'CourtManager.loadTournament: failed to restore court, skipping',
        );
      }
    }

    if (restored > 0) {
      // Notify listeners about each restored court
      for (const court of this.repository.getAll()) {
        this.notifyUpdate(court);
      }
    }

    return restored > 0;
  }
}
/** @deprecated Use CourtManager instead */
export type TableManager = CourtManager;
/** @deprecated Use CourtManager instead */
export const TableManager = CourtManager;
