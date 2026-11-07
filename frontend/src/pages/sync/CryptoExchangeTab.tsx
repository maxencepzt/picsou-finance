import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTimeAgo } from '@/lib/utils'
import { providerLogoUrl } from '@/lib/provider-logos'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorState } from '@/components/shared/ErrorState'
import { CryptoExchangeForm } from '@/components/sync/CryptoExchangeForm'
import { ConnectionState, PanelSection } from '@/components/sync/ProviderPanel'
import { ProviderMark } from '@/components/shared/ProviderMark'
import { connectionTone } from '@/components/sync/panel-styles'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  useCryptoExchangeStatuses,
  useSyncCryptoExchange,
  useRemoveCryptoExchange } from '@/features/sync/hooks'
import { extractErrorMessage } from '@/lib/errors'

export function CryptoExchangeTab() {
  const { t } = useTranslation()
  const { data: exchanges, isLoading, error, refetch } = useCryptoExchangeStatuses()
  const syncMutation = useSyncCryptoExchange()
  const removeMutation = useRemoveCryptoExchange()

  const [showAddForm, setShowAddForm] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  function handleRemove() {
    if (removingId == null) return
    removeMutation.mutate(removingId, {
      onSuccess: () => setRemovingId(null) })
  }

  if (isLoading) {
    return (
      <Card size="sm">
        <CardContent className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <ErrorState messageOnly message={extractErrorMessage(error)} onRetry={() => refetch()} />
    )
  }

  const addButton = !showAddForm && (
    <Button variant="outline" size="xs" className="pointer-coarse:h-10" onClick={() => setShowAddForm(true)}>
      <Plus />
      {t('sync.exchanges.add')}
    </Button>
  )

  return (
    <div className="space-y-4">
      {showAddForm && (
        <CryptoExchangeForm
          variant="page"
          onSuccess={() => setShowAddForm(false)}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {!exchanges || exchanges.length === 0 ? (
        <div className="flex flex-col items-start gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t('sync.exchanges.noExchanges')}</p>
          {addButton}
        </div>
      ) : (
        <PanelSection title={t('sync.exchanges.title')} aside={addButton}>
          {exchanges.map(exchange => (
            <div key={exchange.id} className="flex items-center gap-3 py-2.5">
              <ProviderMark size="sm" name={exchange.exchangeType} logo={providerLogoUrl(exchange.exchangeType)} />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-semibold text-foreground">{exchange.exchangeType}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <ConnectionState tone={connectionTone(exchange.status)}>
                    {t(`sync.connectionStatus.${exchange.status}`, { defaultValue: exchange.status })}
                  </ConnectionState>
                  {exchange.lastSyncedAt && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{t('sync.panel.lastSync', { time: formatTimeAgo(exchange.lastSyncedAt) })}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('sync.exchanges.sync')}
                  title={t('sync.exchanges.sync')}
                  onClick={() => syncMutation.mutate(exchange.id)}
                  disabled={syncMutation.isPending}
                >
                  <RefreshCw className={syncMutation.isPending && syncMutation.variables === exchange.id ? 'animate-spin' : undefined} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t('sync.exchanges.remove')}
                  title={t('sync.exchanges.remove')}
                  onClick={() => setRemovingId(exchange.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </PanelSection>
      )}

      {/* Remove confirmation */}
      <ConfirmDialog
        open={removingId != null}
        onOpenChange={open => !open && setRemovingId(null)}
        title={t('sync.exchanges.remove')}
        description={t('sync.exchanges.removeConfirm')}
        onConfirm={handleRemove}
        loading={removeMutation.isPending}
      />
    </div>
  )
}
