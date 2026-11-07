import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useCryptoWallets,
  useRemoveCryptoWallet,
  useSyncCryptoWallet } from '@/features/sync/hooks'
import { formatTimeAgo } from '@/lib/utils'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorState } from '@/components/shared/ErrorState'
import { CryptoWalletForm } from '@/components/sync/CryptoWalletForm'
import { PanelError, PanelSection } from '@/components/sync/ProviderPanel'
import { ProviderMark } from '@/components/shared/ProviderMark'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { extractErrorMessage, formatApiError } from '@/lib/errors'

function truncateAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 8)}...${address.slice(-4)}`
}

export function CryptoWalletTab() {
  const { t } = useTranslation()
  const { data: wallets, isLoading, error, refetch } = useCryptoWallets()
  const syncMutation = useSyncCryptoWallet()
  const removeMutation = useRemoveCryptoWallet()

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
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-52" />
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
      {t('sync.wallets.add')}
    </Button>
  )

  return (
    <div className="space-y-4">
      {showAddForm && (
        <CryptoWalletForm
          variant="page"
          onSuccess={() => setShowAddForm(false)}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {!wallets || wallets.length === 0 ? (
        <div className="flex flex-col items-start gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t('sync.wallets.noWallets')}</p>
          {addButton}
        </div>
      ) : (
        <PanelSection title={t('sync.wallets.title')} aside={addButton}>
          {wallets.map(wallet => (
            <div key={wallet.id} data-testid="wallet-row" className="space-y-2 py-2.5">
              <div className="flex items-center gap-3">
                <ProviderMark size="sm" name={wallet.label || wallet.chain} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="flex min-w-0 items-center gap-2">
                    {wallet.label && <span className="truncate text-sm font-semibold text-foreground">{wallet.label}</span>}
                    <span className="shrink-0 rounded-md bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                      {wallet.chain}
                    </span>
                  </p>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span className="font-mono">{truncateAddress(wallet.address)}</span>
                    {wallet.lastSyncedAt && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{t('sync.panel.lastSync', { time: formatTimeAgo(wallet.lastSyncedAt) })}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('sync.wallets.sync')}
                    title={t('sync.wallets.sync')}
                    onClick={() => syncMutation.mutate(wallet.id)}
                    // Disables EVERY row while any sync is in flight, deliberately. One
                    // shared mutation drives all rows, so starting a second sync before
                    // the first settles overwrites `variables` -- and the error block
                    // below keys on it, so wallet A's failure would surface under wallet
                    // B. Scoping this per-row reads tidier and reintroduces that bug.
                    disabled={syncMutation.isPending}
                  >
                    <RefreshCw className={syncMutation.isPending && syncMutation.variables === wallet.id ? 'animate-spin' : undefined} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t('sync.wallets.remove')}
                    title={t('sync.wallets.remove')}
                    onClick={() => setRemovingId(wallet.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              {/* Both conditions are required: `variables` holds the last-synced id and
                  survives until reset, so isError alone would mark every row. */}
              {syncMutation.isError && syncMutation.variables === wallet.id && (
                <PanelError>{formatApiError(syncMutation.error, t, 'sync.wallets.syncError')}</PanelError>
              )}
            </div>
          ))}
        </PanelSection>
      )}

      {/* Remove confirmation */}
      <ConfirmDialog
        open={removingId != null}
        // ConfirmDialog renders `error` and stays open; per its contract the parent owns
        // clearing it, so reset on close or a stale failure greets the next deletion.
        onOpenChange={open => {
          if (!open) {
            setRemovingId(null)
            removeMutation.reset()
          }
        }}
        title={t('sync.wallets.remove')}
        description={t('sync.wallets.removeConfirm')}
        onConfirm={handleRemove}
        loading={removeMutation.isPending}
        error={
          removeMutation.isError
            ? formatApiError(removeMutation.error, t, 'sync.wallets.removeError')
            : undefined
        }
      />
    </div>
  )
}
