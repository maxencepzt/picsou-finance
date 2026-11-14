import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Upload } from 'lucide-react'
import {
  useClearTrSession,
  useImportTrCsv,
  useSyncTradeRepublic,
  useTrSessionStatus,
} from '@/features/sync/hooks'
import { useAccounts } from '@/features/accounts/hooks'
import { formatTrAuthError, trErrorMessage } from '@/lib/errors'
import { TradeRepublicLogin } from '@/components/sync/TradeRepublicLogin'
import { PanelDisconnect, PanelError, PanelIntro, PanelLoading, PanelStatus } from '@/components/sync/ProviderPanel'
import { PANEL_ACTION } from '@/components/sync/panel-styles'

export function TradeRepublicTab() {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: sessionStatus, isLoading: statusLoading } = useTrSessionStatus()
  const { data: accounts } = useAccounts()
  const syncMutation = useSyncTradeRepublic()
  const importCsvMutation = useImportTrCsv()
  const logoutMutation = useClearTrSession()

  const isConnected = sessionStatus?.isActive ?? false
  const syncStatus = sessionStatus?.syncStatus ?? 'IDLE'
  const isSyncing = syncStatus === 'QUEUED' || syncStatus === 'RUNNING'
  const requestingSync = syncMutation.isPending || isSyncing
  const backgroundError = syncStatus === 'FAILED'
    ? (trErrorMessage(t, sessionStatus?.lastSyncError) ?? t('sync.tr.errors.serverError'))
    : null
  const visibleError = error ?? backgroundError
  // Accounts a past session imported stop updating once it is gone (an expiry, a disconnect, or
  // the upgrade that dropped the old sessions): say so, the daily sync skips them silently.
  // CSV imports (tr_csv_*) never had a session, so they say nothing.
  const staleAccounts = !isConnected && (accounts ?? []).some(
    account => account.provider === 'Trade Republic' && !account.isManual
      && !account.externalAccountId?.startsWith('tr_csv_'),
  )

  function handleCsvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    importCsvMutation.mutate(file, {
      onSuccess: () => {
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
      onError: (err: unknown) => setError(formatTrAuthError(err, t)),
    })
  }

  function handleSync() {
    setError(null)
    syncMutation.mutate(undefined, { onError: (err: unknown) => setError(formatTrAuthError(err, t)) })
  }

  function handleClear() {
    setError(null)
    logoutMutation.mutate(undefined, { onError: (err: unknown) => setError(formatTrAuthError(err, t)) })
  }

  if (statusLoading) return <PanelLoading />

  const errorBanner = visibleError && (
    // Only an error raised here can be dismissed; a failed background sync stays until the next run.
    <PanelError onRetry={error ? () => setError(null) : undefined}>{visibleError}</PanelError>
  )

  if (!isConnected) {
    return (
      <div className="space-y-4">
        {errorBanner}
        {staleAccounts && !visibleError && <PanelIntro>{t('sync.tr.staleAccounts')}</PanelIntro>}
        <TradeRepublicLogin variant="page" maskedPhone={sessionStatus?.maskedPhone ?? null} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PanelStatus
        tone={isSyncing ? 'busy' : backgroundError ? 'error' : 'ok'}
        label={t('sync.tr.sessionActive')}
        meta={[
          isSyncing && (syncStatus === 'QUEUED' ? t('sync.tr.queued') : t('sync.tr.syncing')),
          syncStatus === 'SUCCESS' && sessionStatus?.lastSyncCompletedAt && t('sync.tr.syncSuccess'),
        ]}
        actions={
          <>
            <PanelDisconnect
              label={t('sync.tr.clearSession')}
              provider={t('sync.tr.title')}
              pending={logoutMutation.isPending}
              onConfirm={handleClear}
            />
            <Button
              variant="outline"
              size="xs"
              className={PANEL_ACTION}
              onClick={() => fileInputRef.current?.click()}
              disabled={importCsvMutation.isPending}
            >
              {importCsvMutation.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
              {t('sync.tr.importCsv')}
            </Button>
            <Button size="xs" className={PANEL_ACTION} onClick={handleSync} disabled={requestingSync}>
              <RefreshCw className={requestingSync ? 'animate-spin' : undefined} />
              {requestingSync ? t('sync.tr.syncing') : t('sync.tr.sync')}
            </Button>
          </>
        }
      />
      {errorBanner}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleCsvChange}
      />
    </div>
  )
}
