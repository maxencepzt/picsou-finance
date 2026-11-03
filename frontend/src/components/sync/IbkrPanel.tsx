import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw, KeyRound, Hash, Loader2 } from 'lucide-react'
import { PanelDisconnect, PanelError, PanelField, PanelForm, PanelIntro, PanelLoading, PanelStatus } from '@/components/sync/ProviderPanel'
import { PANEL_ACTION, PANEL_INPUT } from '@/components/sync/panel-styles'
import { useIbkrStatus, useConnectIbkr, useSyncIbkr, useDisconnectIbkr } from '@/features/sync/hooks'
import { extractErrorMessage } from '@/lib/errors'
import { formatTimeAgo } from '@/lib/utils'

interface IbkrPanelProps {
  onConnected?: () => void
}

export function IbkrPanel({ onConnected }: IbkrPanelProps = {}) {
  const { t } = useTranslation()

  const [token, setToken] = useState('')
  const [queryId, setQueryId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: status, isLoading: statusLoading } = useIbkrStatus()

  const isConnected = status?.connected ?? false
  const isError = status?.status === 'ERROR'

  const connectMutation = useConnectIbkr()
  const syncMutation = useSyncIbkr()
  const disconnectMutation = useDisconnectIbkr()

  function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim() || !queryId.trim()) return
    connectMutation.mutate(
      { token: token.trim(), queryId: queryId.trim() },
      {
        onSuccess: () => {
          setToken('')
          setQueryId('')
          setError(null)
          onConnected?.()
        },
        onError: (err: unknown) => setError(extractErrorMessage(err, t('sync.ibkr.errors.connectFailed'))),
      },
    )
  }

  if (statusLoading) return <PanelLoading />

  return (
    <div className="space-y-4">
      {isConnected && status && (
        <PanelStatus
          tone={isError ? 'error' : syncMutation.isPending ? 'busy' : 'ok'}
          label={isError ? t('sync.ibkr.statusError') : t('sync.ibkr.connected')}
          meta={[
            status.maskedToken,
            status.lastSyncedAt
              ? t('sync.panel.lastSync', { time: formatTimeAgo(status.lastSyncedAt) })
              : t('sync.ibkr.neverSynced'),
          ]}
          actions={
            <>
              <PanelDisconnect
                label={t('sync.ibkr.disconnect')}
                provider={t('sync.ibkr.title')}
                description={t('sync.ibkr.disconnectConfirm')}
                confirmLabel={t('common.delete')}
                pending={disconnectMutation.isPending}
                onConfirm={() => disconnectMutation.mutate(undefined, {
                  onSuccess: () => setError(null),
                  onError: (err: unknown) => setError(extractErrorMessage(err, t('sync.ibkr.errors.disconnectFailed'))),
                })}
              />
              <Button
                size="xs"
                className={PANEL_ACTION}
                onClick={() => syncMutation.mutate(undefined, {
                  onSuccess: (accounts) => {
                    setError(null)
                    toast.success(t('sync.ibkr.syncedToast', { count: accounts.length }))
                  },
                  onError: (err: unknown) => setError(extractErrorMessage(err, t('sync.ibkr.errors.syncFailed'))),
                })}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {syncMutation.isPending ? t('sync.ibkr.syncing') : t('sync.ibkr.sync')}
              </Button>
            </>
          }
        />
      )}

      {error && <PanelError>{error}</PanelError>}

      {!isConnected && (
        <>
          <PanelIntro>{t('sync.ibkr.setupHint')}</PanelIntro>
          <PanelForm
            onSubmit={handleConnect}
            actions={
              <Button
                type="submit"
                size="xs"
                disabled={connectMutation.isPending || !token.trim() || !queryId.trim()}
                className={PANEL_ACTION}
              >
                {connectMutation.isPending && <Loader2 className="animate-spin" />}
                {t('sync.ibkr.connect')}
              </Button>
            }
          >
            <PanelField id="ibkr-token" label={t('sync.ibkr.token')} icon={KeyRound}>
              <Input
                id="ibkr-token"
                className={PANEL_INPUT}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('sync.ibkr.tokenPlaceholder')}
                autoComplete="off"
                required
              />
            </PanelField>
            <PanelField id="ibkr-query" label={t('sync.ibkr.queryId')} icon={Hash}>
              <Input
                id="ibkr-query"
                className={PANEL_INPUT}
                value={queryId}
                onChange={(e) => setQueryId(e.target.value)}
                placeholder={t('sync.ibkr.queryIdPlaceholder')}
                autoComplete="off"
                required
              />
            </PanelField>
          </PanelForm>
        </>
      )}
    </div>
  )
}
