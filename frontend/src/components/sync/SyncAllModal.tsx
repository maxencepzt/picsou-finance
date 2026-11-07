import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle, ExternalLink, Info, Loader2, Plus, RefreshCw } from 'lucide-react'
import { useCompleteTrAuth, useInitiateTrAuth } from '@/features/sync/hooks'
import { formatTrAuthError } from '@/lib/errors'
import { formatTimeAgo } from '@/lib/utils'
import { TR_VERIFICATION_CODE_LENGTH } from '@/lib/constants'
import { ConnectionRow } from '@/pages/sync/ConnectionRow'
import {
  needsReconnect,
  ownTab,
  ownTabHref,
  useConnectionSync,
  useSyncConnections,
  type SyncConnection,
} from '@/pages/sync/use-sync-connections'

interface SyncAllModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="size-3.5 shrink-0 cursor-help text-muted-foreground" aria-label={text} />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">{text}</TooltipContent>
    </Tooltip>
  )
}

function GroupTitle({ children, count }: { children: string; count: number }) {
  return (
    <h3 className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-muted-foreground">
      {children}
      <span className="tabular-nums">· {count}</span>
    </h3>
  )
}

export function SyncAllModal({ open, onOpenChange }: SyncAllModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [now] = useState(() => Date.now())

  // TR inline auth state
  const [trAuthStep, setTrAuthStep] = useState<'idle' | 'phone' | 'tan'>('idle')
  const [trPhone, setTrPhone] = useState('')
  const [trPin, setTrPin] = useState('')
  const [trTan, setTrTan] = useState('')
  const [trProcessId, setTrProcessId] = useState<string | null>(null)
  const [trAuthError, setTrAuthError] = useState<string | null>(null)
  const initiateTrMutation = useInitiateTrAuth()
  const completeTrMutation = useCompleteTrAuth()

  const { connections, isLoading, trActive, revolutRemembered } = useSyncConnections()
  const onTrSessionDead = useCallback(() => setTrAuthStep('phone'), [])
  const sync = useConnectionSync({ connections, trActive, revolutRemembered, onTrSessionDead })

  const toReconnect = connections.filter(c => needsReconnect(c, trActive, revolutRemembered))
  const connected = connections.filter(c => !needsReconnect(c, trActive, revolutRemembered))
  const latestSync = connections.reduce<string | null>(
    (latest, c) => (c.lastSyncedAt && (!latest || c.lastSyncedAt > latest) ? c.lastSyncedAt : latest), null)

  function openView(path: string) {
    navigate(path)
    onOpenChange(false)
  }

  function handleSync(connection: SyncConnection) {
    // TR without active session: open inline auth instead of syncing
    if (connection.providerType === 'tr' && !trActive) {
      setTrAuthError(null)
      setTrAuthStep('phone')
      return
    }
    // Rows that own a surface (expired session, Finary, unremembered Revolut) go to their view:
    // those flows need multi-step forms or a mobile approval, and firing a sync would only 401.
    const tab = ownTab(connection, revolutRemembered)
    if (tab) {
      openView(ownTabHref(connection, tab))
      return
    }
    sync.syncInPlace(connection)
  }

  // --- TR inline auth ---
  // Error-state semantics (see docs/features/trade-republic.md): an initiate
  // failure has no valid processId, so stay on the phone/PIN step and clear
  // pending state; a complete failure keeps the processId so the user can
  // retry the code without re-entering phone/PIN.
  function handleTrInitiate(e: React.FormEvent) {
    e.preventDefault()
    initiateTrMutation.mutate(
      { phoneNumber: trPhone, pin: trPin },
      {
        onSuccess: (data) => {
          setTrProcessId(data.processId)
          setTrAuthStep('tan')
          setTrAuthError(null)
        },
        onError: (err: unknown) => {
          setTrAuthError(formatTrAuthError(err, t))
          setTrProcessId(null)
          setTrTan('')
          setTrAuthStep('phone')
        },
      },
    )
  }

  function handleTrComplete(e: React.FormEvent) {
    e.preventDefault()
    if (!trProcessId || trTan.length !== TR_VERIFICATION_CODE_LENGTH) return
    completeTrMutation.mutate(
      { processId: trProcessId, tan: trTan },
      {
        onSuccess: () => {
          resetTrAuth()
          // Query invalidation (status, accounts, dashboard) is handled by
          // useCompleteTrAuth itself; the background sync results arrive via
          // the existing refetch intervals.
        },
        onError: (err: unknown) => {
          setTrAuthError(formatTrAuthError(err, t))
          setTrTan('')
        },
      },
    )
  }

  function resetTrAuth() {
    setTrAuthStep('idle')
    setTrPhone('')
    setTrPin('')
    setTrTan('')
    setTrProcessId(null)
    setTrAuthError(null)
  }

  function trForm() {
    if (trAuthStep === 'idle' || trActive) return null
    return (
      <div className="mt-3 space-y-3 rounded-xl bg-muted/50 p-3">
        <p className="text-xs text-muted-foreground">{t('sync.all.trSlowWarning')}</p>
        {trAuthError && (
          <p className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="size-3.5 shrink-0" />
            {trAuthError}
          </p>
        )}
        {trAuthStep === 'phone' && (
          <form onSubmit={handleTrInitiate} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tr-modal-phone">{t('sync.tr.phone')}</Label>
                <Input id="tr-modal-phone" type="tel" className="h-9" value={trPhone}
                  onChange={e => setTrPhone(e.target.value)} placeholder="+49..." required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tr-modal-pin">{t('sync.tr.pin')}</Label>
                <Input id="tr-modal-pin" type="password" className="h-9" value={trPin}
                  onChange={e => setTrPin(e.target.value)} required />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="xs" className="px-4" disabled={initiateTrMutation.isPending}>
                {initiateTrMutation.isPending && <Loader2 className="animate-spin" />}
                {t('sync.tr.connect')}
              </Button>
              <Button type="button" size="xs" variant="ghost" className="px-4" onClick={resetTrAuth}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        )}
        {trAuthStep === 'tan' && (
          <form onSubmit={handleTrComplete} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tr-modal-tan">{t('sync.tr.tan')}</Label>
              <Input
                id="tr-modal-tan"
                className="h-9 max-w-40 tabular-nums"
                value={trTan}
                onChange={e => setTrTan(e.target.value.replace(/\D/g, '').slice(0, TR_VERIFICATION_CODE_LENGTH))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={TR_VERIFICATION_CODE_LENGTH}
                autoFocus
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="xs" className="px-4"
                disabled={completeTrMutation.isPending || trTan.length !== TR_VERIFICATION_CODE_LENGTH}>
                {completeTrMutation.isPending && <Loader2 className="animate-spin" />}
                {t('sync.tr.connect')}
              </Button>
              <Button type="button" size="xs" variant="ghost" className="px-4" onClick={resetTrAuth}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        )}
      </div>
    )
  }

  function info(connection: SyncConnection) {
    if (connection.providerType === 'tr') return <InfoTip text={t('sync.all.trManualInfo')} />
    if (connection.providerType === 'revolut' && !revolutRemembered) return <InfoTip text={t('sync.all.revolutManualInfo')} />
    return undefined
  }

  function reconnectRow(connection: SyncConnection) {
    const isBank = connection.providerType === 'bank'
    const busy = isBank && sync.isReconnectingBank(connection)
    const retrying = sync.syncingIds.has(connection.id)
    return (
      <ConnectionRow
        key={connection.id}
        connection={connection}
        now={now}
        info={info(connection)}
        error={sync.rowErrors[connection.id]}
        synced={sync.syncedIds.has(connection.id)}
        actions={(
          <>
            {isBank && connection.status === 'FAILED' && (
              <Button size="icon-sm" variant="ghost" className="pointer-coarse:size-10"
                aria-label={t('sync.banks.retry')} title={t('sync.banks.retry')}
                disabled={retrying || busy} onClick={() => sync.syncInPlace(connection)}>
                {retrying ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              </Button>
            )}
            <Button size="xs" variant="outline" className="h-8 px-3 pointer-coarse:h-10"
              title={isBank ? t('sync.banks.reconnect') : t('sync.all.reconnect')}
              disabled={busy || retrying}
              onClick={() => (isBank ? sync.reconnectBank(connection) : handleSync(connection))}>
              {busy && <Loader2 className="animate-spin" />}
              {t('sync.all.reconnectAction')}
            </Button>
          </>
        )}
      >
        {connection.providerType === 'tr' && trForm()}
      </ConnectionRow>
    )
  }

  function connectedRow(connection: SyncConnection) {
    const isSyncing = sync.syncingIds.has(connection.id)
    const tab = ownTab(connection, revolutRemembered)
    const label = tab === 'finary' ? t('sync.all.openFinary') : t('sync.all.syncOne', { name: connection.name })
    return (
      <ConnectionRow
        key={connection.id}
        connection={connection}
        now={now}
        info={info(connection)}
        error={sync.rowErrors[connection.id]}
        synced={sync.syncedIds.has(connection.id)}
        actions={(
          <Button size="icon-sm" variant="ghost" className="pointer-coarse:size-10"
            aria-label={label} title={label} disabled={isSyncing} onClick={() => handleSync(connection)}>
            {isSyncing ? <Loader2 className="animate-spin" /> : tab ? <ExternalLink /> : <RefreshCw />}
          </Button>
        )}
      />
    )
  }

  const progress = sync.batchProgress
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('sync.all.title')}</DialogTitle>
          <DialogDescription>
            {isLoading
              ? t('common.loading')
              : connections.length === 0
                ? t('sync.all.noConnections')
                : [
                    t('sync.all.connectionCount', { count: connections.length }),
                    latestSync && t('sync.all.lastSyncAgo', { time: formatTimeAgo(latestSync) }),
                  ].filter(Boolean).join(' · ')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </li>
            ))}
          </ul>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">{t('sync.all.emptyHint')}</p>
            <Button size="xs" variant="outline" className="px-4" onClick={() => openView('/sync')}>
              <Plus />
              {t('sync.catalog.title')}
            </Button>
          </div>
        ) : (
          <div className="-mx-1 min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
            {toReconnect.length > 0 && (
              <section>
                <GroupTitle count={toReconnect.length}>{t('sync.all.groupReconnect')}</GroupTitle>
                <ul className="divide-y divide-border/60">{toReconnect.map(reconnectRow)}</ul>
              </section>
            )}
            {connected.length > 0 && (
              <section>
                <GroupTitle count={connected.length}>{t('sync.all.groupConnected')}</GroupTitle>
                <ul className="divide-y divide-border/60">{connected.map(connectedRow)}</ul>
              </section>
            )}
          </div>
        )}

        {connections.length > 0 && (
          <DialogFooter className="shrink-0 flex-col gap-2 sm:flex-col">
            {progress && (
              <div
                role="progressbar"
                aria-label={t('sync.all.syncing')}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.done}
                className="h-1 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            )}
            <Button
              className="w-full sm:w-auto sm:self-end"
              onClick={sync.syncAll}
              disabled={progress !== null || isLoading || sync.batchableCount === 0}
            >
              {progress ? (
                <>
                  <Loader2 className="animate-spin" />
                  {t('sync.all.syncingProgress', { done: progress.done, total: progress.total })}
                </>
              ) : (
                <>
                  <RefreshCw />
                  {t('sync.all.syncAllCount', { count: sync.batchableCount })}
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
