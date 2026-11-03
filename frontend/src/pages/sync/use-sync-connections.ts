import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import {
  useBankSyncStatus,
  useProviderStatus,
  useProviderSync,
  useCryptoExchangeStatuses,
  useCryptoWallets,
  useTrSessionStatus,
  useRevolutStatus,
  useStartRevolutSync,
  useSyncProgress,
  useConfirmRevolutSync,
  useFinaryConnectionStatus,
  useRetryBankSync,
  useReconnectBankSync,
  useSyncCryptoExchange,
  useSyncCryptoWallet,
  useSyncTradeRepublic,
  useDegiroSessionStatus,
  useSyncDegiro,
  useIbkrStatus,
  useSyncIbkr,
  useSimplefinStatus,
  useSyncSimplefin,
} from '@/features/sync/hooks'
import { useAccounts } from '@/features/accounts/hooks'
import { syncKeys } from '@/features/sync/keys'
import { revolutErrorLabel } from '@/features/sync/revolut-phase'
import { formatApiError, formatTrAuthError, isTrSessionDeadError } from '@/lib/errors'
import { logoKeyUrl, providerLogoUrl } from '@/lib/provider-logos'
import type { Account } from '@/types/api'
import { catalogEntry, type ProviderCategory } from './catalog'

export const REVOLUT_CONNECTION_ID = 'revolut'

export type ProviderType = 'bank' | 'exchange' | 'wallet' | 'tr' | 'finary' | 'bourso' | 'revolut'
  | 'amundi' | 'fortuneo' | 'bourse-direct' | 'degiro' | 'ibkr' | 'simplefin'
  | 'amex' | 'corum' | 'sofidy' | 'caisse-epargne' | 'cmes' | 'cic'

export interface SyncConnection {
  id: string
  providerType: ProviderType
  name: string
  status: string
  lastSyncedAt: string | null
  syncId?: number
  /** Session-based providers open their view to re-authenticate instead of firing a doomed sync. */
  needsReauth?: boolean
  /** Its view can log in again from stored credentials, so the row asks it to start at once. */
  canReconnect?: boolean
  /** The `?tab=` key of the provider's view on /sync. */
  viewKey: string
  /** The family it belongs to in the catalog, shown as the row's kind. */
  category: ProviderCategory
  logo: string | null
}

const VIEW_KEY: Partial<Record<ProviderType, string>> = { bank: 'banks', exchange: 'exchanges', wallet: 'wallets' }

/** The other providers are named like their view. */
function viewKeyOf(type: ProviderType): string {
  return VIEW_KEY[type] ?? type
}

/** connected / never synced / to reconnect / last run failed: the four states a row shows. */
export type ConnectionState = 'connected' | 'never' | 'expired' | 'error'

export function connectionState(c: SyncConnection): ConnectionState {
  switch (c.status) {
    case 'FAILED':
    case 'ERROR':
      return 'error'
    case 'SESSION_EXPIRED':
    case 'EXPIRED':
    case 'TOTP_REQUIRED':
      return 'expired'
    default:
      return c.lastSyncedAt ? 'connected' : 'never'
  }
}

/**
 * The Sync-page view a row's button opens instead of syncing in place, or undefined when the
 * row syncs inline. Single source of truth for both the row button and the batch filter
 * (`isBatchSyncable`) so the two cannot disagree about who navigates:
 * - Finary is a manual two-phase import;
 * - an expired session re-authenticates through its own view's form;
 * - Revolut without remembered credentials needs the phone+passcode form (and a mobile approval).
 */
export function ownTab(c: SyncConnection, revolutRemembered: boolean): string | undefined {
  if (c.providerType === 'finary') return 'finary'
  if (c.needsReauth) return c.viewKey
  if (c.providerType === 'revolut' && !revolutRemembered) return 'revolut'
  return undefined
}

/** The link a row opens: its view, asking it to reconnect at once when credentials are stored. */
export function ownTabHref(c: SyncConnection, tab: string): string {
  return `/sync?tab=${tab}${c.needsReauth && c.canReconnect ? '&reconnect=1' : ''}`
}

/**
 * The rows that cannot sync until the user does something: a lapsed session, a Trade Republic
 * without a session, a Revolut without remembered credentials, a dead bank consent. Finary
 * is not one of them: it is connected, its sync merely runs from its own view.
 */
export function needsReconnect(c: SyncConnection, trActive: boolean, revolutRemembered: boolean): boolean {
  if (c.providerType === 'finary') return c.status === 'TOTP_REQUIRED'
  if (c.providerType === 'tr') return !trActive
  if (c.providerType === 'revolut') return !revolutRemembered
  if (c.providerType === 'bank') return c.status === 'EXPIRED' || c.status === 'FAILED'
  return c.needsReauth === true
}

/** Every connection of the member, from the status of each connector. */
export function useSyncConnections() {
  const { data: banks, isLoading: banksLoading } = useBankSyncStatus()
  const { data: exchanges, isLoading: exchangesLoading } = useCryptoExchangeStatuses()
  const { data: wallets, isLoading: walletsLoading } = useCryptoWallets()
  const { data: trStatus } = useTrSessionStatus()
  const { data: boursoStatus } = useProviderStatus('bourso')
  const { data: caisseEpargneStatus } = useProviderStatus('caisseEpargne')
  const { data: revolutStatus } = useRevolutStatus()
  const { data: finaryStatus } = useFinaryConnectionStatus()
  const { data: amundiStatus } = useProviderStatus('amundi')
  const { data: fortuneoStatus } = useProviderStatus('fortuneo')
  const { data: bourseDirectStatus } = useProviderStatus('bourseDirect')
  const { data: degiroStatus } = useDegiroSessionStatus()
  const { data: ibkrStatus } = useIbkrStatus()
  const { data: simplefinStatus } = useSimplefinStatus()
  const { data: amexStatus } = useProviderStatus('amex')
  const { data: corumStatus } = useProviderStatus('corum')
  const { data: sofidyStatus } = useProviderStatus('sofidy')
  const { data: cmesStatus } = useProviderStatus('cmes')
  const { data: cicStatus } = useProviderStatus('cic')
  const { data: accounts } = useAccounts()

  const trActive = trStatus?.isActive === true
  const revolutRemembered = revolutStatus?.remembered === true

  // Show TR if: there are active TR accounts, the session is active, or the session
  // is expired but was previously created (expiresAt != null). This keeps TR visible even when
  // accounts were soft-deleted — the session still exists and the user can reconnect from here.
  // isActive=false + expiresAt=null means no session has ever been created → hide TR.
  const hasTrSession = trStatus?.isActive === true || trStatus?.expiresAt != null
  const hasTrAccount = (accounts?.some(a => a.provider === 'Trade Republic') ?? false) || hasTrSession
  // Same "keep visible across soft-delete" rule as TR — see comment above.
  // Remembered credentials play the role expiresAt played for TR: they mean
  // a Revolut connection exists even if every synced account was soft-deleted.
  const hasRevolutSession = revolutStatus?.connected === true || revolutStatus?.remembered === true
  const hasRevolutAccount = (accounts?.some(a => a.provider === 'Revolut') ?? false) || hasRevolutSession

  /**
   * The connectors that hold one session per member. Each is listed when its session is live
   * *or* the user still has accounts from it — a dead session must stay visible and
   * re-authenticatable rather than disappear from the list, the same rule Trade Republic
   * already followed. `provider` is the exact string the connector stamps on the accounts it
   * creates (see each service's PROVIDER constant). CORUM and Sofidy also match an account
   * through its SCPI fund code: a manual SCPI they adopted keeps the provider the user typed.
   */
  const sessionProviders = useMemo(() => [
    {
      type: 'amundi' as const, name: 'Amundi', provider: 'Amundi Épargne Salariale',
      active: amundiStatus?.isActive ?? false, lastSyncedAt: amundiStatus?.lastSyncCompletedAt ?? null,
      failed: amundiStatus?.syncStatus === 'FAILED',
    },
    {
      type: 'fortuneo' as const, name: 'Fortuneo', provider: 'Fortuneo',
      active: fortuneoStatus?.isActive ?? false, lastSyncedAt: fortuneoStatus?.lastSyncCompletedAt ?? null,
      failed: fortuneoStatus?.syncStatus === 'FAILED',
    },
    {
      type: 'bourso' as const, name: 'BoursoBank', provider: 'BoursoBank',
      active: boursoStatus?.isActive ?? false, lastSyncedAt: boursoStatus?.lastSyncCompletedAt ?? null,
      failed: boursoStatus?.syncStatus === 'FAILED',
    },
    {
      type: 'caisse-epargne' as const, name: "Caisse d'Epargne", provider: "Caisse d'Epargne",
      active: caisseEpargneStatus?.isActive ?? false, lastSyncedAt: caisseEpargneStatus?.lastSyncCompletedAt ?? null,
      failed: caisseEpargneStatus?.syncStatus === 'FAILED',
    },
    {
      type: 'bourse-direct' as const, name: 'Bourse Direct', provider: 'Bourse Direct',
      active: bourseDirectStatus?.isActive ?? false, lastSyncedAt: bourseDirectStatus?.lastSyncCompletedAt ?? null,
      failed: bourseDirectStatus?.syncStatus === 'FAILED',
    },
    {
      type: 'degiro' as const, name: 'DEGIRO', provider: 'DEGIRO',
      active: degiroStatus?.isActive ?? false, lastSyncedAt: degiroStatus?.lastSyncedAt ?? null,
      failed: degiroStatus?.status === 'FAILED',
      // DEGIRO says so explicitly; the others only ever report an inactive session.
      reauth: degiroStatus?.status === 'REAUTH_REQUIRED',
    },
    {
      // `connected` stays true through a failed sync -- the Flex connection exists, it is the
      // last run that broke -- so without `failed` an errored IBKR row would read as healthy.
      type: 'ibkr' as const, name: 'Interactive Brokers', provider: 'Interactive Brokers',
      active: ibkrStatus?.connected ?? false, lastSyncedAt: ibkrStatus?.lastSyncedAt ?? null,
      failed: ibkrStatus?.status === 'ERROR',
    },
    {
      type: 'simplefin' as const, name: 'SimpleFIN', provider: 'SimpleFIN',
      active: simplefinStatus?.connected ?? false, lastSyncedAt: simplefinStatus?.lastSyncedAt ?? null,
      failed: simplefinStatus?.status === 'ERROR',
    },
    {
      type: 'amex' as const, name: 'American Express', provider: 'American Express',
      active: amexStatus?.isActive ?? false, lastSyncedAt: amexStatus?.lastSyncCompletedAt ?? null,
      failed: amexStatus?.syncStatus === 'FAILED',
    },
    {
      type: 'corum' as const, name: 'CORUM', provider: 'CORUM',
      ownsAccount: (a: Account) => a.scpi?.corumFundCode != null,
      active: corumStatus?.isActive ?? false, lastSyncedAt: corumStatus?.lastSyncCompletedAt ?? null,
      failed: corumStatus?.syncStatus === 'FAILED',
    },
    {
      type: 'sofidy' as const, name: 'Sofidy', provider: 'Sofidy',
      ownsAccount: (a: Account) => a.scpi?.sofidyFundCode != null,
      active: sofidyStatus?.isActive ?? false, lastSyncedAt: sofidyStatus?.lastSyncCompletedAt ?? null,
      failed: sofidyStatus?.syncStatus === 'FAILED',
    },
    {
      type: 'cmes' as const, name: 'Crédit Mutuel / CIC Épargne Salariale', provider: 'Crédit Mutuel Épargne Salariale',
      active: cmesStatus?.isActive ?? false, lastSyncedAt: cmesStatus?.lastSyncCompletedAt ?? null,
      // A stored session is never IDLE (it is queued as it is created): an expired one is kept
      // even before its first sync created an account, so the saver can reconnect from here.
      hasSession: cmesStatus != null && cmesStatus.syncStatus !== 'IDLE',
      failed: cmesStatus?.syncStatus === 'FAILED',
    },
    {
      type: 'cic' as const, name: 'CIC (livrets)', provider: 'CIC',
      active: cicStatus?.isActive ?? false, lastSyncedAt: cicStatus?.lastSyncCompletedAt ?? null,
      hasSession: cicStatus != null && cicStatus.syncStatus !== 'IDLE',
      failed: cicStatus?.syncStatus === 'FAILED',
      canReconnect: cicStatus?.canReconnect === true,
    },
  ], [cicStatus, cmesStatus, amexStatus, corumStatus, sofidyStatus, amundiStatus, fortuneoStatus, boursoStatus, caisseEpargneStatus, bourseDirectStatus, degiroStatus, ibkrStatus, simplefinStatus])

  // Memoized so its identity is stable across renders — the sync callbacks depend on it.
  const connections = useMemo<SyncConnection[]>(() => {
    const list: SyncConnection[] = []
    const push = (c: Omit<SyncConnection, 'viewKey' | 'category' | 'logo'> & { logo?: string | null }) => {
      const viewKey = viewKeyOf(c.providerType)
      const entry = catalogEntry(viewKey)
      list.push({ ...c, viewKey, category: entry?.category ?? 'banks', logo: c.logo ?? entry?.logo ?? null })
    }
    banks?.filter(b => b.status !== 'CREATED').forEach(b => push({
      id: `bank-${b.id}`, providerType: 'bank', name: b.institutionName, status: b.status,
      lastSyncedAt: b.lastSyncedAt, syncId: b.id,
      // The connection carries no logo; the accounts it created do (Enable Banking catalog).
      logo: accounts?.find(a => a.provider === b.institutionName && a.logoUrl)?.logoUrl ?? null,
    }))
    exchanges?.forEach(e => push({
      id: `exchange-${e.id}`, providerType: 'exchange', name: e.exchangeType, status: e.status,
      lastSyncedAt: e.lastSyncedAt, syncId: e.id, logo: providerLogoUrl(e.exchangeType),
    }))
    wallets?.forEach(w => push({
      id: `wallet-${w.id}`, providerType: 'wallet', name: w.label || `${w.chain} - ${w.address.slice(0, 8)}...`,
      status: 'CONNECTED', lastSyncedAt: w.lastSyncedAt, syncId: w.id, logo: logoKeyUrl('blockchain'),
    }))
    // Show TR when user has a TR account, regardless of session status
    if (hasTrAccount) {
      const trAccount = accounts?.find(a => a.provider === 'Trade Republic')
      push({
        id: 'tr', providerType: 'tr', name: 'Trade Republic',
        status: trActive ? 'active' : 'SESSION_EXPIRED',
        lastSyncedAt: trAccount?.lastSyncedAt ?? null,
      })
    }
    for (const provider of sessionProviders) {
      const hasAccount = accounts?.some(a =>
        (provider.provider !== undefined && a.provider === provider.provider)
        || ('ownsAccount' in provider && provider.ownsAccount?.(a) === true)) ?? false
      const hasSession = 'hasSession' in provider && provider.hasSession === true
      if (!provider.active && !hasSession && !hasAccount) continue
      push({
        id: provider.type,
        providerType: provider.type,
        name: provider.name,
        // A failed run is reported as such rather than as "active": the session may well still
        // be live, but a row that reads healthy while its last sync errored is the state a
        // user never thinks to look into.
        status: provider.failed ? 'FAILED' : provider.active ? 'active' : 'SESSION_EXPIRED',
        lastSyncedAt: provider.lastSyncedAt,
        // A failure is not automatically a credential problem -- a Flex outage or a rate limit
        // clears on its own -- so a failed-but-live session keeps its retry button. Only a
        // session that is gone, or one the provider explicitly flags, goes to its view.
        needsReauth: !provider.active || provider.reauth === true,
        canReconnect: provider.canReconnect,
        logo: providerLogoUrl(provider.provider),
      })
    }
    if (hasRevolutAccount) {
      const revolutAccount = accounts?.find(a => a.provider === 'Revolut')
      push({
        id: REVOLUT_CONNECTION_ID, providerType: 'revolut', name: 'Revolut',
        status: revolutRemembered ? 'active' : 'SESSION_EXPIRED',
        lastSyncedAt: revolutAccount?.lastSyncedAt ?? revolutStatus?.lastSyncedAt ?? null,
      })
    }
    if (finaryStatus?.connected) {
      push({
        id: 'finary', providerType: 'finary', name: 'Finary',
        status: finaryStatus.status || 'CONNECTED',
        lastSyncedAt: finaryStatus.lastSyncedAt,
      })
    }
    return list
  }, [banks, exchanges, wallets, hasTrAccount, accounts, trActive, hasRevolutAccount, revolutRemembered, revolutStatus?.lastSyncedAt, finaryStatus, sessionProviders])

  return {
    connections,
    isLoading: banksLoading || exchangesLoading || walletsLoading,
    trActive,
    revolutRemembered,
  }
}

interface ConnectionSyncOptions {
  connections: SyncConnection[]
  trActive: boolean
  revolutRemembered: boolean
  /** The Trade Republic session turned out dead mid-sync: the caller offers a login. */
  onTrSessionDead?: () => void
}

/**
 * Syncs connections in place: one row, or every row a click can complete ("Sync all"),
 * with each row's spinner, error and success tracked by connection id.
 */
export function useConnectionSync({ connections, trActive, revolutRemembered, onTrSessionDead }: ConnectionSyncOptions) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const retryBankMutation = useRetryBankSync()
  const reconnectBankMutation = useReconnectBankSync()
  const syncExchangeMutation = useSyncCryptoExchange()
  const syncWalletMutation = useSyncCryptoWallet()
  const syncTrMutation = useSyncTradeRepublic()
  const syncBoursoMutation = useProviderSync('bourso')
  const syncCaisseEpargneMutation = useProviderSync('caisseEpargne')
  const syncAmundiMutation = useProviderSync('amundi')
  const syncFortuneoMutation = useProviderSync('fortuneo')
  const syncBourseDirectMutation = useProviderSync('bourseDirect')
  const syncDegiroMutation = useSyncDegiro()
  const syncIbkrMutation = useSyncIbkr()
  const syncSimplefinMutation = useSyncSimplefin()
  const startRevolutMutation = useStartRevolutSync()
  const confirmRevolutMutation = useConfirmRevolutSync()
  const syncAmexMutation = useProviderSync('amex')
  const syncCorumMutation = useProviderSync('corum')
  const syncSofidyMutation = useProviderSync('sofidy')
  const syncCmesMutation = useProviderSync('cmes')
  const syncCicMutation = useProviderSync('cic')

  const [syncingIds, setSyncingIds] = useState<Set<string>>(() => new Set())
  /** Rows whose last sync from here succeeded, for the in-row confirmation. */
  const [syncedIds, setSyncedIds] = useState<Set<string>>(() => new Set())
  /** The rows the last "Sync all" started, to count its progress. */
  const [batchIds, setBatchIds] = useState<string[]>([])
  // Per-connection sync/retry errors, keyed by connection id
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  // Remembered-Revolut in-place sync: a discovery job runs in the background (202 + progress),
  // polled until it finishes, then everything found is confirmed. Mirrors RevolutTab's quick sync.
  const [revolutPolling, setRevolutPolling] = useState(false)
  const revolutProgress = useSyncProgress('revolut', revolutPolling)
  const prevRevolutRunningRef = useRef<boolean | undefined>(undefined)

  const setRowError = useCallback((id: string, message: string) => {
    setRowErrors(prev => ({ ...prev, [id]: message }))
  }, [])
  const clearRowError = useCallback((id: string) => setRowErrors(prev => {
    if (!(id in prev)) return prev
    const next = { ...prev }
    delete next[id]
    return next
  }), [])
  const clearSyncing = useCallback((id: string) => setSyncingIds(prev => {
    const next = new Set(prev)
    next.delete(id)
    return next
  }), [])
  const markSynced = useCallback((id: string) => {
    clearRowError(id)
    setSyncedIds(prev => new Set(prev).add(id))
  }, [clearRowError])

  /**
   * Fires the in-place sync of one row. Never navigates: callers must have routed rows that
   * own a surface (`ownTab`) beforehand, which is why the batch path calls this directly.
   */
  const syncInPlace = useCallback((connection: SyncConnection) => {
    const id = connection.id
    setSyncingIds(prev => new Set(prev).add(id))
    setSyncedIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })

    /** Row-scoped mutation callbacks: clear the spinner, and show the row's error on failure. */
    const rowCallbacks = (formatError: (err: unknown) => string) => ({
      onSettled: () => clearSyncing(id),
      onSuccess: () => markSynced(id),
      onError: (err: unknown) => setRowError(id, formatError(err)),
    })
    const generic = rowCallbacks((err: unknown) => formatApiError(err, t, 'common.errors.serverError'))

    switch (connection.providerType) {
      case 'bank':
        if (connection.syncId !== undefined) retryBankMutation.mutate(connection.syncId, generic)
        break
      case 'exchange':
        if (connection.syncId !== undefined) syncExchangeMutation.mutate(connection.syncId, generic)
        break
      case 'wallet':
        if (connection.syncId !== undefined) syncWalletMutation.mutate(connection.syncId, generic)
        break
      case 'tr':
        syncTrMutation.mutate(undefined, {
          onSettled: () => clearSyncing(id),
          onSuccess: () => markSynced(id),
          onError: (err: unknown) => {
            setRowError(id, formatTrAuthError(err, t))
            // Session truly dead (refresh rejected or session cleared): refetch
            // the now-inactive status and let the caller offer the phone/PIN form.
            if (isTrSessionDeadError(err)) {
              queryClient.invalidateQueries({ queryKey: syncKeys.tr() })
              onTrSessionDead?.()
            }
          },
        })
        break
      case 'bourso': syncBoursoMutation.mutate(undefined, generic); break
      case 'caisse-epargne': syncCaisseEpargneMutation.mutate(undefined, generic); break
      case 'amundi': syncAmundiMutation.mutate(undefined, generic); break
      case 'fortuneo': syncFortuneoMutation.mutate(undefined, generic); break
      case 'bourse-direct': syncBourseDirectMutation.mutate(undefined, generic); break
      case 'degiro': syncDegiroMutation.mutate(undefined, generic); break
      case 'ibkr': syncIbkrMutation.mutate(undefined, generic); break
      case 'simplefin': syncSimplefinMutation.mutate(undefined, generic); break
      case 'amex': syncAmexMutation.mutate(undefined, generic); break
      case 'corum': syncCorumMutation.mutate(undefined, generic); break
      case 'sofidy': syncSofidyMutation.mutate(undefined, generic); break
      case 'cmes': syncCmesMutation.mutate(undefined, generic); break
      case 'cic': syncCicMutation.mutate(undefined, generic); break
      case 'revolut':
        // Remembered credentials: a blank body makes the backend fall back to them. The spinner
        // stays on until the discover → confirm effect below finishes or fails.
        clearRowError(id)
        prevRevolutRunningRef.current = undefined
        startRevolutMutation.mutate({}, {
          onSuccess: () => {
            // The hook caches the start response before this callback. Arm the transition
            // explicitly so a discovery that already finished is handled on the next effect.
            prevRevolutRunningRef.current = true
            setRevolutPolling(true)
          },
          onError: (err: unknown) => {
            setRowError(id, formatApiError(err, t, 'common.errors.serverError'))
            queryClient.invalidateQueries({ queryKey: syncKeys.revolut() })
            prevRevolutRunningRef.current = undefined
            setRevolutPolling(false)
            clearSyncing(id)
          },
        })
        break
      case 'finary':
        // Unreachable: Finary always owns its view (see `ownTab`). Kept so the switch stays exhaustive.
        clearSyncing(id)
        break
    }
  }, [
    retryBankMutation, syncExchangeMutation, syncWalletMutation, syncTrMutation, syncBoursoMutation,
    syncCaisseEpargneMutation, syncAmundiMutation, syncFortuneoMutation, syncBourseDirectMutation,
    syncDegiroMutation, syncIbkrMutation, syncSimplefinMutation, startRevolutMutation, syncAmexMutation,
    syncCorumMutation, syncSofidyMutation, syncCmesMutation, syncCicMutation, queryClient, t,
    clearSyncing, markSynced, setRowError, clearRowError, onTrSessionDead,
  ])

  // Revolut discovery job finished: surface its error, or confirm everything
  // it found. remember=true because confirmSync clears the stored credentials otherwise — this
  // row only syncs in place *because* the session is remembered. voluntary=false keeps accounts
  // the user deleted from coming back.
  useEffect(() => {
    const running = revolutProgress.data?.running
    if (revolutPolling && prevRevolutRunningRef.current === true && running === false) {
      setRevolutPolling(false)
      const data = revolutProgress.data
      const stopSpinner = () => setSyncingIds(prev => {
        const next = new Set(prev)
        next.delete(REVOLUT_CONNECTION_ID)
        return next
      })
      const setError = (message: string) => setRowErrors(prev => ({ ...prev, [REVOLUT_CONNECTION_ID]: message }))
      if (data?.error) {
        setError(revolutErrorLabel(t, data))
        queryClient.invalidateQueries({ queryKey: syncKeys.revolut() })
        stopSpinner()
      } else if (data && data.discovered.length > 0) {
        confirmRevolutMutation.mutate(
          { selectedExternalIds: data.discovered.map(d => d.externalId), remember: true, voluntary: false },
          {
            onSuccess: () => markSynced(REVOLUT_CONNECTION_ID),
            onError: (err: unknown) => setError(formatApiError(err, t, 'common.errors.serverError')),
            onSettled: stopSpinner,
          },
        )
      } else {
        stopSpinner()
      }
    }
    prevRevolutRunningRef.current = running
    // revolutProgress.data/confirmRevolutMutation/t are read through the running dep on purpose
    // (same pattern as RevolutTab) — the mutation object is a fresh one every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revolutPolling, revolutProgress.data?.running])

  // "Sync all" only fires what a single click can actually complete in place: every row that
  // owns a surface (`ownTab`) is excluded, as is TR without a session (inline auth). Those rows
  // keep their own button. The batch calls `syncInPlace` directly, so it can never navigate.
  const isBatchSyncable = useCallback((c: SyncConnection) =>
    !ownTab(c, revolutRemembered) && !(c.providerType === 'tr' && !trActive)
  , [trActive, revolutRemembered])

  const batchable = useMemo(() => connections.filter(isBatchSyncable), [connections, isBatchSyncable])

  const syncAll = useCallback(() => {
    const started = batchable.filter(c => !syncingIds.has(c.id))
    setBatchIds(started.map(c => c.id))
    started.forEach(syncInPlace)
  }, [batchable, syncingIds, syncInPlace])

  /** Starts the bank's OAuth flow again (dead requisition, expired consent), then leaves the app. */
  const reconnectBank = useCallback((connection: SyncConnection) => {
    if (connection.syncId === undefined) return
    reconnectBankMutation.mutate(connection.syncId, {
      onSuccess: (data) => {
        if (data.authLink) window.location.href = data.authLink
      },
      onError: (err: unknown) => setRowError(connection.id, formatApiError(err, t, 'sync.banks.initiateError')),
    })
  }, [reconnectBankMutation, setRowError, t])

  const batchDone = batchIds.filter(id => !syncingIds.has(id)).length
  return {
    syncingIds,
    syncedIds,
    rowErrors,
    syncInPlace,
    isBatchSyncable,
    batchableCount: batchable.length,
    syncAll,
    /** Progress of the last "Sync all" while it runs, else null. */
    batchProgress: batchDone < batchIds.length ? { done: batchDone, total: batchIds.length } : null,
    reconnectBank,
    /** Pending state scoped to one bank row — the mutation is shared across rows. */
    isReconnectingBank: (c: SyncConnection) =>
      reconnectBankMutation.isPending && reconnectBankMutation.variables === c.syncId,
  }
}
