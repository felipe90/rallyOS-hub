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
import { Court, TournamentCourt, ClubCourt, isClubCourt, isTournamentCourt, CourtInfo, CourtInfoWithPin, Player, MatchConfig, MatchStateExtended, QRData, HubConfig, Sport, SPORT, CourtMode, COURT_MODE, CourtStatus, TournamentStatus, ClubStatus, CLUB_STATUS } from './types';
import { AllHistoryEntry, ClubKioskPayload, ClubKioskCourtInfo, ClubConfig } from '../../../shared/types';
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
import { PersistedCourt, PersistedClubCourt } from '../services/store/types';

export class CourtManager {
  private repository: CourtRepository;
  private playerService: PlayerService;
  private matchOrchestrator: MatchOrchestrator;
  private formatter: CourtFormatter;
  private pinService: PinService;
  private qrService: QRService;
  private stateStore?: StateStore;

  public onTableUpdate: (table: CourtInfo) => void = () => {};
  public onTournamentFinish: () => void = () => {};
  public onMatchEvent: (courtId: string, event: any) => void = () => {};
  public onClubSessionEnd: (courtId: string, elapsedMinutes: number, reason: string) => void = () => {};

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
  createCourt(name?: string): TournamentCourt {
    const courtNumber = this.repository.getNextTableNumber();
    const courtName = name ? sanitizeInput(name, 256) : `Cancha ${courtNumber}`;
    const pin = this.pinService.generatePin();
    const id = crypto.randomUUID();

    const court: TournamentCourt = {
      kind: 'tournament',
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

    court.sportRules.setCourtId(id, courtName);
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

  getAllCourts(): CourtInfo[] {
    return this.formatter.toPublicList(this.repository.getAll());
  }

  /**
   * Get all tournament-mode courts (filtered via isClubCourt).
   * Used for COURT_LIST events — club courts are excluded.
   */
  getAllTournamentCourts(): CourtInfo[] {
    return this.formatter.toPublicList(
      this.repository.getAll().filter(c => !isClubCourt(c)),
    );
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

  // ── Club Mode ──────────────────────────────────────────────────────

  /**
   * Create a club-mode court (mode='club') with clubStatus='AVAILABLE' and no PIN.
   * Club courts don't need a match PIN — they use session PINs on activation.
   */
  createClubCourt(name?: string): ClubCourt {
    const courtNumber = this.repository.getNextTableNumber();
    const courtName = name ? sanitizeInput(name, 256) : `Cancha ${courtNumber}`;
    const id = crypto.randomUUID();

    const court: ClubCourt = {
      kind: 'club',
      id,
      number: courtNumber,
      name: courtName,
      clubStatus: CLUB_STATUS.AVAILABLE,
      pin: '',
      sportRules: new MatchEngine(),
      playerNames: { a: '', b: '' },
      history: [],
      players: [],
      createdAt: Date.now(),
      featured: false,
      occupiedAt: null,
    };

    court.sportRules.setCourtId(id, courtName);
    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(id, event);
    });

    this.repository.create(court);
    logger.info({ courtId: id, courtName, mode: 'club' }, 'Club court created');
    this.notifyUpdate(court);

    return court;
  }

  /**
   * Delete a club-mode court. Only allowed when clubStatus is AVAILABLE.
   */
  deleteClubCourt(courtId: string): boolean {
    const court = this.repository.get(courtId);
    if (!court || !isClubCourt(court)) return false;
    if (court.clubStatus !== CLUB_STATUS.AVAILABLE) return false;

    const deleted = this.repository.delete(courtId);
    if (deleted) {
      logger.info({ courtId, courtName: court.name }, 'Club court deleted');
    }
    return deleted;
  }

  /**
   * Get all club-mode courts.
   */
  getClubCourts(): ClubCourt[] {
    return this.repository.getAll().filter(isClubCourt);
  }

  /**
   * Build ClubKioskPayload for the public kiosk display.
   * Filters to club-mode courts, maps each to ClubKioskCourtInfo using the
   * formatter for scores/names/winner, and populates pin only when RESERVED.
   * Returns empty courts array when no club courts exist.
   */
  getClubKioskPayload(clubConfig: ClubConfig | null): ClubKioskPayload {
    const clubCourts = this.repository.getAll().filter(isClubCourt);

    const courts: ClubKioskCourtInfo[] = clubCourts.map((c) => {
      const info = this.formatter.toPublicInfo(c);
      return {
        id: c.id,
        name: c.name,
        status: c.clubStatus,
        mode: COURT_MODE.CLUB,
        pin: c.clubStatus === CLUB_STATUS.RESERVED ? c.pin : undefined,
        playerNames: info.playerNames,
        currentScore: info.currentScore,
        winner: info.winner,
      };
    });

    return {
      clubName: clubConfig?.clubName ?? 'Club',
      courts,
    };
  }

  /**
   * Activate a club court: transitions clubStatus from AVAILABLE to RESERVED,
   * generates a 4-digit session PIN, and emits the update.
   */
  activateCourt(courtId: string): Court | null {
    const court = this.repository.get(courtId);
    if (!court || !isClubCourt(court)) return null;
    if (court.clubStatus !== CLUB_STATUS.AVAILABLE) return null;

    court.clubStatus = CLUB_STATUS.RESERVED;
    court.pin = this.pinService.generatePin();

    logger.info({ courtId, courtName: court.name, pin: court.pin }, 'Club court activated');
    this.notifyUpdate(court);

    return court;
  }

  /**
   * Deactivate a club court: transitions RESERVED → AVAILABLE,
   * invalidates the session PIN.
   */
  deactivateCourt(courtId: string): Court | null {
    const court = this.repository.get(courtId);
    if (!court || !isClubCourt(court)) return null;
    if (court.clubStatus !== CLUB_STATUS.RESERVED) return null;

    court.clubStatus = CLUB_STATUS.AVAILABLE;
    court.pin = '';

    logger.info({ courtId, courtName: court.name }, 'Club court deactivated');
    this.notifyUpdate(court);

    return court;
  }

  /**
   * Reset a club court: transitions FINISHED → AVAILABLE.
   */
  resetCourt(courtId: string): Court | null {
    const court = this.repository.get(courtId);
    if (!court || !isClubCourt(court)) return null;
    if (court.clubStatus !== CLUB_STATUS.FINISHED) return null;

    court.clubStatus = CLUB_STATUS.AVAILABLE;
    court.pin = '';
    court.occupiedAt = null;
    court.playerNames = { a: '', b: '' };
    court.players = [];

    // Reset match engine to fresh WAITING state
    this.matchOrchestrator.resetTable(court);

    logger.info({ courtId, courtName: court.name }, 'Club court reset to available');
    this.notifyUpdate(court);

    return court;
  }

  /**
   * Find a club court by matching its session PIN.
   * Only matches courts in RESERVED or OCCUPIED state (active sessions).
   * Returns undefined when no match is found.
   */
  findClubCourtByPin(pin: string): Court | undefined {
    return this.repository.getAll().find(
      (c) => isClubCourt(c) && c.pin === pin &&
            (c.clubStatus === CLUB_STATUS.RESERVED || c.clubStatus === CLUB_STATUS.OCCUPIED),
    );
  }

  /**
   * Occupy a club court: transitions RESERVED → OCCUPIED and auto-initializes
   * a match with default config based on the club's sport.
   *
   * For reconnection on already OCCUPIED courts, returns the current state
   * without re-initializing the match.
   *
   * Returns null when the court is not found, is not a club court, or has
   * an invalid clubStatus (not RESERVED or OCCUPIED).
   */
  occupyClubCourt(courtId: string, sport: Sport): { court: Court; matchState: MatchStateExtended } | null {
    const court = this.repository.get(courtId);
    if (!court || !isClubCourt(court)) return null;
    if (court.clubStatus !== CLUB_STATUS.RESERVED && court.clubStatus !== CLUB_STATUS.OCCUPIED) return null;

    // Reconnection on already OCCUPIED court — return current match state
    if (court.clubStatus === CLUB_STATUS.OCCUPIED) {
      const matchState = this.matchOrchestrator.getMatchState(court);
      if (!matchState) return null;
      return { court, matchState };
    }

    // Transition RESERVED → OCCUPIED
    court.clubStatus = CLUB_STATUS.OCCUPIED;
    court.occupiedAt = Date.now();

    // Set default player names
    court.playerNames = { a: 'Jugador 1', b: 'Jugador 2' };
    court.sportRules.setPlayerNames({ a: 'Jugador 1', b: 'Jugador 2' });

    // Build default match config based on sport
    const matchConfig: MatchConfig = sport === SPORT.PADEL
      ? {
          sport: SPORT.PADEL,
          bestOf: 1,
          gamesPerSet: 6,
          tiebreakPoints: 7,
          goldenPoint: false,
        } as MatchConfig
      : {
          sport: SPORT.TABLE_TENNIS,
          bestOf: 1,
          pointsPerSet: 11,
          minDifference: 2,
          handicapA: 0,
          handicapB: 0,
        } as MatchConfig;

    // Auto-init match via MatchOrchestrator
    const matchState = this.matchOrchestrator.startMatch(court, {
      ...matchConfig,
      playerNameA: 'Jugador 1',
      playerNameB: 'Jugador 2',
    });

    if (!matchState) {
      // Rollback on failure
      court.clubStatus = CLUB_STATUS.RESERVED;
      court.playerNames = { a: '', b: '' };
      return null;
    }

    // Rewire match engine callback — same pattern as startMatch(), regeneratePin(), etc.
    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(courtId, event);
    });

    this.notifyUpdate(court);
    return { court, matchState };
  }

  /**
   * End a club court session: validates OCCUPIED state, transitions to FINISHED,
   * clears PIN, computes elapsed minutes, fires onClubSessionEnd callback.
   *
   * @returns { elapsedMinutes } on success, null on failure.
   */
  endSession(courtId: string, reason: string): { elapsedMinutes: number } | null {
    const court = this.repository.get(courtId);
    if (!court || !isClubCourt(court)) return null;
    if (court.clubStatus !== CLUB_STATUS.OCCUPIED) return null;

    const now = Date.now();
    const elapsedMs = court.occupiedAt ? now - court.occupiedAt : 0;
    const elapsedMinutes = Math.max(1, Math.ceil(elapsedMs / 60000));

    court.clubStatus = CLUB_STATUS.FINISHED;
    court.pin = '';

    logger.info({ courtId, courtName: court.name, reason, elapsedMinutes }, 'Club court session ended');
    this.notifyUpdate(court);
    this.onClubSessionEnd(courtId, elapsedMinutes, reason);

    return { elapsedMinutes };
  }

  /**
   * Force-end a club court session: delegates to endSession('force').
   * Keeps backward-compatible return (Court | null) by looking up the court.
   */
  forceEndSession(courtId: string): Court | null {
    const result = this.endSession(courtId, 'force');
    if (!result) return null;
    return this.repository.get(courtId) ?? null;
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

  /**
   * Register a club player socket as referee — bypasses PIN validation
   * because club courts are self-refereed (the player IS the referee).
   * Only works for club-mode courts.
   *
   * @returns The old referee's socketId if one was displaced, null otherwise.
   */
  registerClubReferee(courtId: string, socketId: string): string | null {
    const court = this.repository.get(courtId);
    if (!court || !isClubCourt(court)) return null;

    const displaced = this.playerService.setRefereeDirect(court, socketId, 'Club Player');
    this.notifyUpdate(court);
    return displaced;
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

    // Auto-finish: if the match just ended on a club OCCUPIED court, end the session
    if (isClubCourt(court) && court.clubStatus === CLUB_STATUS.OCCUPIED) {
      const matchState = court.sportRules.getState();
      if (matchState.status === 'FINISHED') {
        this.endSession(courtId, 'auto');
      }
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
        courtId: court.id,
        courtName: court.name,
        status: isTournamentCourt(court) ? court.status : (isClubCourt(court) ? court.clubStatus : ''),
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
    court.sportRules.setCourtId(court.id, court.name);
    court.sportRules.setPlayerNames({ a: 'Player A', b: 'Player B' });

    // Rewire callback: MatchOrchestrator creates new matchEngine routing to undefined court.onMatchEvent
    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(courtId, event);
    });

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
  courtToInfo(court: Court): CourtInfo {
    return this.formatter.toPublicInfo(court);
  }

  getCourtWithPin(courtId: string): CourtInfoWithPin | null {
    const court = this.repository.get(courtId);
    if (!court) return null;
    return this.formatter.toInfoWithPin(court);
  }

  getAllCourtsWithPins(): CourtInfoWithPin[] {
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
   * Persist LIVE/FINISHED tournament courts and OCCUPIED/FINISHED club courts
   * to the state store in v3 format with separate arrays.
   * Tournament courts use `status` as discriminator; club courts use `clubStatus`.
   * Errors are caught and logged — the caller is never affected.
   */
  private autoSave(): void {
    try {
      const allCourts = this.repository.getAll();

      const tournamentCourts: PersistedCourt[] = allCourts
        .filter((c): c is TournamentCourt => isTournamentCourt(c) && (c.status === 'LIVE' || c.status === 'FINISHED'))
        .map((c) => this.toPersistedCourt(c));

      const clubCourts: PersistedClubCourt[] = allCourts
        .filter((c): c is ClubCourt => isClubCourt(c) && (c.clubStatus === 'OCCUPIED' || c.clubStatus === 'FINISHED'))
        .map((c) => this.toPersistedClubCourt(c));

      this.stateStore!.save(tournamentCourts, clubCourts);
    } catch (err) {
      logger.error({ err }, 'StateStore: auto-save failed');
    }
  }

  /**
   * Convert a runtime tournament Court into a serializable PersistedCourt.
   * Excludes runtime-only fields: MatchEngine instance, PlayerConnection.socketId,
   * and Socket.io callback references. Also excludes club-specific fields
   * (mode, clubStatus, occupiedAt).
   */
  private toPersistedCourt(court: TournamentCourt): PersistedCourt {
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
   * Convert a runtime club Court into a serializable PersistedClubCourt.
   * Excludes runtime-only fields (sportRules, players) and tournament-only
   * field (status). Includes club-specific clubStatus and occupiedAt.
   */
  private toPersistedClubCourt(court: ClubCourt): PersistedClubCourt {
    const state = court.sportRules.getState();
    const s = state as any;

    return {
      id: court.id,
      number: court.number,
      name: court.name,
      kind: 'club',
      clubStatus: court.clubStatus,
      occupiedAt: court.occupiedAt,
      pin: court.pin,
      playerNames: { ...court.playerNames },
      createdAt: court.createdAt,
      matchState: {
        config: { ...state.config },
        score: {
          sets: s.sets ?? { a: 0, b: 0 },
          currentSet: s.games ?? { a: 0, b: 0 },
          serving: s.serving ?? 'A',
        },
        swappedSides: state.swappedSides,
        midSetSwapped: state.midSetSwapped,
        setHistory: (s.setHistory || []).map((sh: any) => ({ ...sh })),
        status: state.status,
        winner: state.winner,
        sport: state.sport || SPORT.TABLE_TENNIS,
        history: (s.history || []).map((h: any) => ({
          ...h,
          pointsBefore: { ...h.pointsBefore },
          pointsAfter: { ...h.pointsAfter },
        })),
        ...(s.sport === SPORT.PADEL ? {
          padelPoints: s.padelPoints ?? { a: 0, b: 0 },
          isTiebreak: s.isTiebreak ?? false,
          tiebreakPoints: s.tiebreakPoints ?? { a: 0, b: 0 },
          goldenPoint: s.goldenPoint ?? false,
        } : {}),
      },
      config: null,
      history: court.history as unknown as Record<string, unknown>[],
    };
  }

  /**
   * Load state from disk and reconstruct both tournament and club courts.
   *
   * Reads persisted state via StateStore.load() (auto-migrated to v3 format),
   * reconstructs Court objects and MatchEngine instances via
   * MatchEngine.fromState(), and rewires Socket.io callbacks.
   *
   * Tournament courts are restored from `tournamentCourts[]` (LIVE/FINISHED),
   * club courts from `clubCourts[]` (OCCUPIED/FINISHED).
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
    if (!persisted) {
      return false;
    }

    const hasTournament = persisted.tournamentCourts && persisted.tournamentCourts.length > 0;
    const hasClub = persisted.clubCourts && persisted.clubCourts.length > 0;

    if (!hasTournament && !hasClub) {
      return false;
    }

    let restored = 0;

    // Restore tournament courts
    for (const pt of persisted.tournamentCourts) {
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

        engine.setCourtId(pt.id, pt.name);

        const court: TournamentCourt = {
          kind: 'tournament',
          id: pt.id,
          number: pt.number,
          name: pt.name,
          status: pt.status as TournamentStatus,
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
          'CourtManager: restored tournament court from state',
        );
      } catch (err) {
        logger.warn(
          { err, courtId: pt.id },
          'CourtManager.loadTournament: failed to restore tournament court, skipping',
        );
      }
    }

    // Restore club courts
    for (const pt of persisted.clubCourts) {
      if (pt.clubStatus !== 'OCCUPIED' && pt.clubStatus !== 'FINISHED') {
        continue;
      }

      try {
        const engine = MatchEngine.fromState({
          ...pt.matchState as any,
          tableId: pt.id,
          tableName: pt.name,
          playerNames: pt.playerNames,
          history: pt.matchState?.history || [],
          undoAvailable: (pt.matchState?.history || []).length > 0,
        } as MatchStateExtended);

        engine.setCourtId(pt.id, pt.name);

        const court: ClubCourt = {
          kind: 'club',
          id: pt.id,
          number: pt.number,
          name: pt.name,
          clubStatus: pt.clubStatus as ClubStatus,
          occupiedAt: pt.occupiedAt,
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
          { courtId: pt.id, courtName: pt.name, clubStatus: pt.clubStatus },
          'CourtManager: restored club court from state',
        );
      } catch (err) {
        logger.warn(
          { err, courtId: pt.id },
          'CourtManager.loadTournament: failed to restore club court, skipping',
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
