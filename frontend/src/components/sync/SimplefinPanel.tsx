import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw, KeyRound, Loader2 } from 'lucide-react'
import { PanelDisconnect, PanelError, PanelField, PanelForm, PanelIntro, PanelLoading, PanelStatus } from '@/components/sync/ProviderPanel'
import { PANEL_ACTION, PANEL_INPUT } from '@/components/sync/panel-styles'
import {
  useSimplefinStatus,
  useConnectSimplefin,
  useSyncSimplefin,
  useDisconnectSimplefin,
} from '@/features/sync/hooks'
import { extractErrorMessage } from '@/lib/errors'
import { formatTimeAgo } from '@/lib/utils'

const CREATE_TOKEN_URL = 'https://bridge.simplefin.org/simplefin/create'

interface SimplefinPanelProps {
  onConnected?: () => void
}

export function SimplefinPanel({ onConnected }: SimplefinPanelProps = {}) {
  const { t } = useTranslation()

  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: status, isLoading: statusLoading } = useSimplefinStatus()

  const isConnected = status?.connected ?? false
  const isError = status?.status === 'ERROR'

  const connectMutation = useConnectSimplefin()
  const syncMutation = useSyncSimplefin()
  const disconnectMutation = useDisconnectSimplefin()

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setError(null)
    try {
      await connectMutation.mutateAsync(token.trim())
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t('sync.simplefin.errors.connectFailed')))
      return
    }
    setToken('')
    try {
      const accounts = await syncMutation.mutateAsync()
      toast.success(t('sync.simplefin.syncedToast', { count: accounts.length }))
      onConnected?.()
    } catch (err: unknown) {
      // The token is already spent. Stay on the connected card so Sync can be retried.
      setError(extractErrorMessage(err, t('sync.simplefin.errors.syncFailed')))
    }
  }

  if (statusLoading) return <PanelLoading />

  return (
    <div className="space-y-4">
      {isConnected && status && (
        <PanelStatus
          tone={isError ? 'error' : syncMutation.isPending ? 'busy' : 'ok'}
          label={isError ? t('sync.simplefin.statusError') : t('sync.simplefin.connected')}
          meta={[
            status.maskedToken,
            status.lastSyncedAt
              ? t('sync.panel.lastSync', { time: formatTimeAgo(status.lastSyncedAt) })
              : t('sync.simplefin.neverSynced'),
          ]}
          actions={
            <>
              <PanelDisconnect
                label={t('sync.simplefin.disconnect')}
                provider={t('sync.simplefin.title')}
                description={t('sync.simplefin.disconnectConfirm')}
                confirmLabel={t('common.delete')}
                pending={disconnectMutation.isPending}
                onConfirm={() => disconnectMutation.mutate(undefined, {
                  onSuccess: () => setError(null),
                  onError: (err: unknown) => setError(extractErrorMessage(err, t('sync.simplefin.errors.disconnectFailed'))),
                })}
              />
              <Button
                size="xs"
                className={PANEL_ACTION}
                onClick={() => syncMutation.mutate(undefined, {
                  onSuccess: (accounts) => {
                    setError(null)
                    toast.success(t('sync.simplefin.syncedToast', { count: accounts.length }))
                  },
                  onError: (err: unknown) => setError(extractErrorMessage(err, t('sync.simplefin.errors.syncFailed'))),
                })}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {syncMutation.isPending ? t('sync.simplefin.syncing') : t('sync.simplefin.sync')}
              </Button>
            </>
          }
        />
      )}

      {error && <PanelError>{error}</PanelError>}

      {!isConnected && (
        <>
          <PanelIntro>
            {t('sync.simplefin.setupHint')}{' '}
            <a
              href={CREATE_TOKEN_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('sync.simplefin.createToken')}
            </a>
          </PanelIntro>
          <PanelForm
            onSubmit={handleConnect}
            actions={
              <Button
                type="submit"
                size="xs"
                disabled={connectMutation.isPending || syncMutation.isPending || !token.trim()}
                className={PANEL_ACTION}
              >
                {(connectMutation.isPending || syncMutation.isPending) && <Loader2 className="animate-spin" />}
                {t('sync.simplefin.connect')}
              </Button>
            }
          >
            <PanelField id="simplefin-token" label={t('sync.simplefin.token')} icon={KeyRound}>
              <Input
                id="simplefin-token"
                className={PANEL_INPUT}
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('sync.simplefin.tokenPlaceholder')}
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
