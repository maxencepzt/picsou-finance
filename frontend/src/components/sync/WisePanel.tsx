import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RefreshCw, KeyRound, Loader2 } from 'lucide-react'
import { PanelDisconnect, PanelError, PanelField, PanelForm, PanelIntro, PanelLoading, PanelStatus } from '@/components/sync/ProviderPanel'
import { PANEL_ACTION, PANEL_INPUT } from '@/components/sync/panel-styles'
import {
  useWiseStatus,
  useConnectWise,
  useSyncWise,
  useDisconnectWise,
} from '@/features/sync/hooks'
import { extractErrorMessage, getErrorCode } from '@/lib/errors'
import { formatDateTime } from '@/lib/utils'

const CREATE_TOKEN_URL = 'https://wise.com/your-account/integrations-and-tools/api-tokens'
const STATUS_ERROR = 'ERROR'
const STATUS_REAUTH_REQUIRED = 'REAUTH_REQUIRED'

/** Codes the Wise endpoints attach to the failures a member can act on. */
const ERROR_KEYS: Record<string, string> = {
  SESSION_EXPIRED: 'sync.wise.errors.tokenRefused',
  INVALID_TOKEN: 'sync.wise.errors.invalidToken',
  RATE_LIMITED: 'sync.wise.errors.rateLimited',
}

interface WisePanelProps {
  onConnected?: () => void
}

export function WisePanel({ onConnected }: WisePanelProps = {}) {
  const { t } = useTranslation()

  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: status, isLoading: statusLoading } = useWiseStatus()

  const isConnected = status?.connected ?? false
  const tokenRefused = status?.status === STATUS_REAUTH_REQUIRED
  const lastSyncFailed = status?.status === STATUS_ERROR

  const connectMutation = useConnectWise()
  const syncMutation = useSyncWise()
  const disconnectMutation = useDisconnectWise()

  function errorMessage(err: unknown, fallbackKey: string) {
    const key = ERROR_KEYS[getErrorCode(err) ?? '']
    return key ? t(key) : extractErrorMessage(err, t(fallbackKey))
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setError(null)
    try {
      const jars = await connectMutation.mutateAsync(token.trim())
      setToken('')
      toast.success(t('sync.wise.syncedToast', { count: jars.length }))
      onConnected?.()
    } catch (err: unknown) {
      setError(errorMessage(err, 'sync.wise.errors.connectFailed'))
    }
  }

  if (statusLoading) return <PanelLoading />

  const disconnect = (
    <PanelDisconnect
      label={t('sync.wise.disconnect')}
      provider={t('sync.wise.title')}
      description={t('sync.wise.disconnectConfirm')}
      confirmLabel={t('common.delete')}
      pending={disconnectMutation.isPending}
      onConfirm={() => disconnectMutation.mutate(undefined, {
        onSuccess: () => setError(null),
        onError: (err: unknown) => setError(extractErrorMessage(err, t('sync.wise.errors.disconnectFailed'))),
      })}
    />
  )

  return (
    <div className="space-y-4">
      <PanelIntro>{t('sync.wise.intro')}</PanelIntro>

      {isConnected && status && (
        <PanelStatus
          tone={tokenRefused || lastSyncFailed ? 'error' : syncMutation.isPending ? 'busy' : 'ok'}
          label={t(tokenRefused ? 'sync.wise.statusTokenRefused' : lastSyncFailed ? 'sync.wise.statusError' : 'sync.wise.connected')}
          meta={[
            status.maskedToken,
            status.lastSyncedAt
              ? `${t('common.labelColon', { label: t('sync.wise.lastSync') })} ${formatDateTime(status.lastSyncedAt)}`
              : t('sync.wise.neverSynced'),
          ]}
          actions={
            <>
              {disconnect}
              {!tokenRefused && (
                <Button
                  size="xs"
                  className={PANEL_ACTION}
                  onClick={() => syncMutation.mutate(undefined, {
                    onSuccess: (jars) => {
                      setError(null)
                      toast.success(t('sync.wise.syncedToast', { count: jars.length }))
                    },
                    onError: (err: unknown) => setError(errorMessage(err, 'sync.wise.errors.syncFailed')),
                  })}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  {syncMutation.isPending ? t('sync.wise.syncing') : t('sync.wise.sync')}
                </Button>
              )}
            </>
          }
        />
      )}

      {error && <PanelError>{error}</PanelError>}

      {(!isConnected || tokenRefused) && (
        <>
          <PanelIntro>
            {t(tokenRefused ? 'sync.wise.replaceTokenHint' : 'sync.wise.setupHint')}{' '}
            <a
              href={CREATE_TOKEN_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('sync.wise.createToken')}
            </a>
          </PanelIntro>
          <PanelForm
            onSubmit={handleConnect}
            actions={
              <Button
                type="submit"
                size="xs"
                disabled={connectMutation.isPending || !token.trim()}
                className={PANEL_ACTION}
              >
                {connectMutation.isPending && <Loader2 className="animate-spin" />}
                {t(tokenRefused ? 'sync.wise.replaceToken' : 'sync.wise.connect')}
              </Button>
            }
          >
            <PanelField id="wise-token" label={t('sync.wise.token')} icon={KeyRound}>
              <Input
                id="wise-token"
                className={PANEL_INPUT}
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('sync.wise.tokenPlaceholder')}
                autoComplete="off"
                required
              />
            </PanelField>
          </PanelForm>
        </>
      )}

      <p className="text-xs text-pretty text-muted-foreground">{t('sync.wise.scopeNote')}</p>
    </div>
  )
}
