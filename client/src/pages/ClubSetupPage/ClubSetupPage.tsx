/**
 * ClubSetupPage — First-run setup wizard
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
import { useToast } from '@/components/molecules/Toast'
import { useSocketContext } from '@/contexts/SocketContext'
import { useClubAdmin } from '@/hooks/useClubAdmin'
import { useI18n } from '@/i18n'
import { Settings, CheckCircle, Building2 } from 'lucide-react'

export function ClubSetupPage() {
  const { socket, connected } = useSocketContext()
  const { i18nText } = useI18n()
  const { addToast } = useToast()
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
  const [costPerMinute, setCostPerMinute] = useState(0)
  const [currency, setCurrency] = useState('ARS')
  const [pinError, setPinError] = useState('')

  // Toast for setup errors (skip ALREADY_CONFIGURED — it's handled by the UI state)
  useEffect(() => {
    if (setupError && setupError !== 'ALREADY_CONFIGURED') {
      addToast('error', setupError)
    }
  }, [setupError, addToast])

  // Check club config on mount
  useEffect(() => {
    checkClubConfig().catch(() => {})
  }, [checkClubConfig])

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-surface">
        <Body>{i18nText('clubAdminLoading')}</Body>
      </div>
    )
  }

  // If already configured, show info instead of form
  if (clubConfig?.configured && !setupComplete) {
    return (
      <div className="flex items-center justify-center h-dvh bg-surface p-4">
        <div className="card bg-surface-low rounded-lg shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-amber-100 text-amber-600 p-3 rounded-full">
              <Settings size={32} />
            </div>
          </div>
          <Body className="text-text/70">{i18nText('clubSetupAlreadyConfigured')}</Body>
        </div>
      </div>
    )
  }

  const handleSubmit = () => {
    setPinError('')

    if (!clubName.trim()) return
    if (!ADMIN_PIN_RULES.pattern.test(adminPin)) {
      setPinError(i18nText('errorsInvalidPin'))
      return
    }
    if (adminPin !== confirmPin) {
      setPinError(i18nText('errorAuthInvalidPin'))
      return
    }

    submitSetup({
      clubName: clubName.trim(),
      sport,
      adminPin,
      courtCount: courtCount > 0 ? courtCount : undefined,
      costPerMinute: costPerMinute > 0 ? costPerMinute : undefined,
      currency,
    })
  }

  if (setupComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh bg-surface p-4 gap-6">
        <div className="bg-green-100 text-green-600 p-4 rounded-full">
          <CheckCircle size={48} />
        </div>
        <Headline className="text-center">{i18nText('clubSetupSuccessTitle')}</Headline>
        <Body className="text-text/70 text-center">
          {i18nText('clubSetupSuccessDesc', { name: clubName })}
        </Body>
        <Button variant="primary" onClick={() => window.location.href = '/club/admin'}>
          {i18nText('clubSetupGoToAdmin')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-dvh bg-surface p-4">
      <div className="card bg-surface-low rounded-lg shadow-xl p-8 w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="bg-primary/10 text-primary p-3 rounded-full">
              <Building2 size={32} />
            </div>
          </div>
          <Headline className="text-center">{i18nText('clubSetupTitle')}</Headline>
        </div>

        <Input
          label={i18nText('clubSetupClubName')}
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
          placeholder="My Club"
          disabled={setupLoading}
        />

        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-text">
            {i18nText('clubSetupSport')}
          </label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="w-full px-4 py-3 rounded-[--radius-md] font-body text-base bg-surface-low text-text-h placeholder:text-text-muted transition-all duration-200 hover:bg-surface-high focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-surface disabled:opacity-50"
            disabled={setupLoading}
          >
            <option value={SPORT.PADEL}>Padel</option>
            <option value={SPORT.TABLE_TENNIS}>Table Tennis</option>
          </select>
        </div>

        <div className="space-y-1">
          <Input
            label={i18nText('clubSetupAdminPin')}
            type="password"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            placeholder="••••••"
            disabled={setupLoading}
            error={pinError}
          />
        </div>

        <Input
          label={i18nText('clubSetupConfirmPin')}
          type="password"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          placeholder="••••••"
          disabled={setupLoading}
        />

        <div className="flex flex-col gap-1.5">
          <label className="font-body text-sm font-medium text-text">
            {i18nText('clubSetupCourtCount')}
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={courtCount}
            onChange={(e) => setCourtCount(parseInt(e.target.value) || 0)}
            className="w-full px-4 py-3 rounded-[--radius-md] font-body text-base bg-surface-low text-text-h placeholder:text-text-muted transition-all duration-200 hover:bg-surface-high focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-surface disabled:opacity-50"
            disabled={setupLoading}
          />
          <Body className="text-xs text-text-muted">{i18nText('clubSetupCourtCountHint')}</Body>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="font-body text-sm font-medium text-text">
              {i18nText('clubSetupCostPerMinute')}
            </label>
            <input
              type="number"
              min={0}
              value={costPerMinute}
              onChange={(e) => setCostPerMinute(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-3 rounded-[--radius-md] font-body text-base bg-surface-low text-text-h placeholder:text-text-muted transition-all duration-200 hover:bg-surface-high focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-surface disabled:opacity-50"
              disabled={setupLoading}
            />
          </div>
          <div className="w-28">
            <label className="font-body text-sm font-medium text-text block mb-1.5">
              {i18nText('clubSetupCurrency')}
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-3 rounded-[--radius-md] font-body text-base bg-surface-low text-text-h transition-all duration-200 hover:bg-surface-high focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-surface disabled:opacity-50"
              disabled={setupLoading}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
          </div>
        </div>

        <Button
          variant="primary"
          fullWidth
          onClick={handleSubmit}
          loading={setupLoading}
          disabled={setupLoading || !clubName.trim()}
        >
          {i18nText('clubSetupComplete')}
        </Button>
      </div>
    </div>
  )
}
