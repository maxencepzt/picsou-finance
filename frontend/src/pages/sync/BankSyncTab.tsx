import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { InstitutionSearch } from '@/components/sync/InstitutionSearch'
import {
  ConnectionState,
  PanelError,
  PanelLoading,
  PanelSection,
  PanelWaiting } from '@/components/sync/ProviderPanel'
import { ProviderMark } from '@/components/shared/ProviderMark'
import { connectionTone } from '@/components/sync/panel-styles'
import { CheckCircle2, ExternalLink, Landmark, Loader2, PiggyBank, RefreshCw, Trash2 } from 'lucide-react'
import { extractErrorMessage, formatApiError } from '@/lib/errors'
import {
  useBankSyncStatus,
  useCompleteBankSync,
  useDeleteBankConnection,
  useInitiateBankSync,
  useReconnectBankSync,
  useRetryBankSync,
  useWiseStatus,
} from '@/features/sync/hooks'

type CallbackStatus = 'completing' | 'done' | 'error'

const WISE_INSTITUTION = /\bwise\b/i

/**
 * Open banking never returns Wise Jars, so a Wise connection says where they come from instead.
 * Only rendered under a Wise row, which keeps the status request off every other member's page.
 */
function WiseJarsHint({ onOpenWiseJars }: { onOpenWiseJars?: () => void }) {
  const { t } = useTranslation()
  const { data: wiseStatus } = useWiseStatus()

  if (wiseStatus?.connected && wiseStatus.status === 'CONNECTED') {
    return (
      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <PiggyBank className="size-4 shrink-0" />
        {t('sync.banks.wiseJarsConnected')}
      </p>
    )
  }
  const failed = wiseStatus?.connected ?? false
  return (
    <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
      <PiggyBank className="size-4 shrink-0" />
      <span>{t(failed ? 'sync.banks.wiseJarsFailed' : 'sync.banks.wiseJarsMissing')}</span>
      {onOpenWiseJars && (
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onOpenWiseJars}>
          {t(failed ? 'sync.banks.wiseJarsOpen' : 'sync.banks.wiseJarsConnect')}
        </Button>
      )}
    </div>
  )
}

function cleanBankCallbackUrl() {
  if (window.location.pathname.endsWith('/sync/callback')) {
    window.history.replaceState(window.history.state, '', '/sync?tab=banks')
  }
}

interface BankSyncTabProps {
  onOpenWiseJars?: () => void
}

export function BankSyncTab({ onOpenWiseJars }: BankSyncTabProps = {}) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const openWiseJars = onOpenWiseJars ?? (() => navigate('/sync?tab=wise'))

  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [callbackStatus, setCallbackStatus] = useState<CallbackStatus | null>(null)
  const [callbackError, setCallbackError] = useState<string | null>(null)
  const [initiateError, setInitiateError] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [retryingIds, setRetryingIds] = useState<Set<number>>(() => new Set())
  const handledCode = useRef<string | null>(null)

  const { mutate: completeSync } = useCompleteBankSync()

  const completeCallback = useCallback((code: string, state: string | null) => {
    completeSync({ code, state }, {
      onSuccess: () => {
        setCallbackStatus('done')
        cleanBankCallbackUrl()
      },
      onError: (err: unknown) => {
        setCallbackStatus('error')
        setCallbackError(extractErrorMessage(err))
      } })
  }, [completeSync])

  useEffect(() => {
    const code = searchParams.get('code')
    if (code && code !== handledCode.current) {
      handledCode.current = code
      setCallbackStatus('completing')
      completeCallback(code, searchParams.get('state'))
    }
  }, [searchParams, completeCallback])

  const { data: connections, isLoading: connectionsLoading } = useBankSyncStatus()
  const initiateMutation = useInitiateBankSync()
  const retryMutation = useRetryBankSync()

  function handleInitiate(institutionId: string, institutionName: string) {
    initiateMutation.mutate({ institutionId, institutionName }, {
      onSuccess: (data) => {
        setInitiateError(null)
        window.location.href = data.authLink
      },
      onError: (err: unknown) => {
        setInitiateError(extractErrorMessage(err, t('sync.banks.initiateError')))
      } })
  }

  async function handleRetry(id: number) {
    setRetryingIds((previous) => new Set(previous).add(id))
    try {
      await retryMutation.mutateAsync(id, {
        onSuccess: () => setRetryError(null),
        onError: (err: unknown) => {
          setRetryError(formatApiError(err, t, 'sync.banks.callbackError'))
        } })
    } catch {
      // The mutation's onError handler renders the translated failure banner.
    } finally {
      setRetryingIds((previous) => {
        const next = new Set(previous)
        next.delete(id)
        return next
      })
    }
  }

  // Re-initiates the OAuth flow for a dead requisition (failed code exchange,
  // expired PSD2 consent) — a plain retry can never fix those.
  const reconnectMutation = useReconnectBankSync()

  function handleReconnect(id: number) {
    reconnectMutation.mutate(id, {
      onSuccess: (data) => {
        setRetryError(null)
        if (data.authLink) window.location.href = data.authLink
      },
      onError: (err: unknown) => {
        setRetryError(formatApiError(err, t, 'sync.banks.initiateError'))
      } })
  }

  const deleteMutation = useDeleteBankConnection()

  function handleDelete() {
    if (deleteId !== null) {
      deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) })
    }
  }

  const connectionToBeDeleted = connections?.find(c => c.id === deleteId)

  return (
    <div className="space-y-4">
      {/* OAuth callback status */}
      {callbackStatus === 'completing' && (
        <PanelWaiting icon={Landmark} title={t('sync.banks.callbackCompleting')} />
      )}
      {callbackStatus === 'done' && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-gain/10 px-4 py-3 text-sm font-medium text-gain">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {t('sync.banks.callbackDone')}
        </p>
      )}
      {callbackStatus === 'error' && (
        <PanelError>
          {`${t('sync.banks.callbackError')}${callbackError ? `: ${callbackError}` : ''}`}
        </PanelError>
      )}

      {initiateError && (
        <PanelError onRetry={() => setInitiateError(null)} retryLabel={t('common.close')}>
          {initiateError}
        </PanelError>
      )}
      {retryError && (
        <PanelError onRetry={() => setRetryError(null)} retryLabel={t('common.close')}>
          {retryError}
        </PanelError>
      )}

      <InstitutionSearch
        layout="page"
        onConnect={handleInitiate}
        connecting={initiateMutation.isPending}
      />

      {/* Active connections */}
      {connectionsLoading ? (
        <PanelLoading />
      ) : !connections || connections.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{t('sync.banks.noConnections')}</p>
      ) : (
        <PanelSection title={t('sync.banks.connected')} aside={connections.length}>
          <p className="pb-2 text-xs text-pretty text-muted-foreground">{t('sync.banks.psd2ScopeNote')}</p>
          {connections.map(conn => {
            const isRetrying = retryingIds.has(conn.id)
            const isReconnecting =
              reconnectMutation.isPending && reconnectMutation.variables === conn.id

            return (
              <div key={conn.id} className="py-2.5">
                <div data-testid="bank-connection" className="flex items-center gap-3">
                  <ProviderMark size="sm" name={conn.institutionName} />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-semibold text-foreground">{conn.institutionName}</p>
                    <ConnectionState tone={connectionTone(conn.status)}>
                      {t(`sync.connectionStatus.${conn.status}`, { defaultValue: conn.status })}
                    </ConnectionState>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {conn.status === 'FAILED' && (
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title={t('sync.banks.retry')}
                          aria-label={t('sync.banks.retry')}
                          onClick={() => void handleRetry(conn.id)}
                          disabled={isRetrying || isReconnecting}
                        >
                          {isRetrying
                            ? <Loader2 className="size-4 animate-spin" />
                            : <RefreshCw className="size-4" />}
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title={t('sync.banks.reconnect')}
                          aria-label={t('sync.banks.reconnect')}
                          onClick={() => handleReconnect(conn.id)}
                          disabled={isRetrying || isReconnecting}
                        >
                          {isReconnecting
                            ? <Loader2 className="size-4 animate-spin" />
                            : <ExternalLink className="size-4" />}
                        </Button>
                      </>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title={t('sync.banks.delete')}
                      aria-label={t('sync.banks.delete')}
                      onClick={() => setDeleteId(conn.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {WISE_INSTITUTION.test(conn.institutionName) && <div className="mt-2 pl-11"><WiseJarsHint onOpenWiseJars={openWiseJars} /></div>}
              </div>
            )
          })}
        </PanelSection>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={t('sync.banks.delete')}
        description={connectionToBeDeleted ? t('sync.banks.deleteConfirm') : ''}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
