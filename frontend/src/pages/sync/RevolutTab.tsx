import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, RefreshCw, Smartphone } from 'lucide-react'
import {
  useRevolutStatus,
  useForgetRevolut,
  useConfirmRevolutSync,
} from '@/features/sync/hooks'
import { revolutPhaseLabel } from '@/features/sync/revolut-phase'
import { useRevolutDiscovery } from '@/features/sync/use-revolut-discovery'
import { RevolutCredentialsForm, type RevolutCredentials } from '@/components/sync/RevolutCredentialsForm'
import { PanelDisconnect, PanelError, PanelLoading, PanelStatus, PanelWaiting } from '@/components/sync/ProviderPanel'
import { PANEL_ACTION } from '@/components/sync/panel-styles'
import { formatApiError } from '@/lib/errors'
import { formatTimeAgo } from '@/lib/utils'

const EMPTY_CREDENTIALS: RevolutCredentials = { phoneNumber: '', passcode: '', remember: false }

export function RevolutTab() {
  const { t } = useTranslation()
  const [credentials, setCredentials] = useState<RevolutCredentials>(EMPTY_CREDENTIALS)
  // Brief success card once the auto-confirm below has persisted the discovery;
  // cleared as soon as the next sync starts.
  const [justSynced, setJustSynced] = useState(false)

  const { data: status, isLoading: statusLoading } = useRevolutStatus()
  const confirmSync = useConfirmRevolutSync()
  const forgetMutation = useForgetRevolut()

  const remembered = status?.remembered ?? false

  // This tab is pure auto-sync — no selection step — so a successful discovery immediately
  // persists everything found: refreshes accounts already imported and auto-adds any new
  // pocket/vault.
  const { errorMsg, setErrorMsg, isSyncing, progress, startPending, startDiscovery } = useRevolutDiscovery({
    onStart: () => setJustSynced(false),
    onFinished: (data) => {
      if (data && data.discovered.length > 0) {
        confirmSync.mutate(
          { selectedExternalIds: data.discovered.map((d) => d.externalId), remember: credentials.remember, voluntary: false },
          {
            onSuccess: () => {
              setCredentials((c) => ({ ...c, phoneNumber: '', passcode: '' }))
              setJustSynced(true)
            },
            onError: (err) => setErrorMsg(formatApiError(err, t)),
          },
        )
      } else {
        setJustSynced(true)
      }
    },
  })

  // Covers the brief round-trip before the 202 response flips isSyncing to true, plus
  // the auto-confirm that follows discovery.
  const busy = isSyncing || startPending || confirmSync.isPending

  function handleQuickSync() {
    startDiscovery({})
  }

  function handleFormSync(e: React.FormEvent) {
    e.preventDefault()
    startDiscovery({ phoneNumber: credentials.phoneNumber, passcode: credentials.passcode })
  }

  function handleForget() {
    forgetMutation.mutate()
  }

  if (statusLoading) return <PanelLoading />

  const phase = isSyncing ? revolutPhaseLabel(t, progress.data) : t('sync.revolut.selection.importing')
  const success = justSynced && !busy && !errorMsg

  return (
    <div className="space-y-4">
      {remembered && (
        <PanelStatus
          tone={busy ? 'busy' : 'ok'}
          label={t('sync.revolut.connected')}
          meta={[status?.lastSyncedAt && t('sync.panel.lastSync', { time: formatTimeAgo(status.lastSyncedAt) })]}
          actions={
            <>
              <PanelDisconnect
                label={t('sync.revolut.forget')}
                provider={t('sync.revolut.title')}
                pending={forgetMutation.isPending}
                disabled={busy}
                onConfirm={handleForget}
              />
              <Button size="xs" className={PANEL_ACTION} onClick={handleQuickSync} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {busy ? t('sync.revolut.syncing') : t('sync.revolut.sync')}
              </Button>
            </>
          }
        >
          {/* The discovery job runs in the background: its live phase (session check, login,
              mobile approval countdown, harvesting) rather than a static spinner. */}
          {busy && <p className="text-muted-foreground">{phase}</p>}
          {success && (
            <p className="flex items-center gap-1.5 text-gain">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              {t('sync.revolut.syncSuccess')}
            </p>
          )}
        </PanelStatus>
      )}

      {errorMsg && (
        <PanelError onRetry={() => setErrorMsg(null)} retryLabel={t('sync.banks.retry')}>
          {errorMsg}
        </PanelError>
      )}

      {!remembered && (
        <>
          {(isSyncing || confirmSync.isPending) && <PanelWaiting icon={Smartphone} title={phase} />}
          {success && (
            <p className="flex items-center gap-1.5 px-1 text-sm text-gain">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              {t('sync.revolut.syncSuccess')}
            </p>
          )}
          <RevolutCredentialsForm
            variant="page"
            value={credentials}
            onChange={setCredentials}
            onSubmit={handleFormSync}
            busy={busy}
          />
        </>
      )}
    </div>
  )
}
