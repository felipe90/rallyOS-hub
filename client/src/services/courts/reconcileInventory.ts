/**
 * reconcileInventory — pure inventory + availability reconciliation (INV-6).
 *
 * The client keeps ONE catalog + availability view of every court instead of
 * two disconnected worlds (useCourtManagement vs useClubCourtManagement). This
 * pure service merges the four wire sources into a single list of
 * `InventoryCourtView` rows keyed by courtId:
 *
 *   - INVENTORY_UPDATED  → catalog (CourtRecord[]: identity + inventoryStatus)
 *   - CLUB_KIOSK_DATA    → club flows (ClubKioskCourtInfo[]: clubStatus, pin,
 *                          playerName, featured, sessionMode)
 *   - COURT_LIST         → tournament runtime courts (CourtInfo[]: status)
 *   - BRACKET_STATE      → bindings (match.courtId → BUSY, INV-4)
 *
 * Availability is DERIVED, never stored (INV-4): BUSY when the club flow is
 * OCCUPIED, the tournament court is LIVE, or a bracket match is bound to the
 * court; otherwise IDLE. Bridge-era runtime courts without a catalog record
 * are still listed (inCatalog=false) so live sessions never vanish from the
 * admin UI — the slice-1 bridge keeps catalog and runtime separate until the
 * RuntimeCourt conversion.
 *
 * Pure: no React, no socket, no I/O — unit-testable without mounting.
 */

import {
  AVAILABILITY,
  INVENTORY_STATUS,
  type Availability,
  type ClubKioskCourtInfo,
  type ClubStatus,
  type CourtInfo,
  type CourtRecord,
  type InventoryStatus,
  type SessionMode,
  type TournamentBracket,
  type TournamentStatus,
} from '@shared/types'

/** One reconciled row — a physical court with catalog + derived availability. */
export interface InventoryCourtView {
  courtId: string
  /** Monotonic display number (0 for bridge courts with no catalog record). */
  number: number
  /** Catalog name wins over runtime name (MP-2 — persisted names render as-is). */
  name: string
  inventoryStatus: InventoryStatus
  /** DERIVED (INV-4): BUSY when a live flow or bracket binding exists. */
  availability: Availability
  clubStatus?: ClubStatus
  /**
   * Runtime status from COURT_LIST — the wire type is TournamentStatus | ClubStatus
   * because the catalog list is mode-agnostic (a club-mode court reports its
   * ClubStatus here too). Consumers should prefer `clubStatus` (CLUB_KIOSK_DATA)
   * for club-mode courts.
   */
  tournamentStatus?: TournamentStatus | ClubStatus
  pin?: string
  playerName?: string
  featured?: boolean
  sessionMode?: SessionMode
  /** true when the court exists in the admin catalog (INVENTORY_UPDATED). */
  inCatalog: boolean
}

export interface InventoryReconcileInput {
  catalog: CourtRecord[]
  clubFlows: ClubKioskCourtInfo[]
  tournamentCourts: CourtInfo[]
  bracket: TournamentBracket | null
}

/** Distinct courtIds bound to bracket matches (match.courtId + third-place). */
export function boundCourtIds(bracket: TournamentBracket | null): string[] {
  if (!bracket) return []
  const ids: string[] = []
  for (const m of bracket.matches) {
    if (m.courtId) ids.push(m.courtId)
  }
  if (bracket.thirdPlaceMatch?.courtId) ids.push(bracket.thirdPlaceMatch.courtId)
  return ids
}

function deriveAvailability(
  clubStatus: string | undefined,
  tournamentStatus: TournamentStatus | ClubStatus | undefined,
  isBound: boolean,
): Availability {
  if (clubStatus === 'OCCUPIED' || tournamentStatus === 'LIVE' || isBound) {
    return AVAILABILITY.BUSY
  }
  return AVAILABILITY.IDLE
}

/**
 * Reconcile the four wire sources into one catalog + availability view.
 * Order: catalog records first (by number), then bridge-only runtime courts
 * (by name). One row per courtId — never two rows for the same physical court.
 */
export function reconcileInventory(input: InventoryReconcileInput): InventoryCourtView[] {
  const { catalog, clubFlows, tournamentCourts, bracket } = input
  const bound = new Set(boundCourtIds(bracket))
  const clubByCourt = new Map(clubFlows.map(c => [c.id, c]))
  const tournByCourt = new Map(tournamentCourts.map(c => [c.id, c]))

  const views: InventoryCourtView[] = []

  // 1. Catalog records (authoritative identity + inventory status).
  for (const record of catalog) {
    const club = clubByCourt.get(record.courtId)
    const tourn = tournByCourt.get(record.courtId)
    views.push({
      courtId: record.courtId,
      number: record.number,
      name: record.name,
      inventoryStatus: record.inventoryStatus,
      availability: deriveAvailability(club?.status, tourn?.status, bound.has(record.courtId)),
      clubStatus: club?.status as ClubStatus | undefined,
      tournamentStatus: tourn?.status,
      pin: club?.pin,
      playerName: club?.playerName,
      featured: club?.featured,
      sessionMode: club?.sessionMode,
      inCatalog: true,
    })
  }

  // 2. Bridge-era runtime courts with no catalog record (must not vanish).
  const known = new Set(catalog.map(c => c.courtId))
  for (const club of clubFlows) {
    if (known.has(club.id)) continue
    views.push({
      courtId: club.id,
      number: 0,
      name: club.name,
      inventoryStatus:
        club.status === 'MAINTENANCE' ? INVENTORY_STATUS.MAINTENANCE : INVENTORY_STATUS.ACTIVE,
      availability: deriveAvailability(club.status, undefined, bound.has(club.id)),
      clubStatus: club.status as ClubStatus | undefined,
      pin: club.pin,
      playerName: club.playerName,
      featured: club.featured,
      sessionMode: club.sessionMode,
      inCatalog: false,
    })
    known.add(club.id)
  }
  for (const tourn of tournamentCourts) {
    if (known.has(tourn.id)) continue
    views.push({
      courtId: tourn.id,
      number: 0,
      name: tourn.name,
      inventoryStatus: INVENTORY_STATUS.ACTIVE,
      availability: deriveAvailability(undefined, tourn.status, bound.has(tourn.id)),
      tournamentStatus: tourn.status,
      inCatalog: false,
    })
    known.add(tourn.id)
  }

  return views.sort((a, b) => a.number - b.number || a.name.localeCompare(b.name))
}
