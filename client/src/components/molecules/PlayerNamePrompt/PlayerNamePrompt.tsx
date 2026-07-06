/**
 * PlayerNamePrompt — Inline player name entry for club play
 *
 * NOT a modal — renders inline in the page layout.
 * Shows two text inputs for player names and a "Comenzar partido" button.
 */

import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'
import { useI18n } from '@/i18n'

export interface PlayerNamePromptProps {
  /** Called with final player names when user submits */
  onSubmit: (nameA: string, nameB: string) => void
  /** Default name for player A (left) */
  defaultNameA?: string
  /** Default name for player B (right) */
  defaultNameB?: string
}

export function PlayerNamePrompt({
  onSubmit,
  defaultNameA = 'Jugador 1',
  defaultNameB = 'Jugador 2',
}: PlayerNamePromptProps) {
  const { i18nText } = useI18n()
  const [nameA, setNameA] = useState(defaultNameA)
  const [nameB, setNameB] = useState(defaultNameB)

  const handleSubmit = () => {
    onSubmit(nameA.trim() || defaultNameA, nameB.trim() || defaultNameB)
  }

  return (
    <div className="flex flex-col gap-5 w-full max-w-sm">
      <Typography variant="title" className="text-center">
        {i18nText('matchConfigPlayers')}
      </Typography>

      <div className="flex flex-col gap-3">
        <Typography variant="label" className="text-muted-foreground">
          {i18nText('clubPlayNameA')}
        </Typography>
        <input
          type="text"
          value={nameA}
          onChange={(e) => setNameA(e.target.value)}
          placeholder={i18nText('clubPlayNamePlaceholder')}
          className="w-full px-4 py-3 rounded-md border border-border bg-surface text-text text-lg focus:outline-none focus:ring-2 focus:ring-primary"
          maxLength={30}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Typography variant="label" className="text-muted-foreground">
          {i18nText('clubPlayNameB')}
        </Typography>
        <input
          type="text"
          value={nameB}
          onChange={(e) => setNameB(e.target.value)}
          placeholder={i18nText('clubPlayNamePlaceholder')}
          className="w-full px-4 py-3 rounded-md border border-border bg-surface text-text text-lg focus:outline-none focus:ring-2 focus:ring-primary"
          maxLength={30}
        />
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={handleSubmit}
        animate={false}
        className="mt-2"
      >
        {i18nText('clubPlayStartMatch')}
      </Button>
    </div>
  )
}
