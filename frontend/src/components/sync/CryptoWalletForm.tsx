import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { PanelError, PanelField, PanelForm } from '@/components/sync/ProviderPanel'
import { PANEL_ACTION, PANEL_INPUT } from '@/components/sync/panel-styles'
import { Loader2, Tag, Wallet } from 'lucide-react'
import type { ChainType } from '@/types/api'
import { SUPPORTED_CHAINS } from '@/types/api'
import { useAddCryptoWallet } from '@/features/sync/hooks'
import { formatApiError, getErrorDetail } from '@/lib/errors'

interface CryptoWalletFormProps {
  onSuccess: () => void
  /** Cancel button beside Track; only the `page` variant renders it. */
  onCancel?: () => void
  /** `page`: a card with Cancel + Track, inline error read from the mutation. `modal`: no card, Track only, dismissible error. */
  variant: 'page' | 'modal'
}

export function CryptoWalletForm({ onSuccess, onCancel, variant }: CryptoWalletFormProps) {
  const { t } = useTranslation()
  const modal = variant === 'modal'
  const [chain, setChain] = useState<ChainType>('EVM')
  const [address, setAddress] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addMutation = useAddCryptoWallet()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    addMutation.mutate(
      { chain, address, label: label || undefined },
      {
        onSuccess,
        onError: modal
          ? (err: unknown) => {
              setError(getErrorDetail(err) || (err as { message?: string })?.message || t('sync.wallets.connectError'))
            }
          : undefined,
      },
    )
  }

  return (
    <div className="space-y-4">
      {modal && error && (
        <PanelError onRetry={() => setError(null)} retryLabel={t('common.close')}>
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
              {addMutation.isPending ? <Loader2 className="animate-spin" /> : <Wallet />}
              {t('sync.wallets.track')}
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label>{t('sync.wallets.chain')}</Label>
          <SegmentedControl
            ariaLabel={t('sync.wallets.chain')}
            options={SUPPORTED_CHAINS.map((c) => ({ value: c, label: c }))}
            value={chain}
            onChange={setChain}
          />
          {chain === 'EVM' && <p className="text-xs text-pretty text-muted-foreground">{t('sync.wallets.evmHint')}</p>}
        </div>

        <PanelField id="wallet-address" label={t('sync.wallets.address')} icon={Wallet}>
          <Input
            id="wallet-address"
            className={`${PANEL_INPUT} font-mono`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </PanelField>

        <PanelField id="wallet-label" label={t('sync.wallets.label')} icon={Tag}>
          <Input
            id="wallet-label"
            className={PANEL_INPUT}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </PanelField>

        {/* Near the fields it is about, above the actions. */}
        {!modal && addMutation.isError && (
          <PanelError>{formatApiError(addMutation.error, t, 'sync.wallets.connectError')}</PanelError>
        )}
      </PanelForm>
    </div>
  )
}
