import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { PanelError, PanelField, PanelForm } from '@/components/sync/ProviderPanel'
import { PANEL_ACTION, PANEL_INPUT, PANEL_SELECT } from '@/components/sync/panel-styles'
import { Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react'
import type { ExchangeType } from '@/types/api'
import { SUPPORTED_EXCHANGES, exchangeRequiresApiPassphrase, exchangeRequiresApiSecret } from '@/types/api'
import { useAddCryptoExchange } from '@/features/sync/hooks'
import { extractErrorMessage, getErrorDetail } from '@/lib/errors'
import { EXCHANGE_API_KEY_MAX_LENGTH, EXCHANGE_API_PASSPHRASE_MAX_LENGTH, EXCHANGE_API_SECRET_MAX_LENGTH } from '@/lib/constants'

interface CryptoExchangeFormProps {
  onSuccess: () => void
  /** Cancel button beside Connect; only the `page` variant renders it. */
  onCancel?: () => void
  /** `page`: a card with Cancel + Connect, error cleared on exchange change. `modal`: no card, Connect only, dismissible error. */
  variant: 'page' | 'modal'
}

export function CryptoExchangeForm({ onSuccess, onCancel, variant }: CryptoExchangeFormProps) {
  const { t } = useTranslation()
  const modal = variant === 'modal'
  const [exchangeType, setExchangeType] = useState<ExchangeType>('BINANCE')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [apiPassphrase, setApiPassphrase] = useState('')
  const [region, setRegion] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addMutation = useAddCryptoExchange()
  const requiresSecret = exchangeRequiresApiSecret(exchangeType)
  const requiresPassphrase = exchangeRequiresApiPassphrase(exchangeType)
  const regions = SUPPORTED_EXCHANGES.find(exchange => exchange.type === exchangeType)?.regions ?? []
  const requiresRegion = regions.length > 0
  const needsRegion = requiresRegion && !regions.includes(region)

  function selectExchange(type: ExchangeType) {
    setExchangeType(type)
    // Clear exchange-specific fields when switching exchanges.
    setApiSecret('')
    setApiPassphrase('')
    setRegion('')
    setShowSecret(false)
    if (!modal) setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (needsRegion) return
    setError(null)
    addMutation.mutate(
      {
        type: exchangeType,
        apiKey,
        ...(requiresSecret && { apiSecret }),
        ...(requiresPassphrase && { apiPassphrase }),
        ...(requiresRegion && { region }),
      },
      {
        onSuccess,
        // Without this the backend's rejections (a wrong key, a missing or stray secret) leave
        // the form sitting there with no explanation at all.
        // The fallback names only the credentials this exchange actually takes: telling a Meria
        // user to check a secret they were never asked for sends them looking for a field that
        // does not exist.
        onError: (err: unknown) => {
          const fallback = t(requiresPassphrase
            ? 'common.error'
            : requiresSecret ? 'sync.exchanges.connectError' : 'sync.exchanges.connectErrorKeyOnly')
          setError(
            modal
              ? getErrorDetail(err) || (err as { message?: string })?.message || fallback
              : extractErrorMessage(err) || fallback,
          )
        },
      },
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <PanelError
          onRetry={modal ? () => setError(null) : undefined}
          retryLabel={modal ? t('common.close') : undefined}
        >
          {error}
        </PanelError>
      )}
      <PanelForm
        bare={modal}
        onSubmit={handleSubmit}
        actions={
          <>
            {!modal && (
              <Button type="button" variant="ghost" size="xs" className={PANEL_ACTION} onClick={onCancel}>
                {t('common.cancel')}
              </Button>
            )}
            <Button type="submit" size="xs" disabled={addMutation.isPending || needsRegion} className={PANEL_ACTION}>
              {addMutation.isPending && <Loader2 className="animate-spin" />}
              {t('sync.exchanges.connect')}
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label>{t('sync.exchanges.type')}</Label>
          <SegmentedControl
            ariaLabel={t('sync.exchanges.type')}
            options={SUPPORTED_EXCHANGES.map((exchange) => ({ value: exchange.type, label: exchange.type }))}
            value={exchangeType}
            onChange={selectExchange}
          />
        </div>

        {requiresRegion && (
          <PanelField id="exchange-region" label={t('sync.exchanges.region')} hint={t('sync.exchanges.regionHelp')}>
            <NativeSelect
              id="exchange-region"
              className={PANEL_SELECT}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
            >
              <option value="" disabled>
                {t('sync.exchanges.regionPlaceholder')}
              </option>
              {regions.map(code => (
                <option key={code} value={code}>
                  {t(`sync.exchanges.regions.${code}`, { defaultValue: code })}
                </option>
              ))}
            </NativeSelect>
          </PanelField>
        )}

        <PanelField
          id="exchange-api-key"
          label={t('sync.exchanges.apiKey')}
          icon={KeyRound}
          hint={requiresSecret || requiresPassphrase ? undefined : t('sync.exchanges.apiKeyOnly')}
        >
          <Input
            id="exchange-api-key"
            className={PANEL_INPUT}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            required
            maxLength={EXCHANGE_API_KEY_MAX_LENGTH}
          />
        </PanelField>

        {requiresSecret && (
          <PanelField id="exchange-api-secret" label={t('sync.exchanges.apiSecret')} icon={Lock}>
            <div className="relative">
              <Input
                id="exchange-api-secret"
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                autoComplete="off"
                required
                maxLength={EXCHANGE_API_SECRET_MAX_LENGTH}
                className={`${PANEL_INPUT} pr-10`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowSecret((p) => !p)}
                aria-label={t(showSecret ? 'sync.exchanges.hideSecret' : 'sync.exchanges.showSecret')}
                aria-pressed={showSecret}
                className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </PanelField>
        )}

        {requiresPassphrase && (
          <PanelField id="exchange-api-passphrase" label={t('sync.exchanges.apiPassphrase')} icon={Lock}>
            <Input
              id="exchange-api-passphrase"
              type="password"
              className={PANEL_INPUT}
              value={apiPassphrase}
              onChange={(e) => setApiPassphrase(e.target.value)}
              autoComplete="off"
              required
              maxLength={EXCHANGE_API_PASSPHRASE_MAX_LENGTH}
            />
          </PanelField>
        )}
      </PanelForm>
    </div>
  )
}
