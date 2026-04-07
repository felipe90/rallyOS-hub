import { useState } from 'react'
import './index.css'
import { DashboardGrid, DashboardHeader } from './components/organisms/DashboardGrid'
import type { TableInfo } from '../../shared/types'

// Mock data for demo
const mockTables: TableInfo[] = [
  { id: '1', number: 1, name: 'Mesa Alpha', status: 'WAITING', pin: '0000', playerCount: 0 },
  { id: '2', number: 2, name: 'Mesa Beta', status: 'LIVE', pin: '0000', playerCount: 2, playerNames: { a: 'Juan', b: 'Pedro' } },
  { id: '3', number: 3, name: 'Mesa Gamma', status: 'FINISHED', pin: '0000', playerCount: 2, winner: 'A' },
]

function App() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [tables, setTables] = useState<TableInfo[]>(mockTables)

  const liveMatches = tables.filter(t => t.status === 'LIVE').length
  const activePlayers = tables.reduce((acc, t) => acc + t.playerCount, 0)

  const handleTableClick = (tableId: string) => {
    console.log('Clicked table:', tableId)
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <DashboardHeader
        totalTables={tables.length}
        liveMatches={liveMatches}
        activePlayers={activePlayers}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      
      <DashboardGrid
        tables={tables}
        viewMode={viewMode}
        onTableClick={handleTableClick}
      />
    </div>
  )
}

export default App