/**
 * reconcileInventory tests — pure inventory + availability reconciliation
 * (admin-court-inventory slice 3, INV-6).
 *
 * The client hook (useCourtInventory) is a thin wiring layer over this pure
 * service: given the four wire sources (INVENTORY_UPDATED catalog,
 * CLUB_KIOSK_DATA club flows, COURT_LIST tournament courts, BRACKET_STATE
 * bindings) it produces one unified catalog + availability view per court.
 */

import { describe, it, expect } from 'vitest'
import { AVAILABILITY, INVENTORY_STATUS } from '@shared/types'
import type {
  ClubKioskCourtInfo,
  CourtInfo,
  CourtRecord,
  TournamentBracket,
} from '@shared/types'
import { reconcileInventory, boundCourtIds } from './reconcileInventory'

const rec = (courtId: string, over: Partial<CourtRecord> = {}): CourtRecord => ({
  courtId,
  number: 1,
  name: `Court ${courtId}`,
  inventoryStatus: INVENTORY_STATUS.ACTIVE,
  ...over,
})

const clubFlow = (id: string, status: string, over: Partial<ClubKioskCourtInfo> = {}): ClubKioskCourtInfo => ({
  id,
  name: `Club ${id}`,
  status,
  mode: 'club',
  ...over,
})

const tourn = (id: string, status: CourtInfo['status']): CourtInfo => ({
  id,
  number: 1,
  name: `Tourn ${id}`,
  status,
  playerCount: 0,
})

const bracketWith = (courtId: string | null): TournamentBracket => ({
  name: 'B1',
  numSlots: 4,
  includeThirdPlace: false,
  matches: [{ id: 'R1-M1', round: 1, position: 0, playerA: 'A', playerB: 'B', winner: null, status: 'READY', courtId }],
  thirdPlaceMatch: null,
  status: 'ACTIVE',
  createdAt: 0,
})

describe('boundCourtIds', () => {
  it('collects distinct bound courtIds from matches and the third-place match', () => {
    const b: TournamentBracket = {
      name: 'B1',
      numSlots: 4,
      includeThirdPlace: true,
      matches: [
        { id: 'R1-M1', round: 1, position: 0, playerA: 'A', playerB: 'B', winner: null, status: 'READY', courtId: 'c1' },
        { id: 'R1-M2', round: 1, position: 1, playerA: 'C', playerB: 'D', winner: null, status: 'READY', courtId: null },
        { id: 'R2-M1', round: 2, position: 0, playerA: 'A', playerB: null, winner: null, status: 'PENDING', courtId: 'c2' },
      ],
      thirdPlaceMatch: { id: 'TP-M1', round: 2, position: 1, playerA: null, playerB: null, winner: null, status: 'PENDING', courtId: 'c3' },
      status: 'ACTIVE',
      createdAt: 0,
    }
    expect(boundCourtIds(b)).toEqual(['c1', 'c2', 'c3'])
  })

  it('returns [] for a null bracket', () => {
    expect(boundCourtIds(null)).toEqual([])
  })
})

describe('reconcileInventory', () => {
  it('returns an empty list for an empty catalog and no runtime courts', () => {
    expect(reconcileInventory({ catalog: [], clubFlows: [], tournamentCourts: [], bracket: null })).toEqual([])
  })

  it('maps a catalog record with no runtime signals to ACTIVE + IDLE', () => {
    const views = reconcileInventory({
      catalog: [rec('c1')],
      clubFlows: [],
      tournamentCourts: [],
      bracket: null,
    })
    expect(views).toHaveLength(1)
    expect(views[0]).toMatchObject({
      courtId: 'c1',
      inventoryStatus: INVENTORY_STATUS.ACTIVE,
      availability: AVAILABILITY.IDLE,
      inCatalog: true,
    })
  })

  it('derives BUSY from a club OCCUPIED flow (club status wins over IDLE)', () => {
    const views = reconcileInventory({
      catalog: [rec('c1')],
      clubFlows: [clubFlow('c1', 'OCCUPIED', { playerName: 'Lucía', sessionMode: 'free' })],
      tournamentCourts: [],
      bracket: null,
    })
    expect(views[0].availability).toBe(AVAILABILITY.BUSY)
    expect(views[0].clubStatus).toBe('OCCUPIED')
    expect(views[0].playerName).toBe('Lucía')
  })

  it('derives IDLE from a club AVAILABLE flow (not BUSY until occupied)', () => {
    const views = reconcileInventory({
      catalog: [rec('c1')],
      clubFlows: [clubFlow('c1', 'AVAILABLE')],
      tournamentCourts: [],
      bracket: null,
    })
    expect(views[0].availability).toBe(AVAILABILITY.IDLE)
  })

  it('derives BUSY from a LIVE tournament court and IDLE from a WAITING one', () => {
    const live = reconcileInventory({
      catalog: [rec('c1'), rec('c2', { number: 2 })],
      clubFlows: [],
      tournamentCourts: [tourn('c1', 'LIVE'), tourn('c2', 'WAITING')],
      bracket: null,
    })
    expect(live.find(v => v.courtId === 'c1')?.availability).toBe(AVAILABILITY.BUSY)
    expect(live.find(v => v.courtId === 'c2')?.availability).toBe(AVAILABILITY.IDLE)
  })

  it('derives BUSY from a bracket binding even when the runtime flow is idle (INV-4 binding → BUSY)', () => {
    const views = reconcileInventory({
      catalog: [rec('c1')],
      clubFlows: [clubFlow('c1', 'AVAILABLE')],
      tournamentCourts: [],
      bracket: bracketWith('c1'),
    })
    expect(views[0].availability).toBe(AVAILABILITY.BUSY)
  })

  it('keeps MAINTENANCE listed but EXCLUDES ARCHIVED catalog records (archive is terminal)', () => {
    const views = reconcileInventory({
      catalog: [
        rec('m1', { inventoryStatus: INVENTORY_STATUS.MAINTENANCE, number: 2 }),
        rec('a1', { inventoryStatus: INVENTORY_STATUS.ARCHIVED, number: 3 }),
      ],
      clubFlows: [],
      tournamentCourts: [],
      bracket: null,
    })
    expect(views).toHaveLength(1)
    expect(views[0].courtId).toBe('m1')
    expect(views[0].inventoryStatus).toBe(INVENTORY_STATUS.MAINTENANCE)
    // Archived courts are terminal — hidden from the operational list, their
    // durable record stays in court-inventory.json for history only.
    expect(views.find(v => v.courtId === 'a1')).toBeUndefined()
  })

  it('includes bridge-era runtime courts that have no catalog record (inCatalog=false)', () => {
    const views = reconcileInventory({
      catalog: [],
      clubFlows: [clubFlow('legacy-1', 'OCCUPIED', { pin: '1234' })],
      tournamentCourts: [],
      bracket: null,
    })
    expect(views).toHaveLength(1)
    expect(views[0]).toMatchObject({
      courtId: 'legacy-1',
      availability: AVAILABILITY.BUSY,
      inCatalog: false,
      pin: '1234',
    })
  })

  it('merges a runtime club court with its catalog record into ONE row (INV-6 single view)', () => {
    const views = reconcileInventory({
      catalog: [rec('c1', { name: 'Mesa Principal' })],
      clubFlows: [clubFlow('c1', 'FINISHED')],
      tournamentCourts: [],
      bracket: null,
    })
    expect(views).toHaveLength(1) // not two rows for the same court
    expect(views[0].name).toBe('Mesa Principal') // catalog name wins (MP-2)
    expect(views[0].clubStatus).toBe('FINISHED')
  })
})
