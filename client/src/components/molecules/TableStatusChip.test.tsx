import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TableStatusChip } from '../molecules/TableStatusChip'
import React from 'react'
import type { TableStatus } from '../../../../shared/types'

describe('TableStatusChip', () => {
  const cases: Array<{ status: TableStatus; text: string }> = [
    { status: 'WAITING', text: 'Waiting' },
    { status: 'CONFIGURING', text: 'Configuring' },
    { status: 'LIVE', text: 'Live' },
    { status: 'FINISHED', text: 'Finished' },
  ]

  cases.forEach(({ status, text }) => {
    it(`renders ${status} status`, () => {
      render(<TableStatusChip tableNumber={1} tableName="Table 1" status={status} />)
      expect(screen.getByText(text)).toBeInTheDocument()
    })
  })
})