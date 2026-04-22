/**
 * useSocketState - Manages table/match state from socket events
 *
 * Single responsibility: listen to socket events and update state.
 */

import { useEffect, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import type { TableInfo, TableInfoWithPin, MatchStateExtended, ScoreChange } from '@shared/types'

export function useSocketState(socket: Socket | null) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [currentMatch, setCurrentMatch] = useState<MatchStateExtended | null>(null)
  const [currentTable, setCurrentTable] = useState<TableInfo | null>(null)

  useEffect(() => {
    if (!socket) return

    const handleTableUpdate = (table: TableInfo) => {
      setTables(prev =>
        prev.find(t => t.id === table.id)
          ? prev.map(t => (t.id === table.id ? table : t))
          : [...prev, table],
      )
      setCurrentTable(table)
    }

    const handleTableList = (list: TableInfo[]) => setTables(list)

    const handleTableListWithPins = (data: { tables: TableInfoWithPin[] }) => {
      setTables(data.tables as TableInfo[])
    }

    const handleTableDeleted = ({ tableId }: { tableId: string }) => {
      setTables(prev => prev.filter(t => t.id !== tableId))
    }

    const handleTableCreated = () => {
      const ownerPin = sessionStorage.getItem('ownerPin')
      if (ownerPin) {
        socket.emit(SocketEvents.CLIENT.GET_TABLES_WITH_PINS, { ownerPin })
      }
    }

    const handleMatchUpdate = (match: MatchStateExtended) => {
      setCurrentMatch(match)
    }

    const handleHistoryUpdate = (history: ScoreChange[]) => {
      setCurrentMatch(prev => (prev ? { ...prev, history } : null))
    }

    socket.on(SocketEvents.SERVER.TABLE_UPDATE, handleTableUpdate)
    socket.on(SocketEvents.SERVER.TABLE_LIST, handleTableList)
    socket.on(SocketEvents.SERVER.TABLE_LIST_WITH_PINS, handleTableListWithPins)
    socket.on(SocketEvents.SERVER.TABLE_DELETED, handleTableDeleted)
    socket.on(SocketEvents.SERVER.TABLE_CREATED, handleTableCreated)
    socket.on(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)
    socket.on(SocketEvents.SERVER.HISTORY_UPDATE, handleHistoryUpdate)

    return () => {
      socket.off(SocketEvents.SERVER.TABLE_UPDATE, handleTableUpdate)
      socket.off(SocketEvents.SERVER.TABLE_LIST, handleTableList)
      socket.off(SocketEvents.SERVER.TABLE_LIST_WITH_PINS, handleTableListWithPins)
      socket.off(SocketEvents.SERVER.TABLE_DELETED, handleTableDeleted)
      socket.off(SocketEvents.SERVER.TABLE_CREATED, handleTableCreated)
      socket.off(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)
      socket.off(SocketEvents.SERVER.HISTORY_UPDATE, handleHistoryUpdate)
    }
  }, [socket])

  return { tables, currentMatch, currentTable }
}
