import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { PanelError, PanelField, PanelForm } from '@/components/sync/ProviderPanel'
import { PANEL_ACTION, PANEL_INPUT } from '@/components/sync/panel-styles'
import { Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react'
import type { ExchangeType } from '@/types/api'
import { SUPPORTED_EXCHANGES, exchangeRequiresApiSecret } from '@/types/api'
import { useAddCryptoExchange } from '@/features/sync/hooks'
import { extractErrorMessage, getErrorDetail } from '@/lib/errors'
import { EXCHANGE_API_KEY_MAX_LENGTH, EXCHANGE_API_SECRET_MAX_LENGTH } from '@/lib/constants'

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
  const [showSecret, setShowSecret] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addMutation = useAddCryptoExchange()
  const requiresSecret = exchangeRequiresApiSecret(exchangeType)

  function selectExchange(type: ExchangeType) {
    setExchangeType(type)
    // Drop anything typed under the previous exchange: sending a secret to a single-key exchange
    // is a 400, and it would be entirely self-inflicted.
    setApiSecret('')
    setShowSecret(false)
    if (!modal) setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    addMutation.mutate(
      { type: exchangeType, apiKey, apiSecret: requiresSecret ? apiSecret : undefined },
      {
        onSuccess,
        // Without this the backend's rejections (a wrong key, a missing or stray secret) leave
        // the form sitting there with no explanation at all.
        // The fallback names only the credentials this exchange actually takes: telling a Meria
        // user to check a secret they were never asked for sends them looking for a field that
        // does not exist.
        onError: (err: unknown) => {
          const fallback = t(requiresSecret ? 'sync.exchanges.connectError' : 'sync.exchanges.connectErrorKeyOnly')
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
            <Button type="submit" size="xs" disabled={addMutation.isPending} className={PANEL_ACTION}>
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

        <PanelField
          id="exchange-api-key"
          label={t('sync.exchanges.apiKey')}
          icon={KeyRound}
          hint={requiresSecret ? undefined : t('sync.exchanges.apiKeyOnly')}
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
      </PanelForm>
    </div>
  )
}
