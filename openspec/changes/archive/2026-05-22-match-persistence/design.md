# Design: Match Persistence & Tournament Lifecycle

## Technical Approach

Add **StateStore** for atomic JSON persistence to `data/rallyos-state.json`. Inject into `TableManager`, which triggers saves on `notifyUpdate()`. **No auto-restore on boot** — `TableManager` starts empty. Tournament lifecycle (load/new/finish) is controlled via HTTP endpoints + a post-login `TournamentResumeModal`. CSV export reuses `CsvExporter` (first `MatchExporter` adapter). HTTP auth via in-memory tournament token generated on `VERIFY_OWNER`.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Boot behavior | Auto-load / Empty + explicit | **Empty** | Owner controls restoration; corrupted state won't block boot |
| HTTP auth for /api/tournament/* | JWT / session / in-memory token | **In-memory token** | Zero deps; generated on VERIFY_OWNER, emitted in OWNER_VERIFIED, validated by Express middleware |
| Finish flow ordering | Clear→export / Export→clear | **Export before clear** | CSV must read data before StateStore.clear() deletes it |
| Archive format | Copy+delete / Atomic rename | **fs.rename()** | Same-filesystem rename is atomic; `data/archive/torneo-<ISO>.json` |

## StateStore Interface

```typescript
class StateStore {
  constructor(filePath?: string);  // default: data/rallyos-state.json
  save(tables: Table[]): void;     // LIVE+FINISHED only, atomic tmp+rename
  load(): PersistedTable[];        // [] on missing/corrupt
  checkExists(): boolean;          // file exists AND has non-empty tables
  clear(): void;                   // deletes state file
  archive(): string;               // rename→data/archive/torneo-<ISO>.json, returns path
}
```

## TableManager Changes

```typescript
class TableManager {
  constructor(hubConfig: HubConfig, stateStore?: StateStore);  // starts empty
  loadTournament(): boolean;  // stateStore.load() → fromState() per table → wire callbacks
}
```

`notifyUpdate(table)` calls `stateStore.save()` when stateStore is defined. `loadTournament()` returns false if no persisted state exists.

## Data Flow

```
BOOT:     TableManager starts EMPTY
LOGIN:    VERIFY_OWNER → generate tournamentToken → emit in OWNER_VERIFIED
STATUS:   Client GET /api/tournament/status → {exists, matchCount}
          → exists=true → TournamentResumeModal (Load | New)
          → exists=false → straight to dashboard
LOAD:     POST /api/tournament/load → StateStore.load()
            → MatchEngine.fromState() per table → wire callbacks → notifyUpdate
NEW:      POST /api/tournament/new → StateStore.clear()
FINISH:   Client shows ConfirmDialog (Exportar CSV checkbox)
            → if checked: GET /api/export/matches.csv (download)
            → POST /api/tournament/finish → archive() → clear()
```

## New HTTP Endpoints

All require `Authorization: Bearer <token>` header (validated by ownerAuth middleware).

| Endpoint | Method | Response |
|----------|--------|----------|
| `/api/tournament/status` | GET | `{exists, matchCount, lastSaved}` |
| `/api/tournament/load` | POST | `200` with restored table count / `409` if no state |
| `/api/tournament/new` | POST | `200` (idempotent) |
| `/api/tournament/finish` | POST | `200` / `409` if no active tournament |
| `/api/export/matches.csv` | GET | `text/csv` with FINISHED tables only |

## Auth Token Flow

```
AuthHandler.VERIFY_OWNER success:
  1. Generate crypto.randomUUID() → store in module-level activeTokens Set
  2. Emit { token: 'owner-session', tournamentToken: '<uuid>' }

ownerAuthMiddleware:
  - Reads `Authorization: Bearer <token>` header
  - activeTokens.has(token) → next()
  - Otherwise → 401

Token cleanup: server restart clears Set (re-auth required — acceptable for plug-and-play)
```

## Client Components

**TournamentResumeModal** (new molecule): Self-contained modal, blocks dismissal. Shows match count from status endpoint. Two buttons — Load (POST /load) or New (POST /new) — then navigates to dashboard.

**useAuthFlow.ts**: `handleOwnerVerified` stores `tournamentToken`, fetches `/api/tournament/status`. If `exists`, blocks navigation with modal; otherwise goes straight to dashboard.

**OwnerDashboardPage**: "Finalizar Torneo" button (Trophy icon) → ConfirmDialog with "Exportar CSV" checkbox (default checked). Confirm runs sequential: export (if checked) → POST /finish → reload. Empty state when no tables.

## File Changes

| File | Action |
|------|--------|
| `server/src/services/store/StateStore.ts` | **Create** |
| `server/src/services/store/types.ts` | **Create** |
| `server/src/services/store/CsvExporter.ts` | **Create** |
| `server/src/middleware/ownerAuth.ts` | **Create** |
| `server/src/routes/tournament.ts` | **Create** |
| `server/src/domain/matchEngine.ts` | Modify — add `fromState()` |
| `server/src/domain/tableManager.ts` | Modify — stateStore param, loadTournament(), save in notifyUpdate |
| `server/src/index.ts` | Modify — bootstrap StateStore, pass to TableManager |
| `server/src/app.ts` | Modify — mount routes, add auth middleware |
| `server/src/handlers/AuthHandler.ts` | Modify — generate tournamentToken |
| `client/src/pages/AuthPage/AuthPage.tsx` + `useAuthFlow.ts` | Modify |
| `client/src/components/molecules/TournamentResumeModal/` | **Create** |
| `client/src/pages/OwnerDashboardPage/OwnerDashboardPage.tsx` | Modify |
| `docker-compose.yml` | Modify — `./data:/app/data` volume |
| `scripts/dev.sh` | Modify — `mkdir -p data/ data/archive/` |
| `.gitignore` | Modify — add data/ paths |

## Error Handling

| Scenario | HTTP | Behavior |
|----------|------|----------|
| Missing/invalid token | 401 | Return JSON error |
| Load with no state file | 409 | "No hay torneo previo" |
| Finish with no active tournament | 409 | "No hay torneo activo" |
| archive() fails (disk full) | 500 | Logged; data preserved |
| fromState() fails on one table | — | Skip table, log warning, continue |

## Testing Strategy

| Layer | Tests |
|-------|-------|
| **Unit** | StateStore all methods; corrupt→[]; fromState() round-trip; CsvExporter; auth middleware |
| **Integration** | POST /load restores PINs/scores/callbacks; /finish archives+clears; /export returns CSV; 401 on unauthenticated |
| **E2E** | Login→modal→Load→dashboard→Finish with CSV export |

## Open Questions

- [ ] Should tournamentToken persist across server restarts? Currently in-memory (lost on restart) — re-auth required. Acceptable for plug-and-play Orange Pi.
