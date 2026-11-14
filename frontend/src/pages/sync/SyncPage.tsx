import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { Eye, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { VISIBILITY_VIEW, isViewKey } from './catalog'
import { ConnectionRow } from './ConnectionRow'
import { ProviderCatalog } from './ProviderCatalog'
import { ProviderView } from './ProviderView'
import {
  needsReconnect,
  ownTab,
  ownTabHref,
  useConnectionSync,
  useSyncConnections,
  type SyncConnection,
} from './use-sync-connections'

/** The member's connections, each with the one action its state calls for. */
function ConnectionsCard({ onOpen }: { onOpen: (href: string) => void }) {
  const { t } = useTranslation()
  const [now] = useState(() => Date.now())
  const { connections, isLoading, trActive, revolutRemembered } = useSyncConnections()
  const sync = useConnectionSync({ connections, trActive, revolutRemembered })
  const toReconnect = connections.filter((c) => needsReconnect(c, trActive, revolutRemembered))
  const rows = [...toReconnect, ...connections.filter((c) => !toReconnect.includes(c))]
  const progress = sync.batchProgress

  function action(c: SyncConnection) {
    if (needsReconnect(c, trActive, revolutRemembered)) {
      const isBank = c.providerType === 'bank'
      const busy = isBank && sync.isReconnectingBank(c)
      return (
        <Button size="xs" variant="outline" className="h-8 px-3 pointer-coarse:h-10" disabled={busy}
          onClick={() => (isBank ? sync.reconnectBank(c) : onOpen(ownTabHref(c, ownTab(c, revolutRemembered) ?? c.viewKey)))}>
          {busy && <Loader2 className="animate-spin" />}
          {t('sync.all.reconnectAction')}
        </Button>
      )
    }
    // Finary syncs from its own view; the row itself opens it.
    if (ownTab(c, revolutRemembered)) return null
    const syncing = sync.syncingIds.has(c.id)
    return (
      <Button size="xs" variant="ghost" className="h-8 px-2.5 pointer-coarse:h-10"
        aria-label={t('sync.all.syncOne', { name: c.name })} disabled={syncing} onClick={() => sync.syncInPlace(c)}>
        {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        <span className="hidden sm:inline">{t('sync.overview.syncNow')}</span>
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sync.overview.title')}</CardTitle>
        <CardDescription className="text-xs">
          {isLoading
            ? t('common.loading')
            : connections.length === 0
              ? t('sync.overview.empty')
              : [
                  t('sync.all.connectionCount', { count: connections.length }),
                  toReconnect.length > 0 && t('sync.view.toReconnect', { count: toReconnect.length }),
                ].filter(Boolean).join(' · ')}
        </CardDescription>
        {!isLoading && sync.batchableCount > 0 && (
          <CardAction>
            <Button size="xs" variant="outline" className="h-8 px-3 pointer-coarse:h-10" disabled={progress !== null || sync.batchBusy} onClick={sync.syncAll}>
              {progress ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {progress
                ? t('sync.all.syncingProgress', { done: progress.done, total: progress.total })
                : t('sync.all.syncAllCount', { count: sync.batchableCount })}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      {(isLoading || rows.length > 0) && (
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 py-1">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-xl" />)}
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((c) => (
                <ConnectionRow
                  key={c.id}
                  connection={c}
                  now={now}
                  kind={t(`sync.catalog.kind.${c.category}`)}
                  onOpen={() => onOpen(`/sync?tab=${c.viewKey}`)}
                  error={sync.rowErrors[c.id]}
                  synced={sync.syncedIds.has(c.id)}
                  actions={action(c)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  )
}

/**
 * /sync: an overview of the member's connections and the catalog to add one; choosing a
 * provider opens its view at `/sync?tab=<key>`. The keys are the tab keys of the former tab
 * strip, kept so every deep link (Sync-all modal, bank OAuth callback, `?reconnect=1`) works.
 */
export function SyncPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // The bank OAuth callback lands on /sync/callback?code=… with no tab: it belongs to the banks view.
  const requested = searchParams.get('tab') ?? (searchParams.has('code') ? 'banks' : null)
  // An unknown key (an old bookmark) falls back to the overview rather than an empty page.
  const view = isViewKey(requested) ? requested : null
  const top = useRef<HTMLDivElement>(null)

  // A view replaces the page: start it at the top rather than where the catalog was scrolled.
  useEffect(() => {
    top.current?.scrollIntoView?.({ block: 'start' })
  }, [view])

  const provider = view ? <ProviderView viewKey={view} onBack={() => navigate('/sync')} /> : null

  return (
    <div ref={top} className="scroll-mt-4 md:scroll-mt-6">
      {provider ?? (
        <>
          <PageHeader
            title={t('sync.title')}
            actions={(
              <Button variant="outline" onClick={() => navigate(`/sync?tab=${VISIBILITY_VIEW.key}`)}>
                <Eye />
                {t('sync.visibility.title')}
              </Button>
            )}
          />
          <div className="space-y-4">
            <ConnectionsCard onOpen={navigate} />
            <Card>
              <CardHeader>
                <CardTitle>{t('sync.catalog.title')}</CardTitle>
                <CardDescription className="text-xs">{t('sync.catalog.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ProviderCatalog onSelect={(p) => navigate(`/sync?tab=${p.key}`)} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
