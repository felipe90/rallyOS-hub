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
import { MatchEngine, MAX_HISTORY_LENGTH } from './matchEngine';
import { Court, TournamentCourt, ClubCourt, isClubCourt, isTournamentCourt, CourtInfo, CourtInfoWithPin, Player, MatchConfig, MatchStateExtended, QRData, Sport, SPORT, COURT_MODE, TournamentStatus, ClubStatus, CLUB_STATUS, SessionMode, SESSION_MODE, FlowModeKey, FlowSlot } from './types';
import { AllHistoryEntry, ClubKioskPayload, ClubKioskCourtInfo, ClubConfig, INVENTORY_STATUS, AVAILABILITY } from '../../../shared/types';
import type { Availability, CourtRecord, BracketMatch } from '../../../shared/types';
import { logger } from '../utils/logger';
import { sanitizeInput } from '../utils/validation';
import type { PersistedCourt, PersistedClubCourt } from './ports/persistence-types';
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
 * whose courtId has NO catalog record is dropped (no ghost sessions).
 * Satisfied structurally by InventoryManager.get().
 */
export type CourtCatalog = Pick<InventoryManager, 'get'>;

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
   * FMR-1 — the flow rule engine. Each flow mode (club/tournament, future
   * 'clase') registers one contract; CourtManager delegates end/forceEnd/
   * start to `registry.get(flow.mode)` and NEVER branches on sessionMode
   * inline. Defaults to the built-in club + tournament contracts
   * (registerDefaultFlows).
   */
  registry?: FlowModeRegistry;
  /**
   * INV-4 — catalog view for the persist/restore axis split. When present,
   * restoreState() drops any persisted flow whose courtId has no catalog
   * record (no ghost sessions). Optional so pre-slice-2 consumers (tests,
   * boot without inventory) keep the legacy restore behavior.
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
   * resolver (e.g. tests with explicit names) are unaffected. Tournament
   * CREATE_COURT (CourtEventHandler.ts:61) carries no sport, so both the
   * tournament and club creation flows read the club config through this
   * resolver. Stored/persisted names render as-is — no migration (MP-2).
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
    this.registry = deps.registry ?? registerDefaultFlows();
    this.inventory = deps.inventory;
    this.resolveClubConfig = deps.resolveClubConfig ?? (() => null);
    this.resolveCourtSport = deps.resolveCourtSport ?? (() => SPORT.TABLE_TENNIS);
    this.counter = deps.counter ?? new CourtNumberCounter(this.repository.getAll());
  }

  // Table CRUD
  createCourt(name?: string): TournamentCourt {
    const courtNumber = this.counter.next();
    const courtName = name ? sanitizeInput(name, 256) : this.defaultCourtName(courtNumber);
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
      // Immediate persist — a deleted court must not survive a restart, and
      // any pending debounced save for the removed court must not fire later.
      this.flush();
    }
    return deleted;
  }

  // ── Club Mode ──────────────────────────────────────────────────────

  /**
   * Create a club-mode court (mode='club') with clubStatus='AVAILABLE' and no PIN.
   * Club courts don't need a match PIN — they use session PINs on activation.
   */
  createClubCourt(name?: string): ClubCourt {
    const courtNumber = this.counter.next();
    const courtName = name ? sanitizeInput(name, 256) : this.defaultCourtName(courtNumber);
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
      sessionMode: null,
      // player-identity defaults — null until populate by startFreePlay /
      // newMatch / adminOccupyCourt. Cleared back to null by resetCourt.
      playerName: null,
      phone: null,
      adminId: null,
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
   * Materialize a RUNTIME club court from a catalog record (slice 4.4 — closes
   * the slice-3 catalog/runtime gap). The runtime court SHARES the catalog
   * identity (E11 — one physical court): id = record.courtId, name/number from
   * the record. The admin's first club-flow action on an inventory court
   * (activate/occupy) reaches the runtime/kiosk this way. State AVAILABLE —
   * the caller then activates/occupies as usual.
   */
  materializeClubCourtFromInventory(record: CourtRecord): ClubCourt {
    const court: ClubCourt = {
      kind: 'club',
      id: record.courtId,
      number: record.number,
      name: record.name,
      clubStatus: CLUB_STATUS.AVAILABLE,
      pin: '',
      sportRules: new MatchEngine(),
      playerNames: { a: '', b: '' },
      history: [],
      players: [],
      createdAt: Date.now(),
      featured: false,
      occupiedAt: null,
      sessionMode: null,
      playerName: null,
      phone: null,
      adminId: null,
    };

    court.sportRules.setCourtId(record.courtId, record.name);
    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(record.courtId, event);
    });

    this.repository.create(court);
    logger.info({ courtId: record.courtId, courtName: record.name, mode: 'club' }, 'Club court materialized from inventory');
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
        sessionMode: c.sessionMode ?? undefined,
        // player-identity (Phase 2 task 2.2) — surface playerName on the
        // kiosk card so the kiosk can render the player's name when the
        // court is OCCUPIED. `undefined` (rather than null) when unset so
        // the field is omitted from the wire payload entirely (matches
        // the ClubKioskCourtInfo optional type).
        playerName: c.playerName ?? undefined,
        // club-featured-courts — surface `featured` on the kiosk court card
        // so the club admin UI can render the star/destacado state via
        // useClubCourtManagement.handleKioskData.
        featured: c.featured,
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

    // player-identity (Phase 2 task 2.2) — clear player fields so the next
    // session starts fresh. The kiosk MUT NOT show a stale name, and the
    // SessionRecord for the next session must not inherit the previous
    // player's identity.
    court.playerName = null;
    court.phone = null;
    court.adminId = null;

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
   * Admin-occupy a club court: RESERVED → OCCUPIED with player identity
   * captured up-front (playerName + phone + adminId + sessionMode).
   *
   * player-identity (Phase 3 / U2 task 3.2 + 3.6). Mirrors `occupyClubCourt`
   * but is invoked by the admin "Iniciar sesión" modal flow: the admin
   * supplies the player's name + AES-256-GCM-encrypted phone and chooses
   * the session mode (free/match) up-front. The server transitions the court
   * straight from RESERVED → OCCUPIED, sets the timer, and persists the
   * supplied identity on the court so the subsequent `onClubSessionEnd`
   * callback builds a fully-populated SessionRecord with `endedBy='admin'`
   * when the admin later force-ends the session.
   *
   * Contrast with `occupyClubCourt` (player flow): that one leaves
   * playerName/phone/adminId null at occupy time — they are filled in
   * later by `startFreePlay` / `newMatch` once the player submits the
   * mode-select form. Here the form is submitted BEFORE the occupy; the
   * court is born already-occupied with identity in place.
   *
   * Validation:
   *   - court must exist, be a club court, and be in RESERVED state.
   *   - `params.adminId` MUST be a non-empty string (the caller is
   *     expected to source it from `socket.data.adminId`, set by
   *     CLUB_VERIFY_ADMIN or by JWT restore in `applySessionClaims`).
   *
   * Returns `{ court, matchState }` on success, null on failure (invalid
   * state, missing adminId, match-engine rollback).
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
  ): { court: ClubCourt; matchState: MatchStateExtended } | null {
    let court = this.repository.get(courtId);
    if (!court || !isClubCourt(court)) return null;
    if (typeof params.adminId !== 'string' || params.adminId.length === 0) return null;

    // Auto-activate if the court is still AVAILABLE (freshly created, never
    // activated). This lets the admin occupy in a single step without a
    // separate "Activar" click — the PIN is generated and the court transitions
    // AVAILABLE → RESERVED → OCCUPIED atomically.
    if (court.clubStatus === CLUB_STATUS.AVAILABLE) {
      const activated = this.activateCourt(court.id);
      if (!activated) return null;
      // Re-fetch the court — activateCourt mutates repository state.
      const refreshed = this.repository.get(courtId);
      if (!refreshed || !isClubCourt(refreshed)) return null;
      court = refreshed;
    }

    if (court.clubStatus !== CLUB_STATUS.RESERVED) return null;

    // Transition RESERVED → OCCUPIED and start the session timer.
    court.clubStatus = CLUB_STATUS.OCCUPIED;
    court.occupiedAt = Date.now();

    // Capture player identity + admin attribution + session mode up-front.
    court.playerName = params.playerName;
    court.phone = params.phone;
    court.adminId = params.adminId;
    court.sessionMode = params.mode;

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
    // admin lands on the post-occupy view. The sessionMode is set above; the
    // client decides whether to actually score (match mode) or treat the
    // session as free-play only (free mode).
    const matchState = this.matchOrchestrator.startMatch(court, {
      ...matchConfig,
      playerNameA: 'Jugador 1',
      playerNameB: 'Jugador 2',
    });

    if (!matchState) {
      // Rollback on failure — restore RESERVED so the admin can retry.
      court.clubStatus = CLUB_STATUS.RESERVED;
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

    // player-identity (Phase 2 task 2.2) — initialize player fields to null
    // at session start. createClubCourt already nulls them, but make this
    // explicit on the fresh-occupy path so a court that was reset, then
    // re-activated, then re-occupied starts from a clean state. The
    // reconnection branch above preserves any values set by startFreePlay/
    // newMatch/adminOccupyCourt by NOT touching them.
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

    // Auto-init match via MatchOrchestrator.
    // The match starts LIVE with default names; the client's
    // ClubSessionConfig (PR 4) shows the mode selector on top when
    // sessionMode is null, letting players choose free or match mode
    // before interacting with the scoreboard.
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
   * End a club court session: delegates to the club flow contract
   * (FMR-1/FMR-3) — the contract validates OCCUPIED, settles the cost
   * (ceil(elapsedMinutes × costPerMinute)), transitions OCCUPIED → FINISHED
   * and clears the PIN. CourtManager fires onClubSessionEnd.
   *
   * @returns { elapsedMinutes } on success, null on failure.
   */
  endSession(courtId: string, reason: string): { elapsedMinutes: number; elapsedSeconds: number } | null {
    const court = this.repository.get(courtId);
    if (!court || !isClubCourt(court)) return null;

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
   * INVENTORY_FORCE_END handler, slice 3/4) — until then a tournament
   * force-end clears the court flow only.
   *
   * Keeps backward-compatible return (Court | null): null when the session
   * could not be force-ended (e.g. club court not OCCUPIED).
   *
   * player-identity (Phase 3 / U2 task 3.6) — admin traceability:
   *   When `adminId` is supplied (a non-empty string sourced from
   *   `socket.data.adminId` by the CLUB_FORCE_END handler), it is stamped
   *   onto the court BEFORE the session end fires `onClubSessionEnd` (the
   *   club contract stamps it; the callback reads court.adminId). Omitting
   *   `adminId` (legacy callers) preserves the court's existing adminId.
   */
  forceEndSession(courtId: string, adminId?: string, ctx: FlowContext = {}): Court | null {
    const court = this.repository.get(courtId);
    if (!court) return null;

    const mode: FlowModeKey = isClubCourt(court) ? 'club' : 'tournament';
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
   * Bridge adapter — derive the availability of a LEGACY runtime court via
   * its mode contract (availabilityOf(state)): club OCCUPIED / tournament
   * LIVE → BUSY, else IDLE. Unknown court → IDLE. Feeds the slice-3/4
   * consumers that still read the legacy union (bridge).
   */
  getCourtAvailability(courtId: string): Availability {
    const court = this.repository.get(courtId);
    if (!court) return AVAILABILITY.IDLE;
    const mode: FlowModeKey = isClubCourt(court) ? 'club' : 'tournament';
    const state = isClubCourt(court) ? court.clubStatus : court.status;
    return this.registry.get(mode).availabilityOf(state);
  }

  /**
   * Archive guard via the mode contract (INV-5/R7): false while the court is
   * BUSY (live flow) — the admin must force-end first, then archive.
   * Unknown court → true (no runtime flow to block the archive).
   */
  canArchiveCourt(courtId: string): boolean {
    const court = this.repository.get(courtId);
    if (!court) return true;
    const mode: FlowModeKey = isClubCourt(court) ? 'club' : 'tournament';
    return this.registry.get(mode).canArchive(court);
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
    const mode: FlowModeKey = isClubCourt(court) ? 'club' : 'tournament';
    this.registry.get(mode).release(court, this.flowContext());
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

    // Club session lifecycle: when a match finishes on a club OCCUPIED
    // court, the court STAYS OCCUPIED. The session continues until the
    // player emits CLUB_END_SESSION or the admin force-ends via
    // CLUB_FORCE_END. The previous auto-endSession('auto') call has been
    // intentionally removed — see docs/club-session-lifecycle-feature.md.

    return state;
  }

  // ── Club Session Lifecycle ──────────────────────────────────────────

  /**
   * Switch a club court to "free" session mode — delegates the flow-state
   * transition (sessionMode + player identity) to the club contract
   * (FMR-1). Validates that the court exists and is a club-mode court; the
   * contract validates OCCUPIED. Leaves the court in OCCUPIED state with the
   * timer running and returns the new session mode.
   *
   * player-identity (Phase 2 task 2.2) — optionally accepts the player's
   * own name + phone (the player flow submits these alongside the mode
   * choice, encrypted client-side via AES-256-GCM). When provided, the
   * contract stores them on the court; when omitted, previously set values
   * are PRESERVED (idempotent re-entry).
   *
   * @returns `{ sessionMode: 'free' }` on success, null on failure.
   */
  startFreePlay(
    courtId: string,
    player?: { playerName?: string; phone?: string },
  ): { sessionMode: SessionMode } | null {
    const court = this.repository.get(courtId);
    if (!court || !isClubCourt(court)) return null;

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
   *
   * Validates that the court is a club OCCUPIED court. Returns the
   * fresh LIVE match state with zeroed scores. The court stays OCCUPIED
   * and the sessionMode is preserved (calling resetMatch does NOT
   * change free↔match — if the court was in match mode it stays in
   * match mode; if it was in free mode it stays in free mode).
   *
   * @returns `{ matchState }` on success, null on failure.
   */
  resetMatch(courtId: string): { matchState: MatchStateExtended } | null {
    const court = this.repository.get(courtId);
    if (!court || !isClubCourt(court)) return null;
    if (court.clubStatus !== CLUB_STATUS.OCCUPIED) return null;

    // Reuse the CURRENT match config (preserve points per set, best of,
    // handicap, sport). If no config is present (e.g., court was in free
    // mode with no prior match), fall back to the default table-tennis
    // config — the spec ties resetMatch to a concluded match.
    const currentConfig = court.sportRules.getConfig();
    const config: MatchConfig = currentConfig
      ? { ...currentConfig }
      : { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 1, minDifference: 2 };

    // Re-create the engine with the same config and SAME player names.
    // This zeroes all scores and returns the match to LIVE.
    const matchState = this.matchOrchestrator.startMatch(court, {
      ...config,
      ...(court.playerNames.a ? { playerNameA: court.playerNames.a } : {}),
      ...(court.playerNames.b ? { playerNameB: court.playerNames.b } : {}),
    });

    if (!matchState) return null;

    // Rewire event callback (startMatch replaces the engine).
    court.sportRules.setEventCallback((event: any) => {
      this.onMatchEvent(courtId, event);
    });

    // The orchestrator's startMatch sets match status to LIVE; update
    // the runtime court playerNames from the resulting matchState
    // because MatchEngine's startMatch may copy defaults when names
    // are missing. Reset to the existing stored names explicitly.
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
   * post-match "New Match" action and by the "Jugar partido" flow from
   * free mode.
   *
   * Validates that the court is a club OCCUPIED court. Updates player
   * names, sets `sessionMode = 'match'`, and starts a fresh match with
   * zeroed scores using the existing config (or the default TT config
   * when none has been configured yet).
   *
   * player-identity (Phase 2 task 2.2) — `params.playerName` and
   * `params.phone` (the player's OWN identity — distinct from the match
   * participants in `playerNameA`/`playerNameB`) are persisted on the
   * court when provided, so that the subsequent `onClubSessionEnd`
   * callback can populate the SessionRecord with player info. When
   * omitted, prior values are PRESERVED (idempotent re-entry / post-match
   * "New Match" that doesn't re-collect identity).
   *
   * @returns `{ matchState }` on success, null on failure.
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
    if (!court || !isClubCourt(court)) return null;

    // Delegate the flow-state transition (sessionMode='match' + player
    // identity, populate-or-preserve) to the club contract (FMR-1); the
    // contract validates OCCUPIED. The match orchestration below stays here.
    const started = this.registry.get('club').start!(court, {
      sessionMode: SESSION_MODE.MATCH,
      playerName: params.playerName,
      phone: params.phone,
    });
    if (!started) return null;

    // Update player names on the court
    court.playerNames = { a: params.playerNameA, b: params.playerNameB };

    // Reuse the existing config when one exists; otherwise default to
    // table-tennis bestOf=1. PR 2 risk fix #2 — the optional matchConfig
    // passed by the CLUB_NEW_MATCH handler overrides the relevant config
    // fields so a user can pick non-default points/sets/handicap before
    // starting a fresh match.
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

    // Rewire event callback (startMatch replaces the engine).
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
    // Only persistState — skip notifyUpdate (which broadcasts TABLE_LIST without PINs).
    // The client gets the new PIN via PIN_REGENERATED + TABLE_LIST_WITH_PINS,
    // avoiding a race where TABLE_LIST overwrites TABLE_LIST_WITH_PINS state.
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
   * "Mesa {n}" for table tennis, "Cancha {n}" for padel. Only applies to
   * freshly created courts; persisted names are rendered as-is (MP-2).
   */
  private defaultCourtName(n: number): string {
    return this.resolveCourtSport() === SPORT.PADEL ? `Cancha ${n}` : `Mesa ${n}`;
  }

  private notifyUpdate(court: Court): void {
    if (this.onTableUpdate) {
      this.onTableUpdate(this.formatter.toPublicInfo(court));
    }

    // Auto-save to state store, trailing-debounced (P1). A point burst on any
    // court coalesces into a single write; errors are logged, never crash.
    if (this.stateStore) {
      this.schedulePersist();
    }
  }

  /**
   * Schedule a trailing-debounced persist (P1), mirroring the bracket save
   * debounce (BracketHandler.scheduleDebouncedSave): each mutation re-arms a
   * single timer, so a sustained burst postpones the write until 600ms after
   * the last point. Only ONE timer object ever exists — no unbounded queue.
   * The timer is unref'd so it never keeps the process alive on its own.
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
   * Flush any pending debounced persist immediately (P1). Used on graceful
   * shutdown so a rolling match never loses its last points, and for
   * discrete lifecycle mutations (delete / PIN regen) that must persist now.
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
   * Persist LIVE/FINISHED tournament courts and OCCUPIED/FINISHED club courts
   * to the state store in v3 format with separate arrays.
   * Tournament courts use `status` as discriminator; club courts use `clubStatus`.
   * Errors are caught and logged — the caller is never affected.
   */
  private persistState(): void {
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
        history: (s.history || []).slice(-MAX_HISTORY_LENGTH).map((h: any) => ({
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
      // PR 2 risk fix (a) — persist sessionMode so a mid-session server
      // restart does not lose free/match context.
      sessionMode: court.sessionMode,
      // player-identity (Phase 2 task 2.2) — persist the player info
      // captured at session-start so a mid-session restart can keep
      // showing the player on the kiosk and rebuild the SessionRecord
      // correctly if the session ends after a restart. Matches the
      // sessionMode loader-plugin pattern: legacy v3 files written
      // before these fields existed fall back to null via `?? null` in
      // restoreState.
      playerName: court.playerName,
      phone: court.phone,
      adminId: court.adminId,
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
  public restoreState(): boolean {
    if (!this.stateStore) {
      logger.warn('CourtManager.restoreState: no StateStore configured');
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
      // Axis split (INV-4): a flow whose courtId has no inventory catalog
      // record is DROPPED — no ghost sessions (design D1 restore).
      if (!this.hasCatalogRecord(pt.id)) {
        logger.info({ courtId: pt.id }, 'restoreState: dropped tournament flow — no inventory catalog record');
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
          'CourtManager.restoreState: failed to restore tournament court, skipping',
        );
      }
    }

    // Restore club courts
    for (const pt of persisted.clubCourts) {
      if (pt.clubStatus !== 'OCCUPIED' && pt.clubStatus !== 'FINISHED') {
        continue;
      }
      // Axis split (INV-4): drop flows without an inventory catalog record
      // (no ghost sessions, design D1 restore).
      if (!this.hasCatalogRecord(pt.id)) {
        logger.info({ courtId: pt.id }, 'restoreState: dropped club flow — no inventory catalog record');
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
          // PR 2 risk fix (a) — restore persisted sessionMode; legacy v3
          // files written before this field existed fall back to null.
          sessionMode: (pt as PersistedClubCourt).sessionMode ?? null,
          // player-identity — restore persisted player fields; legacy v3
          // files written before these fields existed fall back to null.
          playerName: (pt as PersistedClubCourt).playerName ?? null,
          phone: (pt as PersistedClubCourt).phone ?? null,
          adminId: (pt as PersistedClubCourt).adminId ?? null,
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
          'CourtManager.restoreState: failed to restore club court, skipping',
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
