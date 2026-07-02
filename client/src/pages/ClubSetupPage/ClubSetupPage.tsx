/**
 * ClubSetupPage - First-run setup wizard
 *
 * Collects club name, sport, admin PIN, and optional court count.
 * Delegates all business logic to useClubAdmin hook.
 */

import { useState, useEffect } from 'react'
import { SPORT } from '@shared/types'
import { ADMIN_PIN_RULES } from '@shared/validation'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'
import { Body, Headline } from '@/components/atoms/Typography'
import { useSocketContext } from '@/contexts/SocketContext'
import { useClubAdmin } from '@/hooks/useClubAdmin'

export function ClubSetupPage() {
  const { socket, connected } = useSocketContext()
  const {
    clubConfig,
    configLoading,
    submitSetup,
    setupLoading,
    setupError,
    setupComplete,
    checkClubConfig,
  } = useClubAdmin(socket, connected)

  const [clubName, setClubName] = useState('')
  const [sport, setSport] = useState<string>(SPORT.PADEL)
  const [adminPin, setAdminPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [courtCount, setCourtCount] = useState(3)
  const [pinError, setPinError] = useState('')

  // Check club config on mount
  useEffect(() => {
    checkClubConfig().catch(() => {})
  }, [checkClubConfig])

  // Redirect or show message if already configured
  if (configLoading) {
    return <div className="flex items-center justify-center h-dvh"><Body>Loading...</Body></div>
  }

  // If already configured, show info instead of form
  if (clubConfig?.configured && !setupComplete) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <Body>Club is already configured.</Body>
      </div>
    )
  }

  const handleSubmit = () => {
    setPinError('')

    if (!clubName.trim()) return
    if (!ADMIN_PIN_RULES.pattern.test(adminPin)) {
      setPinError(`PIN must be ${ADMIN_PIN_RULES.minLength}-${ADMIN_PIN_RULES.maxLength} digits`)
      return
    }
    if (adminPin !== confirmPin) {
      setPinError('PINs do not match')
      return
    }

    submitSetup({
      clubName: clubName.trim(),
      sport,
      adminPin,
      courtCount: courtCount > 0 ? courtCount : undefined,
    })
  }

  if (setupComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh gap-4 p-4">
        <Headline>Club Setup Complete!</Headline>
        <Body>{clubName} is ready to go.</Body>
        <Button variant="primary" onClick={() => window.location.href = '/club/admin'}>
          Go to Admin Panel
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh p-4 bg-surface">
      <div className="w-full max-w-md card bg-background rounded-lg shadow-xl p-6 space-y-4">
        <Headline className="text-center">Club Setup</Headline>

        <Input
          label="Club Name"
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
          placeholder="My Club"
          disabled={setupLoading}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text/70">Sport</label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="px-3 py-2 rounded border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={setupLoading}
          >
            <option value={SPORT.PADEL}>Padel</option>
            <option value={SPORT.TABLE_TENNIS}>Table Tennis</option>
          </select>
        </div>

        <Input
          label="Admin PIN"
          type="password"
          value={adminPin}
          onChange={(e) => setAdminPin(e.target.value)}
          placeholder={`${ADMIN_PIN_RULES.minLength}-${ADMIN_PIN_RULES.maxLength} digits`}
          disabled={setupLoading}
          error={pinError}
        />

        <Input
          label="Confirm PIN"
          type="password"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          placeholder="Re-enter PIN"
          disabled={setupLoading}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text/70">Number of Courts (optional)</label>
          <input
            type="number"
            min={1}
            max={10}
            value={courtCount}
            onChange={(e) => setCourtCount(parseInt(e.target.value) || 0)}
            className="px-3 py-2 rounded border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={setupLoading}
          />
          <Body className="text-xs text-text/50">Between 1 and 10 courts</Body>
        </div>

        {setupError && (
          <Body className="text-red-500 text-sm text-center">{setupError}</Body>
        )}

        <Button
          variant="primary"
          fullWidth
          onClick={handleSubmit}
          loading={setupLoading}
          disabled={setupLoading || !clubName.trim()}
        >
          Complete Setup
        </Button>
      </div>
    </div>
  )
}
