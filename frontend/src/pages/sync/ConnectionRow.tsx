import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChevronRight, TriangleAlert } from 'lucide-react'
import { SYNC_FRESHNESS_BOUNDS_MS } from '@/lib/constants'
import { cn, formatTimeAgo, freshnessLevel } from '@/lib/utils'
import { ProviderMark } from '@/components/shared/ProviderMark'
import { connectionState, type ConnectionState, type SyncConnection } from './use-sync-connections'

const DOT: Record<ConnectionState, string> = {
  connected: 'bg-gain',
  never: 'bg-muted-foreground',
  expired: 'bg-warning',
  error: 'bg-loss',
}

const TEXT: Record<ConnectionState, string> = {
  connected: 'text-muted-foreground',
  never: 'text-muted-foreground',
  expired: 'text-warning',
  error: 'text-loss',
}

/** The words of a row's state; Trade Republic and Revolut name a missing session their own way. */
function statusKey(c: SyncConnection): string {
  if (c.status === 'SESSION_EXPIRED') {
    if (c.providerType === 'tr') return 'sync.tr.noSession'
    if (c.providerType === 'revolut') return 'sync.revolut.notConnected'
    return 'sync.all.sessionExpired'
  }
  return `sync.connectionStatus.${c.status}`
}

/** "Synced 2 hours ago", in the warning colour with an icon once the sync is days old. */
function LastSync({ date, now }: { date: string; now: number }) {
  const { t } = useTranslation()
  const level = freshnessLevel(date, SYNC_FRESHNESS_BOUNDS_MS, now)
  const stale = level === 'stale' || level === 'old'
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', stale && 'text-warning')}>
      {stale && <TriangleAlert className="size-3 shrink-0" aria-hidden />}
      {t('sync.all.lastSyncAgo', { time: formatTimeAgo(date) })}
    </span>
  )
}

/** An item of the line after the first: its separator leads it, so a wrap never ends on a dot. */
function Item({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span aria-hidden>·</span>
      {children}
    </span>
  )
}

/** kind · state · last sync (or "never synced"), the state coloured only when it needs attention. */
export function SyncLine({ connection, now, kind, synced }: {
  connection: SyncConnection
  now: number
  kind?: string
  synced?: boolean
}) {
  const { t } = useTranslation()
  const state = connectionState(connection)
  const status = (
    <span className={cn('inline-flex items-center gap-1.5', TEXT[state])}>
      <span className={cn('size-1.5 shrink-0 rounded-full', DOT[state])} aria-hidden />
      {t(statusKey(connection), { defaultValue: connection.status })}
    </span>
  )
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs font-medium text-muted-foreground">
      {/* The kind is left out on a phone, where the line has no room for three items. */}
      {kind && <span className="hidden sm:inline">{kind}</span>}
      {kind ? <><span className="hidden sm:inline" aria-hidden>·</span>{status}</> : status}
      {connection.lastSyncedAt
        ? <Item><LastSync date={connection.lastSyncedAt} now={now} /></Item>
        : state === 'never' && <Item>{t('sync.all.neverSynced')}</Item>}
      {synced && (
        <Item className="text-gain">
          <CheckCircle2 className="size-3 shrink-0" aria-hidden />
          {t('sync.all.synced')}
        </Item>
      )}
    </span>
  )
}

interface ConnectionRowProps {
  connection: SyncConnection
  /** Render time, from the caller's lazy state: keeps `Date.now()` out of render. */
  now: number
  /** Shown before the status: the kind of connection, on the Sync page. */
  kind?: string
  /** Opens the provider's view: the mark and name become one button. */
  onOpen?: () => void
  /** An icon with a tooltip next to the name. */
  info?: ReactNode
  error?: string
  synced?: boolean
  actions?: ReactNode
  /** A form unfolded under the row (Trade Republic's login in the Sync-all modal). */
  children?: ReactNode
}

/** One connection: mark, name, kind · state · last sync, then its action. */
export function ConnectionRow({ connection, now, kind, onOpen, info, error, synced, actions, children }: ConnectionRowProps) {
  const body = (
    <>
      <ProviderMark name={connection.name} logo={connection.logo} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">{connection.name}</span>
          {info}
        </span>
        <SyncLine connection={connection} now={now} kind={kind} synced={synced} />
      </span>
    </>
  )
  return (
    <li className="py-2.5">
      <div className="flex items-center gap-3">
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="-my-1 -ml-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 pl-2 text-left transition-colors hover:bg-muted/60"
          >
            {body}
            <ChevronRight className="mr-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
        )}
        {/* A steady width keeps the chevrons of the open buttons in one column. */}
        {actions && <div className={cn('flex shrink-0 items-center justify-end gap-1', onOpen && 'sm:min-w-32')}>{actions}</div>}
      </div>
      {error && (
        <p className="mt-1.5 flex items-start gap-1.5 pl-12 text-xs text-destructive">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      {children}
    </li>
  )
}
