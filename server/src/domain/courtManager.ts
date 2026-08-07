/**
 * CourtManager - Orchestrates courts, players, and matches
 *
 * Slice-5 bridge reversal (admin-court-inventory): operates on the single
 * `RuntimeCourt` type (the legacy Court union is removed). Existence is
 * admin-only via InventoryManager; flow behavior is delegated to the
 * FlowModeRegistry rule engine; availability is the pure derived function
 * availabilityOf(record, flow, binding) — never stored.
 */

import crypto from 'crypto';
import { MatchEngine, MAX_HISTORY_LENGTH } from './matchEngine';
import {
  RuntimeCourt, isClubFlowCourt, CourtInfo, CourtInfoWithPin, Player, MatchConfig,
  MatchStateExtended, QRData, Sport, SPORT, COURT_MODE, TournamentStatus, ClubStatus,
  CLUB_STATUS, SessionMode, SESSION_MODE, FlowModeKey, FlowSlot,
} from './types';
import { AllHistoryEntry, ClubKioskPayload, ClubKioskCourtInfo, ClubConfig, INVENTORY_STATUS, AVAILABILITY } from '../../../shared/types';
import type { Availability, CourtRecord, BracketMatch, TournamentBracket } from '../../../shared/types';
import { logger } from '../utils/logger';
import { sanitizeInput } from '../utils/validation';
import type { PersistedFlowSession, PersistedMatchState, PersistedStateV4 } from './ports/persistence-types';
import { PERSISTENCE_VERSION } from './ports/persistence-types';
import type { ICourtRepository, IPlayerService, IMatchOrchestrator, ICourtPersistence, ICourtFormatter, IPinService, IQRService } from './ports';
import { CourtNumberCounter } from './inventory/CourtNumberCounter';
import type { InventoryManager } from './inventory/InventoryManager';
import { availabilityOf as deriveAvailability } from './flows/FlowModeContract';
import type { FlowModeContract, FlowContext } from './flows/FlowModeContract';
import { FlowModeRegistry } from './flows/FlowModeRegistry';
import { registerDefaultFlows } from './flows';

/**
 * Minimal catalog view CourtManager needs for the persist/restore axis split
 * (INV-4): ghost-drop restore consults the admin inventory — a persisted flow
 * whose courtId has NO catalog record is dropped (no ghost sessions), and
 * getPublicCourtList (D11) reads the ACTIVE records.
 * Satisfied structurally by InventoryManager.get()/list().
 */
export type CourtCatalog = Pick<InventoryManager, 'get' | 'list'>;

/**
 * Single-writer persistence coordinator seam (PERS-4, slice 6). The domain
 * depends on this narrow surface; `PersistenceCoordinator` satisfies it
 * structurally. Writers mutate the shared in-memory snapshot and flush the
 * FULL document — no second writer on the state file (R2 fixed).
 * Satisfied structurally by PersistenceCoordinator (services/store).
 */
export interface StateCoordinator {
  mutate(fn: (s: PersistedStateV4) => void): void;
  flush(): void;
  /** Read the persisted bracket (null when absent/cleared). Used by
   *  restoreState to re-materialize bracket-assigned WAITING courts. */
  getBracket(): TournamentBracket | null;
}

/**
 * Dependency container for CourtManager.
 * All infrastructure dependencies are injected at construction —
 * no inline `new` instantiations.
 */
export interface CourtManagerDeps {
  repository: ICourtRepository;
  playerService: IPlayerService;
  matchOrchestrator: IMatchOrchestrator;
  formatter: ICourtFormatter;
  pinService: IPinService;
  qrService: IQRService;
  persistence?: ICourtPersistence;
  /**
   * PERS-4 — the single-writer persistence coordinator. When present,
   * persistState() mutates the shared in-memory snapshot (liveSessions) and
   * flushes the FULL document; the bracket (written by BracketHandler into
   * the same snapshot) rides along and is never clobbered (R2 fixed). When
   * absent (legacy test wiring), persistState() falls back to writing the
   * liveSessions document through `persistence` directly.
   */
  coordinator?: StateCoordinator;
  /**
   * FMR-1 — the flow rule engine. Each flow mode (club/tournament, future
   * 'clase') registers one contract; CourtManager delegates end/forceEnd/
   * start to `registry.get(flow.mode)` and NEVER branches on sessionMode
   * inline. Defaults to the built-in club + tournament contracts
   * (registerDefaultFlows).
   */
  registry?: FlowModeRegistry;
  /**
   * INV-4 — catalog view for the persist/restore axis split + D11 public
   * list. When present, restoreState() drops any persisted flow whose
   * courtId has no catalog record (no ghost sessions). Optional so
   * pre-slice-2 consumers (tests, boot without inventory) keep the legacy
   * restore behavior.
   */
  inventory?: CourtCatalog;
  /**
   * FMR-3/AFE-3 — resolves the club's cost config so the club flow contract
   * SETTLES the real cost (ceil(elapsedMinutes × costPerMinute)). Defaults to
   * null (cost 0) when absent.
   */
  resolveClubConfig?: () => { costPerMinute?: number; currency?: string } | null;
  /**
   * MP-1 — resolves the club's configured sport so NEW courts get
   * sport-aware default names ("Mesa N" for table tennis, "Cancha N" for
   * padel). Optional: defaults to table tennis so callers that pass no
   * resolver (e.g. tests with explicit names) are unaffected.
   */
  resolveCourtSport?: () => Sport;
  /**
   * INV-3 — monotonic court numbering. Replaces the removed
   * `repository.getNextTableNumber()`. Defaults to a counter seeded from the
   * repository's current courts so existing tests/consumers are unaffected.
   */
  counter?: CourtNumberCounter;
}

export class CourtManager {
  private repository: ICourtRepository;
  private playerService: IPlayerService;
  private matchOrchestrator: IMatchOrchestrator;
  private formatter: ICourtFormatter;
  private pinService: IPinService;
  private qrService: IQRService;
  private stateStore?: ICourtPersistence;
  private coordinator?: StateCoordinator;
  private registry: FlowModeRegistry;
  private inventory?: CourtCatalog;
  private resolveClubConfig: () => { costPerMinute?: number; currency?: string } | null;
  private resolveCourtSport: () => Sport;
  private counter: CourtNumberCounter;

  /**
   * Trailing debounce for auto-persist (P1). Rapid point bursts coalesce into
   * a single disk write instead of one writeFileSync per point. The write
   * itself stays synchronous + atomic inside persistState().
   */
  private readonly persistDebounceMs = 600;
  private persistTimer: NodeJS.Timeout | null = null;

  public onTableUpdate: (table: CourtInfo) => void = () => {};
  public onTournamentFinish: () => void = () => {};
  public onMatchEvent: (courtId: string, event: any) => void = () => {};
  public onClubSessionEnd: (courtId: string, elapsedMinutes: number, elapsedSeconds: number, reason: string) => void = () => {};

  constructor(deps: CourtManagerDeps) {
    this.repository = deps.repository;
    this.pinService = deps.pinService;
    this.playerService = deps.playerService;
    this.matchOrchestrator = deps.matchOrchestrator;
    this.formatter = deps.formatter;
    this.qrService = deps.qrService;
    this.stateStore = deps.persistence;
    this.coordinator = deps.coordinator;
    this.registry = deps.registry ?? registerDefaultFlows();
    this.inventory = deps.inventory;
    this.resolveClubConfig = deps.resolveClubConfig ?? (() => null);
    this.resolveCourtSport = deps.resolveCourtSport ?? (() => SPORT.TABLE_TENNIS);
    this.counter = deps.counter ?? new CourtNumberCounter(this.repository.getAll());
  }

  // ── Test-support constructors (DEPRECATED — not wired to any socket event) ──
  //
  // Slice 5: existence is admin-only via InventoryManager (INVENTORY_*); the
  // CREATE_COURT / CLUB_CREATE_COURT events are removed. These constructors
  // remain ONLY so the pre-slice-5 unit suites (courtManager.test,
  // ClubPlayerHandler.test, MatchEventHandler.test, ...) can build a runtime
  // court directly. They synthesize a catalog record (courtId = generated id,
  // ACTIVE) so the runtime court is always catalog-backed (no ghost).

  /**
   * @deprecated Test-support only — tournament-oriented runtime court.
   * Production existence comes from the admin inventory (INVENTORY_ADD).
   */
  createCourt(name?: string): RuntimeCourt {
    const courtNumber = this.counter.next();
    const courtName = name ? sanitizeInput(name, 256) : this.defaultCourtName(courtNumber);
    const pin = this.pinService.generatePin();
    const id = crypto.randomUUID();

    const court = this.buildRuntimeCourt({
      courtId: id,
      number: courtNumber,
      name: courtName,
      mode: 'tournament',
      status: 'WAITING',
      clubStatus: CLUB_STATUS.AVAILABLE,
      pin,
      playerNames: { a: 'Player A', b: 'Player B' },
    });

    this.repository.create(court);
    logger.info({ courtId: id, courtName }, 'Court created (test-support)');
    this.notifyUpdate(court);

    return court;
  }

  /**
   * @deprecated Test-support only — club-oriented runtime court.
   * Production existence comes from the admin inventory (INVENTORY_ADD).
   */
  createClubCourt(name?: string): RuntimeCourt {
    const courtNumber = this.counter.next();
    const courtName = name ? sanitizeInput(name, 256) : this.defaultCourtName(courtNumber);
    const id = crypto.randomUUID();

    const court = this.buildRuntimeCourt({
      courtId: id,
      number: courtNumber,
      name: courtName,
      mode: 'club',
      status: 'WAITING',
      clubStatus: CLUB_STATUS.AVAILABLE,
      pin: '',
      playerNames: { a: '', b: '' },
    });

    this.repository.create(court);
    logger.info({ courtId: id, courtName, mode: 'club' }, 'Club court created (test-support)');
    this.notifyUpdate(court);

    return court;
  }

  /**
   * Materialize a RUNTIME club court from a catalog record (slice 4.4 — closes
   * the slice-3 catalog/runtime gap). The runtime court SHARES the catalog
   * identity (E11 — one physical court): id = record.courtId, name/number from
   * the record. The admin's first club-flow action on an inventory court
   * (activate/occupy) reaches the runtime/kiosk this way. State AVAILABLE —
   * the caller then activates/occupies as usual.
   */
  materializeClubCourtFromInventory(record: CourtRecord): RuntimeCourt {
    const court = this.buildRuntimeCourt({
      courtId: record.courtId,
      number: record.number,
      name: record.name,
      mode: 'club',
      status: 'WAITING',
      clubStatus: CLUB_STATUS.AVAILABLE,
      pin: '',
      playerNames: { a: '', b: '' },
      record,
    });

    this.repository.create(court);
    logger.info({ courtId: record.courtId, courtName: record.name, mode: 'club' }, 'Club court materialized from inventory');
    this.notifyUpdate(court);

    return court;
  }

  /**
   * Slice 5 — guarantee a RUNTIME tournament court exists for the bracket
   * referee-play path. When the target is an inventory-ACTIVE catalog court
   * with no runtime entry, it is materialized (shared identity — E11) so the
   * court + PIN exist for the referee after the owner SELECTs it. Non-ACTIVE /
   * unknown courts are NOT materialized. Returns true when a runtime court
   * exists after the call.
   */
  ensureRuntimeTournamentCourt(courtId: string): boolean {
    if (this.repository.get(courtId)) return true;
    const record = this.inventory?.get(courtId);
    if (!record || record.inventoryStatus !== INVENTORY_STATUS.ACTIVE) return false;
    this.materializeTournamentCourtFromInventory(record);
    return true;
  }

  /**
   * Materialize a RUNTIME tournament court from a catalog record (slice 5 —
   * completes the referee-play path). The bracket SELECT binds a match to an
   * inventory courtId; when the referee STARTS the match on that courtId and
   * no runtime entry exists yet, the court is materialized here (shared
   * identity — E11). State WAITING; `startMatch` then sets flow tournament
   * LIVE. Requires the record to be inventory-ACTIVE (no ghost courts).
   */
  materializeTournamentCourtFromInventory(record: CourtRecord): RuntimeCourt {
    const court = this.buildRuntimeCourt({
      courtId: record.courtId,
      number: record.number,
      name: record.name,
      mode: 'tournament',
      status: 'WAITING',
      clubStatus: CLUB_STATUS.AVAILABLE,
      pin: this.pinService.generatePin(),
      playerNames: { a: 'Player A', b: 'Player B' },
      record,
    });

    this.repository.create(court);
    logger.info({ courtId: record.courtId, courtName: record.name, mode: 'tournament' }, 'Tournament court materialized from inventory');
    this.notifyUpdate(court);

    return court;
  }

  getCourt(courtId: string): RuntimeCourt | undefined {
    return this.repository.get(courtId);
  }

  getAllCourts(): CourtInfo[] {
    return this.formatter.toPublicList(this.repository.getAll());
  }

  /**
   * Get all tournament-oriented courts (mode-derived — D1/E11).
   * Used for COURT_LIST events and the legacy BracketHandler fallback.
   */
  getAllTournamentCourts(): CourtInfo[] {
    return this.formatter.toPublicList(
      this.repository.getAll().filter(c => c.mode === 'tournament'),
    );
  }

  /**
   * D11 — the public court list is the ACTIVE inventory catalog (mode-agnostic,
   * enriched with derived availability). Used by COURT_LIST / kiosk. Falls back
   * to the runtime tournament list when no inventory is wired (legacy test
   * compat — production always injects the inventory).
   */
  getPublicCourtList(): CourtInfo[] {
    if (!this.inventory) return this.getAllTournamentCourts();

    return this.inventory
      .list()
      .filter(r => r.inventoryStatus === INVENTORY_STATUS.ACTIVE)
      .map((r) => {
        const rt = this.repository.get(r.courtId);
        const flow = rt?.flow ?? null;
        const availability = this.availabilityOf(r, flow, null);
        const base = rt ? this.formatter.toPublicInfo(rt) : undefined;
        return {
          id: r.courtId,
          number: r.number,
          name: r.name,
          status: base?.status ?? 'WAITING',
          playerCount: base?.playerCount ?? 0,
          playerNames: base?.playerNames ?? { a: 'Player A', b: 'Player B' },
          currentScore: base?.currentScore ?? { a: 0, b: 0 },
          currentSets: base?.currentSets ?? { a: 0, b: 0 },
          winner: base?.winner ?? null,
          featured: base?.featured ?? false,
          mode: base?.mode ?? COURT_MODE.TOURNAMENT,
          inventoryStatus: r.inventoryStatus,
          availability,
        };
      });
  }

  /**
   * @deprecated Test-support only — hard-delete a runtime court.
   * Production removal is INVENTORY_ARCHIVE (archive-not-delete, INV-3).
   */
  deleteCourt(courtId: string): boolean {
    const deleted = this.repository.delete(courtId);
    if (deleted) {
      logger.info({ courtId }, 'Court deleted (test-support)');
      this.flush();
    }
    return deleted;
  }

  // ── Club Mode ──────────────────────────────────────────────────────

  /**
   * @deprecated Test-support only — delete a club-mode court.
   * Production removal is INVENTORY_ARCHIVE (archive-not-delete, INV-3).
   */
  deleteClubCourt(courtId: string): boolean {
    const court = this.repository.get(courtId);
    if (!court || court.mode !== 'club') return false;
    if (court.clubStatus !== CLUB_STATUS.AVAILABLE) return false;

    const deleted = this.repository.delete(courtId);
    if (deleted) {
      logger.info({ courtId, courtName: court.name }, 'Club court deleted (test-support)');
    }
    return deleted;
  }

  /**
   * Get all club-oriented runtime courts (mode-derived).
   */
  getClubCourts(): RuntimeCourt[] {
    return this.repository.getAll().filter(isClubFlowCourt);
  }

  /**
   * Build ClubKioskPayload for the public kiosk display.
   * Filters to club-oriented courts, maps each to ClubKioskCourtInfo using the
   * formatter for scores/names/winner, and populates pin only when RESERVED.
   */
  getClubKioskPayload(clubConfig: ClubConfig | null): ClubKioskPayload {
    const clubCourts = this.repository.getAll().filter(isClubFlowCourt);

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
        sessionMode: c.sessionMode ?? undefined,
        playerName: c.playerName ?? undefined,
        featured: c.featured,
      };
    });

    return {
      clubName: clubConfig?.clubName ?? 'Club',
      courts,
    };
  }

  /**
   * Activate a club court: transitions clubStatus from AVAILABLE to RESERVED
   * (reserved = pending-PIN, Q2), generates a 4-digit session PIN.
   */
  activateCourt(courtId: string): RuntimeCourt | null {
    const court = this.repository.get(courtId);
    if (!court || court.mode !== 'club') return null;
    if (court.clubStatus !== CLUB_STATUS.AVAILABLE) return null;

    court.clubStatus = CLUB_STATUS.RESERVED;
    court.reserved = true;
    court.pin = this.pinService.generatePin();

    logger.info({ courtId, courtName: court.name, pin: court.pin }, 'Club court activated');
    this.notifyUpdate(court);

    return court;
  }

  /**
   * Deactivate a club court: transitions RESERVED → AVAILABLE,
   * invalidates the session PIN.
   */
  deactivateCourt(courtId: string): RuntimeCourt | null {
    const court = this.repository.get(courtId);
    if (!court || court.mode !== 'club') return null;
    if (court.clubStatus !== CLUB_STATUS.RESERVED) return null;

    court.clubStatus = CLUB_STATUS.AVAILABLE;
    court.reserved = false;
    court.pin = '';

    logger.info({ courtId, courtName: court.name }, 'Club court deactivated');
    this.notifyUpdate(court);

    return court;
  }

  /**
   * Reset a club court: transitions FINISHED → AVAILABLE.
   */
  resetCourt(courtId: string): RuntimeCourt | null {
    const court = this.repository.get(courtId);
    if (!court || court.mode !== 'club') return null;
    if (court.clubStatus !== CLUB_STATUS.FINISHED) return null;

    court.clubStatus = CLUB_STATUS.AVAILABLE;
    court.reserved = false;
    court.flow = null;
    court.pin = '';
    court.occupiedAt = null;
    court.playerNames = { a: '', b: '' };
    court.players = [];
    court.playerName = null;
    court.phone = null;
    court.adminId = null;
    court.sessionMode = null;

    // Reset match engine to fresh WAITING state
    this.matchOrchestrator.resetTable(court);

    logger.info({ courtId, courtName: court.name }, 'Club court reset to available');
    this.notifyUpdate(court);

    return court;
  }

  /**
   * Find a club court by matching its session PIN.
   * Only matches courts in RESERVED (pending-PIN) or OCCUPIED (active
   * session) state. Returns undefined when no match is found.
   */
  findClubCourtByPin(pin: string): RuntimeCourt | undefined {
    return this.repository.getAll().find(
      (c) => c.mode === 'club' && c.pin === pin &&
            (c.reserved || c.flow?.state === 'OCCUPIED'),
    );
  }

  /**
   * Admin-occupy a club court: RESERVED → OCCUPIED with player identity
   * captured up-front (playerName + phone + adminId + sessionMode).
   * Delegates the flow transition to the club contract (FMR-1).
   */
  adminOccupyCourt(
    courtId: string,
    params: {
      playerName: string;
      phone: string;
      adminId: string;
      mode: SessionMode;
      sport: Sport;
    },
  ): { court: RuntimeCourt; matchState: MatchStateExtended } | null {
    let court = this.repository.get(courtId);
    if (!court || court.mode !== 'club') return null;
    if (typeof params.adminId !== 'string' || params.adminId.length === 0) return null;

    // Auto-activate if the court is still AVAILABLE (freshly created, never
    // activated) — AVAILABLE → RESERVED → OCCUPIED atomically.
    if (court.clubStatus === CLUB_STATUS.AVAILABLE) {
      const activated = this.activateCourt(court.id);
      if (!activated) return null;
      const refreshed = this.repository.get(courtId);
      if (!refreshed || refreshed.mode !== 'club') return null;
      court = refreshed;
    }

    if (court.clubStatus !== CLUB_STATUS.RESERVED) return null;

    // Transition RESERVED → OCCUPIED via the club contract (single writer).
    const occupied = this.registry.get('club').occupy!(court, {
      sessionMode: params.mode,
      playerName: params.playerName,
      phone: params.phone,
    });
    if (!occupied) return null;

    // adminId is stamped on the flow + projection AFTER occupy (contract
    // starts the session; the caller attributes it).
    const flow = court.flow as NonNullable<FlowSlot> & { mode: 'club' };
    flow.adminId = params.adminId;
    court.adminId = params.adminId;

    // Same default player names + match-config builder as occupyClubCourt.
    court.playerNames = { a: 'Jugador 1', b: 'Jugador 2' };
    court.sportRules.setPlayerNames({ a: 'Jugador 1', b: 'Jugador 2' });

    const matchConfig: MatchConfig = params.sport === SPORT.PADEL
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

    // Start a default match so score + serve rendering work the moment the
    // admin lands on the post-occupy view.
    const matchState = this.matchOrchestrator.startMatch(court, {
      ...matchConfig,
      playerNameA: 'Jugador 1',
      playerNameB: 'Jugador 2',
    });

    if (!matchState) {
      // Rollback on failure — restore RESERVED so the admin can retry.
      court.flow = null;
      court.clubStatus = CLUB_STATUS.RESERVED;
      court.reserved = true;
      court.occupiedAt = null;
      court.playerName = null;
      court.phone = null;
      court.adminId = null;
      court.sessionMode = null;
      court.playerNames = { a: '', b: '' };
      return null;
    }

    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(courtId, event);
    });

    this.notifyUpdate(court);
    return { court, matchState };
  }

  /**
   * Occupy a club court: transitions RESERVED → OCCUPIED and auto-initializes
   * a match with default config based on the club's sport. For reconnection
   * on already OCCUPIED courts, returns the current state without
   * re-initializing the match.
   */
  occupyClubCourt(courtId: string, sport: Sport): { court: RuntimeCourt; matchState: MatchStateExtended } | null {
    const court = this.repository.get(courtId);
    if (!court || court.mode !== 'club') return null;
    const isReserved = court.reserved;
    const isOccupied = court.flow?.mode === 'club' && court.flow.state === 'OCCUPIED';
    if (!isReserved && !isOccupied) return null;

    // Reconnection on already OCCUPIED court — return current match state
    if (isOccupied) {
      const matchState = this.matchOrchestrator.getMatchState(court);
      if (!matchState) return null;
      return { court, matchState };
    }

    // Transition RESERVED → OCCUPIED via the club contract (single writer).
    const occupied = this.registry.get('club').occupy!(court);
    if (!occupied) return null;

    // player-identity — explicit clean state on the fresh-occupy path.
    court.playerName = null;
    court.phone = null;
    court.adminId = null;

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

    // Auto-init match via MatchOrchestrator. The match starts LIVE with
    // default names; the client's ClubSessionConfig shows the mode selector
    // on top when sessionMode is null.
    const matchState = this.matchOrchestrator.startMatch(court, {
      ...matchConfig,
      playerNameA: 'Jugador 1',
      playerNameB: 'Jugador 2',
    });

    if (!matchState) {
      // Rollback on failure
      court.flow = null;
      court.reserved = true;
      court.clubStatus = CLUB_STATUS.RESERVED;
      court.playerNames = { a: '', b: '' };
      return null;
    }

    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(courtId, event);
    });

    this.notifyUpdate(court);
    return { court, matchState };
  }

  /**
   * End a club court session: delegates to the club flow contract
   * (FMR-1/FMR-3) — the contract validates OCCUPIED, settles the cost
   * (ceil(elapsedMinutes × costPerMinute)), transitions OCCUPIED → FINISHED
   * and clears the PIN. CourtManager fires onClubSessionEnd.
   */
  endSession(courtId: string, reason: string): { elapsedMinutes: number; elapsedSeconds: number } | null {
    const court = this.repository.get(courtId);
    if (!court || court.mode !== 'club') return null;

    const result = this.registry.get('club').end(court, this.flowContext());
    if (!result) return null;

    logger.info({ courtId, courtName: court.name, reason, elapsedMinutes: result.elapsedMinutes, elapsedSeconds: result.elapsedSeconds }, 'Club court session ended');
    this.notifyUpdate(court);
    this.onClubSessionEnd(courtId, result.elapsedMinutes, result.elapsedSeconds, reason);

    return { elapsedMinutes: result.elapsedMinutes, elapsedSeconds: result.elapsedSeconds };
  }

  /**
   * Force-end a court session — delegates to the mode contract (FMR-1):
   * club → finalizes cost + adminId-stamps then releases (AFE-3);
   * tournament → clears the flow and unbinds the bracket match with NO
   * setWinner/advance (AFE-2, D9). The bracket unbind capability (ctx
   * resolveMatchForCourt/unbindMatch) is supplied by the caller (the
   * INVENTORY_FORCE_END handler).
   */
  forceEndSession(courtId: string, adminId?: string, ctx: FlowContext = {}): RuntimeCourt | null {
    const court = this.repository.get(courtId);
    if (!court) return null;

    const mode: FlowModeKey = court.mode;
    const result = this.registry.get(mode).forceEnd(court, adminId ?? '', { ...this.flowContext(), ...ctx });
    if (!result) return null;

    logger.info({ courtId, courtName: court.name, mode, adminId: adminId ?? null }, 'Court session force-ended');
    this.notifyUpdate(court);
    if (mode === 'club') {
      this.onClubSessionEnd(courtId, result.elapsedMinutes ?? 0, result.elapsedSeconds ?? 0, 'force');
    }
    return court;
  }

  /**
   * availabilityOf — the DERIVED availability axis (INV-4/E12), pure over
   * (inventoryStatus, active flow, bracket binding) → IDLE | BUSY.
   * usable = ACTIVE && IDLE. Never persisted — consistent by construction.
   * Delegates to the flows-module pure function (same rule, one definition).
   */
  availabilityOf(record: CourtRecord, flow: FlowSlot, binding: BracketMatch | null): Availability {
    return deriveAvailability(record, flow, binding);
  }

  /**
   * Flow-derived availability of a RUNTIME court: club OCCUPIED / tournament
   * LIVE → BUSY, else IDLE. Unknown court → IDLE. (Slice-5: reads the flow
   * slot — the runtime view of the derived axis.)
   */
  getCourtAvailability(courtId: string): Availability {
    const court = this.repository.get(courtId);
    if (!court) return AVAILABILITY.IDLE;
    const f = court.flow;
    if (f?.mode === 'club') return f.state === 'OCCUPIED' ? AVAILABILITY.BUSY : AVAILABILITY.IDLE;
    if (f?.mode === 'tournament') return f.state === 'LIVE' ? AVAILABILITY.BUSY : AVAILABILITY.IDLE;
    return AVAILABILITY.IDLE;
  }

  /**
   * Archive guard via the mode contract (INV-5/R7): false while the court is
   * BUSY (live flow) — the admin must force-end first, then archive.
   * Unknown court → true (no runtime flow to block the archive).
   */
  canArchiveCourt(courtId: string): boolean {
    const court = this.repository.get(courtId);
    if (!court) return true;
    return this.registry.get(court.mode).canArchive(court);
  }

  /**
   * Tournament end/reset detach (TCS-3, Q4 — releaseAll): release the flow on
   * a court via its mode contract. Tournament release clears the flow → IDLE;
   * club release is a NO-OP (club courts are untouched by tournament
   * releaseAll — ClubFlowContract.release). Unknown court → no-op.
   */
  releaseCourtFlow(courtId: string): void {
    const court = this.repository.get(courtId);
    if (!court) return;
    this.registry.get(court.mode).release(court, this.flowContext());
    this.notifyUpdate(court);
  }

  /** Flow context for contract calls — club cost config (FMR-3/AFE-3). */
  private flowContext(): FlowContext {
    const config = this.resolveClubConfig();
    return {
      costPerMinute: config?.costPerMinute,
      currency: config?.currency,
    };
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
   * Only works for club-oriented courts.
   */
  registerClubReferee(courtId: string, socketId: string): string | null {
    const court = this.repository.get(courtId);
    if (!court || court.mode !== 'club') return null;

    const displaced = this.playerService.setRefereeDirect(court, socketId, 'Club Player');
    this.notifyUpdate(court);
    return displaced;
  }

  // Match orchestration
  configureMatch(courtId: string, config: { playerNames?: { a: string; b: string }; matchConfig?: MatchConfig }): void {
    const court = this.repository.get(courtId);
    if (!court) return;

    this.matchOrchestrator.configureMatch(court, config);

    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(courtId, event);
    });

    this.notifyUpdate(court);
  }

  startMatch(courtId: string, config?: Partial<MatchConfig> & { playerNameA?: string; playerNameB?: string }): MatchStateExtended | null {
    let court = this.repository.get(courtId);
    if (!court) {
      // Slice 5 — tournament runtime materialization (referee-play path): a
      // bracket match bound to an inventory-ACTIVE court starts a runtime
      // tournament court on demand. No ghost: requires a catalog record.
      const record = this.inventory?.get(courtId);
      if (record && record.inventoryStatus === INVENTORY_STATUS.ACTIVE) {
        court = this.materializeTournamentCourtFromInventory(record);
      } else {
        logger.warn({ courtId }, 'startMatch: court not found and no catalog record');
        return null;
      }
    }

    const state = this.matchOrchestrator.startMatch(court, config);

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

    // Club session lifecycle: when a match finishes on a club OCCUPIED
    // court, the court STAYS OCCUPIED. The session continues until the
    // player emits CLUB_END_SESSION or the admin force-ends.
    return state;
  }

  // ── Club Session Lifecycle ──────────────────────────────────────────

  /**
   * Switch a club court to "free" session mode — delegates the flow-state
   * transition (sessionMode + player identity) to the club contract (FMR-1).
   */
  startFreePlay(
    courtId: string,
    player?: { playerName?: string; phone?: string },
  ): { sessionMode: SessionMode } | null {
    const court = this.repository.get(courtId);
    if (!court || court.mode !== 'club') return null;

    const started = this.registry.get('club').start!(court, {
      sessionMode: SESSION_MODE.FREE,
      playerName: player?.playerName,
      phone: player?.phone,
    });
    if (!started) return null;

    logger.info({ courtId, courtName: court.name }, 'Club court entered free mode');
    this.notifyUpdate(court);

    return { sessionMode: SESSION_MODE.FREE };
  }

  /**
   * Reset the match on a club court to 0-0 with the same config and
   * player names. Used by the post-match "Reset" action.
   */
  resetMatch(courtId: string): { matchState: MatchStateExtended } | null {
    const court = this.repository.get(courtId);
    if (!court || court.mode !== 'club') return null;
    if (court.flow?.state !== 'OCCUPIED') return null;

    // Reuse the CURRENT match config (preserve points per set, best of,
    // handicap, sport). If no config is present, fall back to default TT.
    const currentConfig = court.sportRules.getConfig();
    const config: MatchConfig = currentConfig
      ? { ...currentConfig }
      : { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 1, minDifference: 2 };

    const matchState = this.matchOrchestrator.startMatch(court, {
      ...config,
      ...(court.playerNames.a ? { playerNameA: court.playerNames.a } : {}),
      ...(court.playerNames.b ? { playerNameB: court.playerNames.b } : {}),
    });

    if (!matchState) return null;

    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(courtId, event);
    });

    if (court.playerNames.a || court.playerNames.b) {
      court.playerNames = { ...court.playerNames };
      court.sportRules.setPlayerNames({ ...court.playerNames });
    }

    logger.info({ courtId, courtName: court.name }, 'Club court match reset to 0-0');
    this.notifyUpdate(court);

    return { matchState };
  }

  /**
   * Start a new match on a club court with new player names. Used by the
   * post-match "New Match" action and by the "Jugar partido" flow.
   */
  newMatch(
    courtId: string,
    params: {
      playerNameA: string;
      playerNameB: string;
      matchConfig?: Partial<MatchConfig>;
      playerName?: string;
      phone?: string;
    },
  ): { matchState: MatchStateExtended } | null {
    const court = this.repository.get(courtId);
    if (!court || court.mode !== 'club') return null;

    // Delegate the flow-state transition (sessionMode='match' + player
    // identity, populate-or-preserve) to the club contract (FMR-1).
    const started = this.registry.get('club').start!(court, {
      sessionMode: SESSION_MODE.MATCH,
      playerName: params.playerName,
      phone: params.phone,
    });
    if (!started) return null;

    court.playerNames = { a: params.playerNameA, b: params.playerNameB };

    const currentConfig = court.sportRules.getConfig();
    const baseConfig: MatchConfig = currentConfig
      ? { ...currentConfig }
      : { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 1, minDifference: 2 };
    const config: MatchConfig = { ...baseConfig, ...(params.matchConfig ?? {}) } as MatchConfig;

    const matchState = this.matchOrchestrator.startMatch(court, {
      ...config,
      playerNameA: params.playerNameA,
      playerNameB: params.playerNameB,
    });

    if (!matchState) return null;

    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(courtId, event);
    });

    logger.info(
      { courtId, courtName: court.name, playerNameA: params.playerNameA, playerNameB: params.playerNameB },
      'Club court new match started',
    );
    this.notifyUpdate(court);

    return { matchState };
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
        status: court.mode === 'club' ? court.clubStatus : court.status,
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

    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(courtId, event);
    });

    logger.info({ courtId, courtName: court.name, oldRefereeId: oldReferee || 'none', newPin: court.pin }, 'Court reset with new PIN');
    // Only persistState — skip notifyUpdate (which broadcasts COURT_LIST without PINs).
    this.flush();

    return court.pin;
  }

  /**
   * Option A — referee free-play PIN (owner-initiated): ensure the inventory
   * court has a RUNTIME entry (materializing it from the catalog when needed,
   * E11 — shared identity) and return its PIN so the owner can hand it to a
   * referee WITHOUT a bracket match. Mirrors the bracket SELECT materialization
   * (ensureRuntimeTournamentCourt) but is available on demand for free-play.
   * Returns null when the court is not inventory-ACTIVE (no ghost courts).
   */
  generateRefereePin(courtId: string): string | null {
    if (!this.ensureRuntimeTournamentCourt(courtId)) return null;
    const court = this.repository.get(courtId);
    if (!court) return null;
    // Persist the freshly materialized runtime court (bracket SELECT also
    // persists via the debounced save; here we flush so the PIN survives).
    this.flush();
    return court.pin;
  }

  // QR
  generateQRData(courtId: string): QRData | null {
    const court = this.repository.get(courtId);
    if (!court) return null;
    return this.qrService.generateQRData(court);
  }

  // Formatting
  courtToInfo(court: RuntimeCourt): CourtInfo {
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
  /**
   * INV-4 — whether a court id exists in the admin inventory catalog.
   * When no inventory manager is injected (pre-slice-2 consumers), every
   * flow is considered catalog-backed (legacy restore behavior — bridge).
   */
  private hasCatalogRecord(courtId: string): boolean {
    return !this.inventory || this.inventory.get(courtId) !== undefined;
  }

  /**
   * MP-1 — default name for a NEW court based on the resolved club sport:
   * "Mesa {n}" for table tennis, "Cancha {n}" for padel.
   */
  private defaultCourtName(n: number): string {
    return this.resolveCourtSport() === SPORT.PADEL ? `Cancha ${n}` : `Mesa ${n}`;
  }

  /**
   * Construct a RuntimeCourt from identity + projection defaults. The record
   * defaults to a synthetic catalog record (test-support paths) or is passed
   * through (materializeClubCourtFromInventory). Wires the match engine
   * event callback.
   */
  private buildRuntimeCourt(opts: {
    courtId: string;
    number: number;
    name: string;
    mode: FlowModeKey;
    status: TournamentStatus;
    clubStatus: ClubStatus;
    pin: string;
    playerNames: { a: string; b: string };
    record?: CourtRecord;
  }): RuntimeCourt {
    const record: CourtRecord = opts.record ?? {
      courtId: opts.courtId,
      number: opts.number,
      name: opts.name,
      inventoryStatus: INVENTORY_STATUS.ACTIVE,
    };

    const court: RuntimeCourt = {
      record,
      flow: null,
      reserved: false,
      mode: opts.mode,
      id: opts.courtId,
      number: opts.number,
      name: opts.name,
      pin: opts.pin,
      sportRules: new MatchEngine(),
      featured: false,
      players: [],
      playerNames: opts.playerNames,
      createdAt: Date.now(),
      history: [],
      status: opts.status,
      clubStatus: opts.clubStatus,
      occupiedAt: null,
      sessionMode: null,
      playerName: null,
      phone: null,
      adminId: null,
    };

    court.sportRules.setCourtId(opts.courtId, opts.name);
    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(opts.courtId, event);
    });

    return court;
  }

  private notifyUpdate(court: RuntimeCourt): void {
    if (this.onTableUpdate) {
      this.onTableUpdate(this.formatter.toPublicInfo(court));
    }

    // Auto-save to state store, trailing-debounced (P1).
    if (this.stateStore) {
      this.schedulePersist();
    }
  }

  /**
   * Schedule a trailing-debounced persist (P1), mirroring the bracket save
   * debounce (BracketHandler.scheduleDebouncedSave).
   */
  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistState();
    }, this.persistDebounceMs);
    if (typeof (this.persistTimer as NodeJS.Timeout).unref === 'function') {
      (this.persistTimer as NodeJS.Timeout).unref();
    }
  }

  /**
   * Flush any pending debounced persist immediately (P1).
   */
  public flush(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (this.stateStore) {
      this.persistState();
    }
  }

  /**
   * Persist the transient LIVE sessions (v4 `liveSessions` — PERS-2).
   * Each runtime court with an active flow serializes through its mode
   * contract (single rule engine); the matchState is attached so a restart
   * can rebuild the MatchEngine. Errors are caught and logged.
   *
   * PERS-4 (slice 6): with a coordinator wired, the sessions mutate the
   * shared in-memory snapshot and ONE flush re-serializes the FULL document
   * (liveSessions + bracket) — the bracket writer's changes ride along and
   * are never lost (R2 fixed). Without a coordinator (legacy test wiring) it
   * falls back to a direct liveSessions-only save.
   */
  private persistState(): void {
    try {
      const allCourts = this.repository.getAll();

      const sessions: PersistedFlowSession[] = [];
      for (const court of allCourts) {
        if (!court.flow) continue; // IDLE — never persisted
        const session = this.registry.get(court.mode).serialize(court);
        if (!session) continue;
        sessions.push({
          ...session,
          matchState: this.toPersistedMatchState(court),
        });
      }

      if (this.coordinator) {
        this.coordinator.mutate((s) => {
          s.liveSessions = sessions;
        });
        this.coordinator.flush();
      } else if (this.stateStore) {
        this.stateStore.save({
          version: PERSISTENCE_VERSION,
          savedAt: Date.now(),
          liveSessions: sessions,
        });
      }
    } catch (err) {
      logger.error({ err }, 'StateStore: auto-save failed');
    }
  }

  /**
   * Convert a runtime court's match engine state into a serializable
   * PersistedMatchState (shared by both modes — the v3 split serializers
   * are removed with the legacy arrays).
   */
  private toPersistedMatchState(court: RuntimeCourt): PersistedMatchState {
    const state = court.sportRules.getState();
    const isPadel = state.sport === SPORT.PADEL;
    const s = state as any;

    return {
      config: { ...state.config },
      score: isPadel
        ? { sets: s.sets ?? { a: 0, b: 0 }, currentSet: s.games ?? { a: 0, b: 0 }, serving: s.serving ?? 'A' }
        : JSON.parse(JSON.stringify(s.score ?? { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' })),
      swappedSides: state.swappedSides,
      midSetSwapped: state.midSetSwapped,
      setHistory: (s.setHistory || []).map((sh: any) => ({ ...sh })),
      status: state.status,
      winner: state.winner,
      sport: state.sport || SPORT.TABLE_TENNIS,
      history: (s.history || []).slice(-MAX_HISTORY_LENGTH).map((h: any) => ({
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
    };
  }

  /**
   * Load state from disk and reconstruct runtime courts from the v4
   * `liveSessions` rows (PERS-2). Each session re-attaches to its catalog
   * record (record first — CourtInventoryStore, then the flow row); a flow
   * whose courtId has NO catalog record is DROPPED (no ghost sessions —
   * design D1 restore / INV-4). Corrupted entries are skipped with a warning.
   */
  public restoreState(): boolean {
    if (!this.stateStore) {
      logger.warn('CourtManager.restoreState: no StateStore configured');
      return false;
    }

    const persisted = this.stateStore.load();
    if (!persisted) {
      return false;
    }

    const sessions = persisted.liveSessions ?? [];

    let restored = 0;
    let bracketRestored = 0;

    for (const session of sessions) {
      const flow = session.flow;
      if (!flow) continue;

      // Axis split (INV-4): a flow whose courtId has no inventory catalog
      // record is DROPPED — no ghost sessions (design D1 restore).
      if (!this.hasCatalogRecord(session.courtId)) {
        logger.info({ courtId: session.courtId }, 'restoreState: dropped flow — no inventory catalog record');
        continue;
      }

      try {
        const record = this.inventory?.get(session.courtId);
        const number = record?.number ?? session.number ?? 0;
        const name = record?.name ?? session.name ?? session.courtId;

        const matchState = session.matchState as any;
        const engine = matchState
          ? MatchEngine.fromState({
              ...matchState,
              tableId: session.courtId,
              tableName: name,
              playerNames: session.playerNames ?? { a: '', b: '' },
              history: matchState.history || [],
              undoAvailable: (matchState.history || []).length > 0,
            } as MatchStateExtended)
          : new MatchEngine();

        engine.setCourtId(session.courtId, name);
        if (session.playerNames) engine.setPlayerNames(session.playerNames);

        const court = this.buildRuntimeCourt({
          courtId: session.courtId,
          number,
          name,
          mode: flow.mode,
          status: flow.mode === 'tournament' ? (flow.state === 'LIVE' ? 'LIVE' : 'WAITING') : 'WAITING',
          clubStatus: flow.mode === 'club' ? (flow.state === 'OCCUPIED' ? CLUB_STATUS.OCCUPIED : CLUB_STATUS.FINISHED) : CLUB_STATUS.AVAILABLE,
          pin: session.pin ?? '',
          playerNames: session.playerNames ?? { a: 'Player A', b: 'Player B' },
          record,
        });

        // Re-attach the flow slot (authoritative) + projection identity.
        court.flow = flow;
        if (flow.mode === 'club') {
          court.sessionMode = flow.sessionMode ?? null;
          court.occupiedAt = flow.occupiedAt ?? null;
          court.playerName = flow.playerName ?? null;
          court.phone = flow.phone ?? null;
          court.adminId = flow.adminId ?? null;
        } else {
          // Tournament projection mirrors the match engine status (a FINISHED
          // match restores as FINISHED; the flow stays LIVE → BUSY until the
          // bracket releases it).
          court.status = (matchState?.status as TournamentStatus) ?? 'LIVE';
        }

        // Wire callbacks so Socket.io events work after restoration
        engine.setEventCallback((event: any) => {
          this.onMatchEvent(session.courtId, event);
        });
        court.sportRules = engine;

        this.repository.create(court);
        restored++;

        logger.info(
          { courtId: session.courtId, courtName: name, mode: flow.mode, state: flow.state },
          'CourtManager: restored court from state',
        );
      } catch (err) {
        logger.warn(
          { err, courtId: session.courtId },
          'CourtManager.restoreState: failed to restore court, skipping',
        );
      }
    }

    if (restored > 0) {
      // Notify listeners about each restored court
      for (const court of this.repository.getAll()) {
        this.notifyUpdate(court);
      }
    }

    // Bracket-assigned WAITING courts (no flow yet) are NOT in liveSessions,
    // so the loop above skipped them — but the bracket persists their courtId
    // and the referee needs the PIN after a server restart. Re-materialize
    // every bracket-referenced court that is inventory-ACTIVE and has no
    // runtime entry (ensureRuntimeTournamentCourt is the exact SELECT-path
    // materialization, E11 — shared identity, fresh PIN).
    if (this.coordinator) {
      const bracket = this.coordinator.getBracket();
      const assigned = new Set<string>();
      for (const m of bracket?.matches ?? []) if (m.courtId) assigned.add(m.courtId);
      if (bracket?.thirdPlaceMatch?.courtId) assigned.add(bracket.thirdPlaceMatch.courtId);
      for (const courtId of assigned) {
        if (!this.repository.get(courtId) && this.ensureRuntimeTournamentCourt(courtId)) {
          bracketRestored++;
          logger.info({ courtId }, 'restoreState: re-materialized bracket-assigned court');
        }
      }
    }
    if (bracketRestored > 0) {
      for (const court of this.repository.getAll()) {
        this.notifyUpdate(court);
      }
    }

    return restored > 0 || bracketRestored > 0;
  }
}
/** @deprecated Use CourtManager instead */
export type TableManager = CourtManager;
/** @deprecated Use CourtManager instead */
export const TableManager = CourtManager;
