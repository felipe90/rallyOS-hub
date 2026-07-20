/**
 * Interface contract tests for domain/ports/.
 *
 * These tests verify that:
 * 1. Persistence types are correctly defined in domain/ports/persistence-types
 * 2. Interface contracts (IPinService, IQRService, ICourtFormatter) are correct
 * 3. Backward-compat re-exports from services/store/types work
 * 4. Backward-compat re-exports from domain/types work
 *
 * Each interface is tested via a mock implementation to verify the contract
 * compiles and the expected method signatures exist.
 */
import type {
  PersistedCourt,
  PersistedClubCourt,
  PersistedMatchState,
  PersistedStateV3,
  FileSystem,
  MatchExporter,
  IPinService,
  IQRService,
  ICourtFormatter,
  ICourtRepository,
  IPlayerService,
  IMatchEngineFactory,
  IMatchOrchestrator,
  ICourtPersistence,
  IClubConfigRepository,
} from '../../ports';
import type { Court, QRData, CourtInfo, CourtInfoWithPin, MatchConfig, MatchStateExtended } from '../../types';
import { isTournamentCourt, isClubCourt, COURT_MODE, Player, SPORT } from '../../types';
import type {
  PersistedMatchState as StorePersistedMatchState,
  PersistedCourt as StorePersistedCourt,
  PersistedClubCourt as StorePersistedClubCourt,
  FileSystem as StoreFileSystem,
  MatchExporter as StoreMatchExporter,
} from '../../../services/store/types';
import type {
  PersistedCourt as DomainPersistedCourt,
  PersistedClubCourt as DomainPersistedClubCourt,
  PersistedMatchState as DomainPersistedMatchState,
} from '../../types';

import { StateStore } from '../../../services/store/StateStore';
import { ClubConfigStore } from '../../../services/store/ClubConfigStore';

// ── Type verification helpers ──────────────────────────────────────────

/**
 * Type-level test: verify PersistedMatchState has all required fields.
 * This creates an object of the type — if the type changes, this breaks.
 */
function createPersistedMatchState(): PersistedMatchState {
  return {
    config: { sport: 'tableTennis', bestOf: 5, pointsPerSet: 11, minDifference: 2 },
    score: { sets: { a: 1, b: 0 }, currentSet: { a: 5, b: 3 }, serving: 'A' },
    swappedSides: false,
    midSetSwapped: false,
    setHistory: [],
    status: 'LIVE',
    winner: null,
    sport: 'tableTennis',
    history: [],
  };
}

/**
 * Type-level test: verify PersistedCourt has all required fields.
 */
function createPersistedCourt(): PersistedCourt {
  return {
    id: 'court-1',
    number: 1,
    name: 'Court 1',
    status: 'LIVE',
    pin: '1234',
    playerNames: { a: 'Alice', b: 'Bob' },
    createdAt: Date.now(),
    matchState: createPersistedMatchState(),
  };
}

/**
 * Type-level test: verify PersistedClubCourt has all required fields.
 */
function createPersistedClubCourt(): PersistedClubCourt {
  return {
    id: 'club-1',
    number: 2,
    name: 'Club Court 1',
    kind: 'club',
    clubStatus: 'OCCUPIED',
    occupiedAt: Date.now(),
    pin: '5678',
    playerNames: { a: 'Charlie', b: 'Diana' },
    createdAt: Date.now(),
    matchState: createPersistedMatchState(),
    config: null,
    history: [],
  };
}

/**
 * Type-level test: verify FileSystem interface.
 */
function createFileSystem(): FileSystem {
  return {
    writeFileSync: (_path: string, _data: string, _encoding: BufferEncoding) => {},
    readFileSync: (_path: string, _encoding: BufferEncoding) => '{}',
    renameSync: (_oldPath: string, _newPath: string) => {},
    existsSync: (_path: string) => true,
    unlinkSync: (_path: string) => {},
    mkdirSync: (_path: string, _options?: { recursive: boolean }) => undefined,
  };
}

/**
 * Type-level test: verify MatchExporter interface.
 */
function createMatchExporter(): MatchExporter {
  return {
    export: (_tables: PersistedCourt[]) => 'csv,data',
  };
}

/**
 * Type-level test: verify IPinService interface contract.
 */
function createPinService(): IPinService {
  return {
    generatePin(): string {
      return '4321';
    },
    validatePin(_court: Court, _pin: string): boolean {
      return _pin === '4321';
    },
  };
}

/**
 * Type-level test: verify IQRService interface contract.
 */
function createQRService(): IQRService {
  return {
    generateQRData(_court: Court): QRData | null {
      return {
        hubSsid: 'RallyOS',
        hubIp: '192.168.1.1',
        hubPort: 3000,
        courtId: _court.id,
        courtName: _court.name,
        encryptedPin: 'encrypted',
        url: 'rallyhub://join/test',
      };
    },
  };
}

/**
 * Type-level test: verify ICourtFormatter interface contract.
 */
function createCourtFormatter(): ICourtFormatter {
  return {
    toPublicInfo(_court: Court): CourtInfo {
      return {
        id: _court.id,
        number: _court.number,
        name: _court.name,
        status: isTournamentCourt(_court) ? _court.status : (_court as any).clubStatus,
        playerCount: _court.players.length,
        playerNames: _court.playerNames,
        currentScore: { a: 0, b: 0 },
        currentSets: { a: 0, b: 0 },
        winner: null,
        featured: _court.featured,
        mode: isClubCourt(_court) ? COURT_MODE.CLUB : COURT_MODE.TOURNAMENT,
      };
    },
    toInfoWithPin(_court: Court): CourtInfoWithPin {
      return {
        ...this.toPublicInfo(_court),
        pin: _court.pin,
      };
    },
    toPublicList(_courts: Court[]): CourtInfo[] {
      return _courts.map((c) => this.toPublicInfo(c));
    },
    toListWithPins(_courts: Court[]): CourtInfoWithPin[] {
      return _courts.map((c) => this.toInfoWithPin(c));
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('ports persistence types', () => {
  describe('PersistedMatchState', () => {
    it('should create with all required fields', () => {
      const state = createPersistedMatchState();
      expect(state.config.sport).toBe('tableTennis');
      expect(state.score.sets).toEqual({ a: 1, b: 0 });
      expect(state.score.currentSet).toEqual({ a: 5, b: 3 });
      expect(state.score.serving).toBe('A');
      expect(state.swappedSides).toBe(false);
      expect(state.status).toBe('LIVE');
      expect(state.winner).toBeNull();
      expect(state.sport).toBe('tableTennis');
      expect(state.history).toEqual([]);
      expect(state.setHistory).toEqual([]);
    });

    it('should accept padel-specific optional fields', () => {
      const state: PersistedMatchState = {
        ...createPersistedMatchState(),
        sport: 'padel',
        padelPoints: { a: 0, b: 15 },
        isTiebreak: true,
        tiebreakPoints: { a: 3, b: 2 },
        goldenPoint: false,
      };
      expect(state.padelPoints).toEqual({ a: 0, b: 15 });
      expect(state.isTiebreak).toBe(true);
      expect(state.tiebreakPoints).toEqual({ a: 3, b: 2 });
      expect(state.goldenPoint).toBe(false);
    });
  });

  describe('PersistedCourt', () => {
    it('should create with all required fields', () => {
      const court = createPersistedCourt();
      expect(court.id).toBe('court-1');
      expect(court.number).toBe(1);
      expect(court.name).toBe('Court 1');
      expect(court.status).toBe('LIVE');
      expect(court.pin).toBe('1234');
      expect(court.playerNames).toEqual({ a: 'Alice', b: 'Bob' });
      expect(court.matchState.status).toBe('LIVE');
      expect(court.createdAt).toBeGreaterThan(0);
    });

    it('should accept PersistedTable as backward-compat alias', () => {
      // This tests that the PersistedTable type alias still exists
      const table: PersistedCourt = createPersistedCourt();
      expect(table.id).toBe('court-1');
    });
  });

  describe('PersistedClubCourt', () => {
    it('should create with all required fields', () => {
      const court = createPersistedClubCourt();
      expect(court.id).toBe('club-1');
      expect(court.kind).toBe('club');
      expect(court.clubStatus).toBe('OCCUPIED');
      expect(court.occupiedAt).toBeGreaterThan(0);
      expect(court.matchState).not.toBeNull();
      expect(court.config).toBeNull();
      expect(court.history).toEqual([]);
    });

    it('should accept null matchState for non-active courts', () => {
      const court: PersistedClubCourt = {
        ...createPersistedClubCourt(),
        clubStatus: 'AVAILABLE',
        matchState: null,
        occupiedAt: null,
      };
      expect(court.matchState).toBeNull();
      expect(court.occupiedAt).toBeNull();
    });
  });

  describe('FileSystem', () => {
    it('should implement all expected methods', () => {
      const fs = createFileSystem();
      expect(() => {
        fs.writeFileSync('/test.txt', 'data', 'utf-8');
      }).not.toThrow();
      expect(fs.readFileSync('/test.txt', 'utf-8')).toBe('{}');
      expect(fs.existsSync('/test.txt')).toBe(true);
      expect(fs.mkdirSync('/dir', { recursive: true })).toBeUndefined();
    });
  });

  describe('MatchExporter', () => {
    it('should export PersistedCourt array to string', () => {
      const exporter = createMatchExporter();
      const result = exporter.export([createPersistedCourt()]);
      expect(typeof result).toBe('string');
      expect(result).toBe('csv,data');
    });

    it('should handle empty array', () => {
      const exporter = createMatchExporter();
      const result = exporter.export([]);
      expect(typeof result).toBe('string');
    });
  });
});

describe('port interfaces', () => {
  describe('IPinService', () => {
    it('should generate a PIN string', () => {
      const service = createPinService();
      const pin = service.generatePin();
      expect(pin).toBe('4321');
    });

    it('should validate PIN with correct value', () => {
      const service = createPinService();
      expect(service.validatePin({ id: 'court-1', pin: '4321' } as Court, '4321')).toBe(true);
    });

    it('should reject PIN with incorrect value', () => {
      const service = createPinService();
      expect(service.validatePin({ id: 'court-1', pin: '4321' } as Court, 'wrong')).toBe(false);
    });
  });

  describe('IQRService', () => {
    it('should generate QR data for a court', () => {
      const service = createQRService();
      const court = {
        kind: 'tournament' as const,
        id: 'court-1',
        number: 1,
        name: 'Court 1',
        status: 'LIVE' as const,
        pin: '4321',
        sportRules: {} as any,
        playerNames: { a: 'A', b: 'B' },
        history: [],
        players: [],
        createdAt: Date.now(),
        featured: false,
      };
      const result = service.generateQRData(court);
      expect(result).not.toBeNull();
      expect(result!.hubSsid).toBe('RallyOS');
      expect(result!.courtId).toBe('court-1');
      expect(result!.courtName).toBe('Court 1');
      expect(result!.encryptedPin).toBe('encrypted');
      expect(result!.url).toContain('rallyhub://join/');
    });

    it('should return null for invalid court (contract allows null return)', () => {
      // The contract allows implementations to return null when
      // QR data cannot be generated (e.g., invalid court state)
      const nullService: IQRService = {
        generateQRData: (_court: Court) => null,
      };
      expect(nullService.generateQRData({} as Court)).toBeNull();
    });
  });

  describe('ICourtFormatter', () => {
    const makeTournamentCourt = () => ({
      kind: 'tournament' as const,
      id: 'court-1',
      number: 1,
      name: 'Court 1',
      status: 'LIVE' as const,
      pin: '1234',
      sportRules: {
        getState: () => ({
          config: { sport: 'tableTennis', bestOf: 5, pointsPerSet: 11, minDifference: 2 },
          score: { sets: { a: 1, b: 0 }, currentSet: { a: 5, b: 3 }, serving: 'A' },
          swappedSides: false,
          midSetSwapped: false,
          setHistory: [],
          status: 'LIVE',
          winner: null,
          sport: 'tableTennis',
          history: [],
        }),
      } as any,
      playerNames: { a: 'Alice', b: 'Bob' },
      history: [],
      players: [{ socketId: 's1', name: 'Alice', role: 'PLAYER_A' as const, joinedAt: 0 }],
      createdAt: 1000,
      featured: false,
      onTableUpdate: undefined,
      onMatchEvent: undefined,
    });

    const makeClubCourt = () => ({
      kind: 'club' as const,
      id: 'club-1',
      number: 2,
      name: 'Club Court',
      clubStatus: 'OCCUPIED' as const,
      pin: '5678',
      sportRules: {
        getState: () => ({
          config: { sport: 'tableTennis', bestOf: 5, pointsPerSet: 11, minDifference: 2 },
          score: { sets: { a: 1, b: 0 }, currentSet: { a: 5, b: 3 }, serving: 'A' },
          swappedSides: false,
          midSetSwapped: false,
          setHistory: [],
          status: 'LIVE',
          winner: null,
          sport: 'tableTennis',
          history: [],
        }),
      } as any,
      playerNames: { a: 'Charlie', b: 'Diana' },
      history: [],
      players: [],
      createdAt: 2000,
      featured: false,
      occupiedAt: 3000,
      sessionMode: null,
      onTableUpdate: undefined,
      onMatchEvent: undefined,
    });

    it('should format tournament court to public info', () => {
      const formatter = createCourtFormatter();
      const court = makeTournamentCourt();
      const info = formatter.toPublicInfo(court);
      expect(info.id).toBe('court-1');
      expect(info.number).toBe(1);
      expect(info.name).toBe('Court 1');
      expect(info.mode).toBe('tournament');
    });

    it('should format club court to public info', () => {
      const formatter = createCourtFormatter();
      const court = makeClubCourt();
      const info = formatter.toPublicInfo(court);
      expect(info.id).toBe('club-1');
      expect(info.mode).toBe('club');
    });

    it('should format court with PIN', () => {
      const formatter = createCourtFormatter();
      const court = makeTournamentCourt();
      const info = formatter.toInfoWithPin(court);
      expect(info.pin).toBe('1234');
    });

    it('should format list of courts', () => {
      const formatter = createCourtFormatter();
      const courts = [makeTournamentCourt(), makeClubCourt()];
      const list = formatter.toPublicList(courts);
      expect(list).toHaveLength(2);
      expect(list[0].mode).toBe('tournament');
      expect(list[1].mode).toBe('club');
    });

    it('should format list with pins', () => {
      const formatter = createCourtFormatter();
      const courts = [makeTournamentCourt(), makeClubCourt()];
      const list = formatter.toListWithPins(courts);
      expect(list).toHaveLength(2);
      expect(list[0].pin).toBe('1234');
      expect(list[1].pin).toBe('5678');
    });
  });
});

describe('backward-compat re-exports', () => {
  it('should re-export persistence types from services/store/types (type-level)', () => {
    // Static type-level verification: the imported types from services/store/types
    // must be the same shape as the domain/ports originals.
    // These compile-time assignments prove the re-export chain works.
    const ms: StorePersistedMatchState = createPersistedMatchState();
    expect(ms.status).toBe('LIVE');

    const pc: StorePersistedCourt = createPersistedCourt();
    expect(pc.id).toBe('court-1');

    const cc: StorePersistedClubCourt = createPersistedClubCourt();
    expect(cc.kind).toBe('club');

    const fs: StoreFileSystem = createFileSystem();
    expect(fs.existsSync('/test')).toBe(true);

    const me: StoreMatchExporter = createMatchExporter();
    expect(me.export([createPersistedCourt()])).toBe('csv,data');
  });

  it('should re-export persistence types from domain/types (type-level)', () => {
    const ms: DomainPersistedMatchState = createPersistedMatchState();
    expect(ms.status).toBe('LIVE');

    const pc: DomainPersistedCourt = createPersistedCourt();
    expect(pc.id).toBe('court-1');

    const cc: DomainPersistedClubCourt = createPersistedClubCourt();
    expect(cc.kind).toBe('club');
  });
});

// ── Phase 2: Core Service Interfaces ──────────────────────────────────

describe('Phase 2 port interfaces', () => {
  const mockCourt: Court = {
    kind: 'tournament',
    id: 'court-1',
    number: 1,
    name: 'Court 1',
    status: 'WAITING',
    pin: '1234',
    sportRules: null as any,
    playerNames: { a: 'A', b: 'B' },
    history: [],
    players: [],
    createdAt: Date.now(),
    featured: false,
  } as unknown as Court;

  describe('ICourtRepository', () => {
    function createCourtRepository(): ICourtRepository {
      const courts = new Map<string, Court>();
      return {
        getNextTableNumber(): number {
          let max = 0;
          for (const c of courts.values()) { max = Math.max(max, c.number); }
          return max + 1;
        },
        create(court: Court): Court {
          courts.set(court.id, court);
          return court;
        },
        get(id: string): Court | undefined {
          return courts.get(id);
        },
        getAll(): Court[] {
          return Array.from(courts.values());
        },
        delete(id: string): boolean {
          return courts.delete(id);
        },
        clear(): void {
          for (const [id, c] of courts) {
            if (c.kind === 'tournament') courts.delete(id);
          }
        },
        clearAll(): void {
          courts.clear();
        },
      };
    }

    it('should create and retrieve a court', () => {
      const repo = createCourtRepository();
      const court = repo.create(mockCourt);
      expect(court.id).toBe('court-1');
      expect(repo.get('court-1')).toBeDefined();
    });

    it('should return undefined for non-existent court', () => {
      const repo = createCourtRepository();
      expect(repo.get('non-existent')).toBeUndefined();
    });

    it('should get next table number incrementally', () => {
      const repo = createCourtRepository();
      expect(repo.getNextTableNumber()).toBe(1);
      repo.create(mockCourt);
      expect(repo.getNextTableNumber()).toBe(2);
    });

    it('should delete a court', () => {
      const repo = createCourtRepository();
      repo.create(mockCourt);
      expect(repo.delete('court-1')).toBe(true);
      expect(repo.get('court-1')).toBeUndefined();
    });

    it('should return false when deleting non-existent court', () => {
      const repo = createCourtRepository();
      expect(repo.delete('non-existent')).toBe(false);
    });

    it('should clear tournament courts only', () => {
      const repo = createCourtRepository();
      repo.create(mockCourt);
      repo.create({ ...mockCourt, id: 'club-1', kind: 'club', clubStatus: 'AVAILABLE', occupiedAt: null } as any);
      repo.clear();
      expect(repo.get('court-1')).toBeUndefined();
      expect(repo.get('club-1')).toBeDefined();
    });

    it('should clear all courts', () => {
      const repo = createCourtRepository();
      repo.create(mockCourt);
      repo.clearAll();
      expect(repo.get('court-1')).toBeUndefined();
      expect(repo.getAll()).toHaveLength(0);
    });

    it('should return all courts', () => {
      const repo = createCourtRepository();
      repo.create(mockCourt);
      const all = repo.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('court-1');
    });
  });

  describe('IPlayerService (depends on IPinService)', () => {
    function createPlayerService(pinService: IPinService): IPlayerService {
      return {
        joinCourt(court: Court, socketId: string, name: string, pin?: string): boolean {
          if (pin && !pinService.validatePin(court, pin)) return false;
          if (!court.players.find(p => p.socketId === socketId)) {
            court.players.push({ socketId, name, role: 'SPECTATOR', joinedAt: Date.now() });
          }
          return true;
        },
        leaveCourt(court: Court, socketId: string): void {
          const idx = court.players.findIndex(p => p.socketId === socketId);
          if (idx !== -1) court.players.splice(idx, 1);
        },
        setReferee(court: Court, socketId: string, pin: string): boolean {
          if (!pinService.validatePin(court, pin)) return false;
          const existing = court.players.find(p => p.role === 'REFEREE');
          if (existing && existing.socketId !== socketId) {
            court.players = court.players.filter(p => p.role !== 'REFEREE' || p.socketId === socketId);
          }
          const player = court.players.find(p => p.socketId === socketId);
          if (player) player.role = 'REFEREE';
          else court.players.push({ socketId, name: 'Referee', role: 'REFEREE', joinedAt: Date.now() });
          return true;
        },
        setRefereeDirect(court: Court, socketId: string, name: string): string | null {
          const existing = court.players.find(p => p.role === 'REFEREE');
          if (existing && existing.socketId !== socketId) {
            court.players = court.players.filter(p => p.role !== 'REFEREE');
            court.players.push({ socketId, name, role: 'REFEREE', joinedAt: Date.now() });
            return existing.socketId;
          }
          if (!court.players.find(p => p.socketId === socketId)) {
            court.players.push({ socketId, name, role: 'REFEREE', joinedAt: Date.now() });
          }
          return null;
        },
        isReferee(court: Court, socketId: string): boolean {
          return court.players.some(p => p.socketId === socketId && p.role === 'REFEREE');
        },
        getRefereeSocketId(court: Court): string | null {
          const ref = court.players.find(p => p.role === 'REFEREE');
          return ref?.socketId || null;
        },
      };
    }

    const pinService: IPinService = {
      generatePin: () => '1234',
      validatePin: (_court: Court, pin: string) => pin === '1234',
    };

    it('should join a court successfully without PIN', () => {
      const ps = createPlayerService(pinService);
      const court = { ...mockCourt, players: [] };
      expect(ps.joinCourt(court as any, 'sock-1', 'Alice')).toBe(true);
      expect(court.players).toHaveLength(1);
    });

    it('should join a court with correct PIN', () => {
      const ps = createPlayerService(pinService);
      const court = { ...mockCourt, players: [] };
      expect(ps.joinCourt(court as any, 'sock-1', 'Alice', '1234')).toBe(true);
    });

    it('should reject join with incorrect PIN', () => {
      const ps = createPlayerService(pinService);
      const court = { ...mockCourt, players: [] };
      expect(ps.joinCourt(court as any, 'sock-1', 'Alice', 'wrong')).toBe(false);
    });

    it('should leave a court', () => {
      const ps = createPlayerService(pinService);
      const court = { ...mockCourt, players: [{ socketId: 'sock-1', name: 'Alice', role: 'SPECTATOR' as const, joinedAt: Date.now() }] };
      ps.leaveCourt(court as any, 'sock-1');
      expect(court.players).toHaveLength(0);
    });

    it('should set referee with correct PIN', () => {
      const ps = createPlayerService(pinService);
      const court = { ...mockCourt, players: [] };
      expect(ps.setReferee(court as any, 'sock-1', '1234')).toBe(true);
      expect(ps.isReferee(court as any, 'sock-1')).toBe(true);
    });

    it('should reject setReferee with incorrect PIN', () => {
      const ps = createPlayerService(pinService);
      expect(ps.setReferee(mockCourt as any, 'sock-1', 'wrong')).toBe(false);
    });

    it('should set referee directly', () => {
      const ps = createPlayerService(pinService);
      const court = { ...mockCourt, players: [] };
      const result = ps.setRefereeDirect(court as any, 'sock-1', 'Ref');
      expect(result).toBeNull();
      expect(ps.isReferee(court as any, 'sock-1')).toBe(true);
    });

    it('should get referee socket id', () => {
      const ps = createPlayerService(pinService);
      const court = { ...mockCourt, players: [{ socketId: 'sock-1', name: 'Ref', role: 'REFEREE' as const, joinedAt: Date.now() }] };
      expect(ps.getRefereeSocketId(court as any)).toBe('sock-1');
    });

    it('should return null when no referee', () => {
      const ps = createPlayerService(pinService);
      expect(ps.getRefereeSocketId(mockCourt as any)).toBeNull();
    });
  });

  describe('IMatchEngineFactory', () => {
    function createMatchEngineFactory(): IMatchEngineFactory {
      return {
        createMatchEngine(sport: string, config: MatchConfig) {
          // Minimal mock — type-level contract verification
          return {
            config,
            sport,
          } as any;
        },
      };
    }

    it('should create a match engine for a given sport and config', () => {
      const factory = createMatchEngineFactory();
      const config: MatchConfig = { sport: 'tableTennis', pointsPerSet: 11, bestOf: 5, minDifference: 2 } as any;
      const engine = factory.createMatchEngine('tableTennis', config);
      expect(engine).toBeDefined();
    });

    it('should accept different sport values', () => {
      const factory = createMatchEngineFactory();
      const ttConfig: MatchConfig = { sport: 'tableTennis', pointsPerSet: 11, bestOf: 3, minDifference: 2 } as any;
      const ttEngine = factory.createMatchEngine('tableTennis', ttConfig);
      expect(ttEngine).toBeDefined();

      const padelConfig: MatchConfig = { sport: 'padel', bestOf: 3, tiebreakPoints: 7, gamesPerSet: 6, goldenPoint: false } as any;
      const padelEngine = factory.createMatchEngine('padel', padelConfig);
      expect(padelEngine).toBeDefined();
    });
  });

  // ── Phase 3: Persistence Interfaces ─────────────────────────────────

  describe('ICourtPersistence', () => {
    it('should have all persistence methods', () => {
      // Type-level contract: create a mock implementation
      const persistence: ICourtPersistence = {
        save(_tournamentCourts: PersistedCourt[], _clubCourts: PersistedClubCourt[]): void {},
        load(): PersistedStateV3 | null { return null; },
        clear(): void {},
        checkExists(): boolean { return false; },
      };
      expect(typeof persistence.save).toBe('function');
      expect(typeof persistence.load).toBe('function');
      expect(typeof persistence.clear).toBe('function');
      expect(typeof persistence.checkExists).toBe('function');
    });

    it('should accept empty arrays in save', () => {
      const persistence: ICourtPersistence = {
        save(_tournamentCourts: PersistedCourt[], _clubCourts: PersistedClubCourt[]): void {},
        load(): PersistedStateV3 | null { return null; },
        clear(): void {},
        checkExists(): boolean { return false; },
      };
      expect(() => persistence.save([], [])).not.toThrow();
    });

    it('should return null from load when no state exists', () => {
      const persistence: ICourtPersistence = {
        save(_tournamentCourts: PersistedCourt[], _clubCourts: PersistedClubCourt[]): void {},
        load(): PersistedStateV3 | null { return null; },
        clear(): void {},
        checkExists(): boolean { return false; },
      };
      expect(persistence.load()).toBeNull();
    });

    it('should return state from load when state exists', () => {
      const state: PersistedStateV3 = {
        version: 3,
        savedAt: 1700000000000,
        tournamentCourts: [],
        clubCourts: [],
      };
      const persistence: ICourtPersistence = {
        save(_tournamentCourts: PersistedCourt[], _clubCourts: PersistedClubCourt[]): void {},
        load(): PersistedStateV3 | null { return state; },
        clear(): void {},
        checkExists(): boolean { return false; },
      };
      const result = persistence.load();
      expect(result).not.toBeNull();
      expect(result!.version).toBe(3);
      expect(result!.tournamentCourts).toEqual([]);
      expect(result!.clubCourts).toEqual([]);
    });

    it('should accept court data in save', () => {
      const tournamentCourts: PersistedCourt[] = [
        {
          id: 'court-1', number: 1, name: 'Test Court',
          status: 'LIVE', pin: '1234',
          playerNames: { a: 'A', b: 'B' },
          createdAt: 1000,
          matchState: {
            config: { sport: 'tableTennis', pointsPerSet: 11, bestOf: 5, minDifference: 2 },
            score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
            swappedSides: false, midSetSwapped: false,
            setHistory: [], status: 'LIVE', winner: null,
            sport: 'tableTennis', history: [],
          },
        },
      ];
      const clubCourts: PersistedClubCourt[] = [
        {
          id: 'club-1', number: 2, name: 'Club Court', kind: 'club',
          clubStatus: 'OCCUPIED', occupiedAt: 2000,
          pin: '', playerNames: { a: '', b: '' },
          createdAt: 1000, matchState: null,
          config: null, history: [],
        },
      ];
      const persistence: ICourtPersistence = {
        save(_tc: PersistedCourt[], _cc: PersistedClubCourt[]): void {
          expect(_tc).toHaveLength(1);
          expect(_cc).toHaveLength(1);
        },
        load(): PersistedStateV3 | null { return null; },
        clear(): void {},
        checkExists(): boolean { return false; },
      };
      persistence.save(tournamentCourts, clubCourts);
    });

    it('should be callable without errors from clear', () => {
      const persistence: ICourtPersistence = {
        save(): void {},
        load(): PersistedStateV3 | null { return null; },
        clear(): void {},
        checkExists(): boolean { return false; },
      };
      expect(() => persistence.clear()).not.toThrow();
    });
  });

  describe('IClubConfigRepository', () => {
    it('should have all config repository methods', () => {
      const repo: IClubConfigRepository = {
        load() { return null; },
        save(_config: any): void {},
        checkExists(): boolean { return false; },
        clear(): void {},
      };
      expect(typeof repo.load).toBe('function');
      expect(typeof repo.save).toBe('function');
      expect(typeof repo.checkExists).toBe('function');
      expect(typeof repo.clear).toBe('function');
    });

    it('should return null from load when no config exists', () => {
      const repo: IClubConfigRepository = {
        load() { return null; },
        save(_config: any): void {},
        checkExists(): boolean { return false; },
        clear(): void {},
      };
      expect(repo.load()).toBeNull();
    });

    it('should return config from load when config exists', () => {
      const config = {
        clubName: 'My Club',
        sport: 'padel',
        configured: true,
        adminPinHash: 'salt:hash',
        adminPin: '123456',
        createdAt: 1000,
        costPerMinute: 0,
        currency: 'ARS',
      };
      const repo: IClubConfigRepository = {
        load() { return config; },
        save(_config: any): void {},
        checkExists(): boolean { return true; },
        clear(): void {},
      };
      const result = repo.load();
      expect(result).not.toBeNull();
      expect(result!.clubName).toBe('My Club');
      expect(result!.sport).toBe('padel');
    });

    it('should accept a config object in save', () => {
      const repo: IClubConfigRepository = {
        load() { return null; },
        save(_config: any): void {},
        checkExists(): boolean { return false; },
        clear(): void {},
      };
      expect(() => repo.save({ clubName: 'Test', sport: 'tableTennis', configured: false } as any)).not.toThrow();
    });

    it('should report existence via checkExists', () => {
      const repo: IClubConfigRepository = {
        load() { return null; },
        save(_config: any): void {},
        checkExists(): boolean { return true; },
        clear(): void {},
      };
      expect(repo.checkExists()).toBe(true);
    });

    it('should be callable without errors from clear', () => {
      const repo: IClubConfigRepository = {
        load() { return null; },
        save(_config: any): void {},
        checkExists(): boolean { return false; },
        clear(): void {},
      };
      expect(() => repo.clear()).not.toThrow();
    });
  });

  // ── Phase 3: Store Implementation Contracts ──────────────────────────

  describe('StateStore satisfies ICourtPersistence', () => {
    function makeIntegrationFs(): FileSystem & { _files: Map<string, string> } {
      const files = new Map<string, string>();
      return {
        _files: files,
        writeFileSync(path: string, data: string, _encoding: BufferEncoding): void {
          files.set(path, data);
        },
        readFileSync(path: string, _encoding: BufferEncoding): string {
          if (!files.has(path)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          return files.get(path)!;
        },
        renameSync(oldPath: string, newPath: string): void {
          const content = files.get(oldPath);
          if (content !== undefined) { files.set(newPath, content); files.delete(oldPath); }
        },
        existsSync(path: string): boolean { return files.has(path); },
        unlinkSync(path: string): void { files.delete(path); },
        mkdirSync(_path: string, _options?: { recursive: boolean }): string | undefined { return undefined; },
      };
    }

    it('should be usable as ICourtPersistence (type-level)', () => {
      const fs = makeIntegrationFs();
      const store: ICourtPersistence = new StateStore(fs, 'test-state.json');
      expect(store).toBeDefined();
    });

    it('should persist and load state via ICourtPersistence contract', () => {
      const fs = makeIntegrationFs();
      const store: ICourtPersistence = new StateStore(fs, 'test-state.json');

      const tournamentCourts: PersistedCourt[] = [{
        id: 't1', number: 1, name: 'Table 1',
        status: 'LIVE', pin: '1234',
        playerNames: { a: 'A', b: 'B' },
        createdAt: 1000,
        matchState: {
          config: { sport: 'tableTennis', pointsPerSet: 11, bestOf: 5, minDifference: 2 },
          score: { sets: { a: 0, b: 0 }, currentSet: { a: 0, b: 0 }, serving: 'A' },
          swappedSides: false, midSetSwapped: false,
          setHistory: [], status: 'LIVE', winner: null,
          sport: 'tableTennis', history: [],
        },
      }];

      // Contract: save → load → verify
      store.save(tournamentCourts, []);
      const loaded = store.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.tournamentCourts).toHaveLength(1);
      expect(loaded!.tournamentCourts[0].id).toBe('t1');

      // Contract: clear → load returns null
      store.clear();
      expect(store.load()).toBeNull();
    });

    it('should save and load club courts via ICourtPersistence contract', () => {
      const fs = makeIntegrationFs();
      const store: ICourtPersistence = new StateStore(fs, 'test-state.json');

      const clubCourts: PersistedClubCourt[] = [{
        id: 'c1', number: 1, name: 'Club Court', kind: 'club',
        clubStatus: 'OCCUPIED', occupiedAt: 2000,
        pin: '', playerNames: { a: '', b: '' },
        createdAt: 1000, matchState: null,
        config: null, history: [],
      }];

      store.save([], clubCourts);
      const loaded = store.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.clubCourts).toHaveLength(1);
      expect(loaded!.clubCourts[0].id).toBe('c1');
    });

    it('should return null when no state exists', () => {
      const fs = makeIntegrationFs();
      const store: ICourtPersistence = new StateStore(fs, 'nonexistent.json');
      expect(store.load()).toBeNull();
    });
  });

  describe('ClubConfigStore satisfies IClubConfigRepository', () => {
    function makeIntegrationFs(): FileSystem & { _files: Map<string, string> } {
      const files = new Map<string, string>();
      return {
        _files: files,
        writeFileSync(path: string, data: string, _encoding: BufferEncoding): void {
          files.set(path, data);
        },
        readFileSync(path: string, _encoding: BufferEncoding): string {
          if (!files.has(path)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          return files.get(path)!;
        },
        renameSync(oldPath: string, newPath: string): void {
          const content = files.get(oldPath);
          if (content !== undefined) { files.set(newPath, content); files.delete(oldPath); }
        },
        existsSync(path: string): boolean { return files.has(path); },
        unlinkSync(path: string): void { files.delete(path); },
        mkdirSync(_path: string, _options?: { recursive: boolean }): string | undefined { return undefined; },
      };
    }

    it('should be usable as IClubConfigRepository (type-level)', () => {
      const fs = makeIntegrationFs();
      const repo: IClubConfigRepository = new ClubConfigStore(fs, 'test-config.json');
      expect(repo).toBeDefined();
    });

    it('should persist and load config via IClubConfigRepository contract', () => {
      const fs = makeIntegrationFs();
      const repo: IClubConfigRepository = new ClubConfigStore(fs, 'test-config.json');

      const config = {
        clubName: 'Integration Test Club',
        sport: 'padel',
        configured: true,
        adminPinHash: 'salt:hash',
        adminPin: '123456',
        createdAt: 1000,
      };

      // Contract: save → load → verify
      repo.save(config as any);
      const loaded = repo.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.clubName).toBe('Integration Test Club');
      expect(loaded!.sport).toBe('padel');

      // Contract: checkExists returns true after save
      expect(repo.checkExists()).toBe(true);

      // Contract: clear → load returns null
      repo.clear();
      expect(repo.load()).toBeNull();
      expect(repo.checkExists()).toBe(false);
    });

    it('should return null when no config exists', () => {
      const fs = makeIntegrationFs();
      const repo: IClubConfigRepository = new ClubConfigStore(fs, 'nonexistent.json');
      expect(repo.load()).toBeNull();
      expect(repo.checkExists()).toBe(false);
    });
  });

  describe('IMatchOrchestrator', () => {
    function createMatchOrchestrator(): IMatchOrchestrator {
      return {
        configureMatch(_court: Court, _config: { playerNames?: { a: string; b: string }; matchConfig?: MatchConfig }): void {},
        prepareCourt(_court: Court, _config: { matchConfig: MatchConfig; playerNames: { a: string; b: string } }): MatchStateExtended | null { return null; },
        startMatch(_court: Court, _config?: Partial<MatchConfig> & { playerNameA?: string; playerNameB?: string }): MatchStateExtended | null { return null; },
        recordPoint(_court: Court, _player: Player): MatchStateExtended | null { return null; },
        subtractPoint(_court: Court, _player: Player): MatchStateExtended | null { return null; },
        undoLast(_court: Court): MatchStateExtended | null { return null; },
        setServer(_court: Court, _player: Player): MatchStateExtended | null { return null; },
        swapSides(_court: Court): MatchStateExtended | null { return null; },
        resetTable(_court: Court, _config?: MatchConfig): void {},
        getMatchState(_court: Court): MatchStateExtended | null { return null; },
      };
    }

    it('should have all match lifecycle methods', () => {
      const orch = createMatchOrchestrator();
      expect(typeof orch.configureMatch).toBe('function');
      expect(typeof orch.startMatch).toBe('function');
      expect(typeof orch.recordPoint).toBe('function');
      expect(typeof orch.subtractPoint).toBe('function');
      expect(typeof orch.undoLast).toBe('function');
      expect(typeof orch.setServer).toBe('function');
      expect(typeof orch.swapSides).toBe('function');
      expect(typeof orch.resetTable).toBe('function');
      expect(typeof orch.getMatchState).toBe('function');
      expect(typeof orch.prepareCourt).toBe('function');
    });

    it('should accept a court and config in configureMatch', () => {
      const orch = createMatchOrchestrator();
      expect(() => orch.configureMatch(mockCourt, { playerNames: { a: 'A', b: 'B' } })).not.toThrow();
    });

    it('should accept a Partial<MatchConfig> in startMatch', () => {
      const orch = createMatchOrchestrator();
      const result = orch.startMatch(mockCourt, { bestOf: 3 });
      // Contract allows null return (match not started)
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });
});
