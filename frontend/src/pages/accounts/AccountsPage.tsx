import { Fragment, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAccounts, useAccountTree, useAccountDeletionImpact, useDeleteAccount } from '@/features/accounts/hooks'
import { useHistory } from '@/features/history/hooks'
import { useSavingsSuggestions } from '@/features/savings/hooks'
import { usePeerLoansOverview } from '@/features/peer-loans/hooks'
import { PeerLoansOverviewCard } from '@/components/peer-loan/PeerLoansOverviewCard'
import { AddAccountModal } from '@/components/shared/AddAccountModal'
import { AddPropertyModal } from '@/components/property/AddPropertyModal'
import { ExportAccountsModal } from '@/components/shared/ExportAccountsModal'
import { AddScpiModal } from '@/components/scpi/AddScpiModal'
import { AccountsStackedChart } from '@/components/shared/AccountsStackedChart'
import { Breakdown } from '@/components/shared/Breakdown'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Delta } from '@/components/shared/Delta'
import { EmptyState } from '@/components/shared/EmptyState'
import { KpiTile } from '@/components/shared/KpiTile'
import { PageHeader } from '@/components/shared/PageHeader'
import { ScrollStrip } from '@/components/shared/ScrollStrip'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Eye, EyeOff, PiggyBank, Plus, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ASSET_CLASS_ORDER, assetClassColor, assetClassOf, sumBy } from '@/lib/asset-classes'
import { HOLDING_ACCOUNT_TYPES, LIABILITY_ACCOUNT_TYPES } from '@/lib/constants'
import { accountInvestedAt, accountPnlAt, hasMeasurableGain } from '@/features/accounts/pnl'
import { useAppStore } from '@/stores/app-store'
import type { Account, AccountType } from '@/types/api'
import { accountKpis, groupByAssetClass, groupByInstitution } from './account-groups'
import { AccountEditDialog } from './AccountEditDialog'
import { AccountPanel } from './AccountPanel'
import { AccountRow } from './AccountRow'

type AssetFilter = 'ALL' | 'STOCKS' | 'METALS' | 'SAVINGS' | 'CHECKING' | 'CRYPTO' | 'REAL_ESTATE' | 'RECEIVABLES' | 'DEBTS' | 'OTHER'

const FILTER_KEYS: AssetFilter[] = ['ALL', 'STOCKS', 'METALS', 'SAVINGS', 'CHECKING', 'CRYPTO', 'REAL_ESTATE', 'RECEIVABLES', 'DEBTS', 'OTHER']

const ASSET_FILTER_MAP: Record<AssetFilter, AccountType[] | null> = {
  ALL: null,
  STOCKS: ['PEA', 'COMPTE_TITRES', 'EMPLOYEE_SAVINGS', 'ASSURANCE_VIE', 'PER', 'BROKERAGE'],
  METALS: ['PRECIOUS_METALS'],
  SAVINGS: ['LEP', 'LIVRET_A', 'LDDS', 'LIVRET_JEUNE', 'PEL', 'CEL', 'SAVINGS'],
  CHECKING: ['CHECKING'],
  CRYPTO: ['CRYPTO'],
  REAL_ESTATE: ['REAL_ESTATE', 'SCPI'],
  RECEIVABLES: ['PEER_LOAN'],
  DEBTS: LIABILITY_ACCOUNT_TYPES,
  OTHER: ['OTHER'],
}

const TYPE_GROUP_META: Record<string, { key: string; labelKey: string; color: string }> = {
  STOCKS:      { key: 'STOCKS',      labelKey: 'accounts.filters.STOCKS',      color: assetClassColor('equity') },
  METALS:      { key: 'METALS',      labelKey: 'accounts.filters.METALS',      color: assetClassColor('other') },
  SAVINGS:     { key: 'SAVINGS',     labelKey: 'accounts.filters.SAVINGS',     color: assetClassColor('savings') },
  CHECKING:    { key: 'CHECKING',    labelKey: 'accounts.filters.CHECKING',    color: assetClassColor('cash') },
  CRYPTO:      { key: 'CRYPTO',      labelKey: 'accounts.filters.CRYPTO',      color: assetClassColor('crypto') },
  REAL_ESTATE: { key: 'REAL_ESTATE', labelKey: 'accounts.filters.REAL_ESTATE', color: assetClassColor('realestate') },
  RECEIVABLES: { key: 'RECEIVABLES', labelKey: 'accounts.filters.RECEIVABLES', color: 'var(--chart-4)' },
  DEBTS:       { key: 'DEBTS',       labelKey: 'accounts.filters.DEBTS',       color: 'var(--loss)' },
  OTHER:       { key: 'OTHER',       labelKey: 'accounts.filters.OTHER',       color: 'var(--muted-foreground)' },
}

const TYPE_TO_GROUP: Record<AccountType, string> = {
  PEA: 'STOCKS',
  COMPTE_TITRES: 'STOCKS',
  EMPLOYEE_SAVINGS: 'STOCKS',
  ASSURANCE_VIE: 'STOCKS',
  PER: 'STOCKS',
  BROKERAGE: 'STOCKS',
  PRECIOUS_METALS: 'METALS',
  OTHER: 'OTHER',
  LEP: 'SAVINGS',
  LIVRET_A: 'SAVINGS',
  LDDS: 'SAVINGS',
  LIVRET_JEUNE: 'SAVINGS',
  PEL: 'SAVINGS',
  CEL: 'SAVINGS',
  SAVINGS: 'SAVINGS',
  CHECKING: 'CHECKING',
  CRYPTO: 'CRYPTO',
  REAL_ESTATE: 'REAL_ESTATE',
  SCPI: 'REAL_ESTATE',
  PEER_LOAN: 'RECEIVABLES',
  LOAN: 'DEBTS',
  CREDIT_CARD: 'DEBTS',
}


// ─── Main page ────────────────────────────────────────────────────────────────

export function AccountsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: accounts, isLoading: isAccountsLoading } = useAccounts()
  // The demo adapter has no handler for the export route, and an unhandled route resolves to
  // {} -- which here would download a corrupt workbook instead of failing visibly.
  const demoMode = useAppStore(state => state.demoMode)
  const deleteAccount = useDeleteAccount()
  const { data: savingsSuggestions } = useSavingsSuggestions()
  const hasSavingsSuggestions = Array.isArray(savingsSuggestions) && savingsSuggestions.length > 0

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createType, setCreateType] = useState<AccountType | undefined>()
  const [showPropertyModal, setShowPropertyModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showScpiModal, setShowScpiModal] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [filter, setFilter] = useState<AssetFilter>('ALL')
  const [showClosed, setShowClosed] = useState(false)
  const [groupBy, setGroupBy] = useState<'class' | 'institution'>('class')
  const [panelId, setPanelId] = useState<number | null>(null)
  const panelAccount = accounts?.find((a) => a.id === panelId) ?? null

  // The edit form lives in the URL (`?edit=<id>`) so a link can open it; an unknown id opens
  // nothing. Query structural sharing keeps the account object stable across refetches, so the
  // form's reset-on-defaultValues does not wipe what the user is typing.
  const [searchParams, setSearchParams] = useSearchParams()
  const editParam = searchParams.get('edit')
  const editingAccount = useMemo(
    () => (editParam == null ? null : accounts?.find((a) => String(a.id) === editParam) ?? null),
    [accounts, editParam],
  )

  // A closed peer loan is a 0 EUR receivable. It stays reachable under the Receivables
  // filter, but it is not an "active" account on the default list.
  const peerLoansOverview = usePeerLoansOverview()
  // Closed loans are filtered out with the overview response, so wait for it before
  // painting the list: otherwise a closed (0 EUR) loan flashes for a frame before vanishing.
  const isLoading = isAccountsLoading || peerLoansOverview.isLoading
  const closedPeerLoanIds = useMemo(
    () => new Set((peerLoansOverview.data?.loans ?? [])
      .filter((loan) => loan.closedAt)
      .map((loan) => loan.accountId)),
    [peerLoansOverview.data],
  )
  const visibleAccounts = useMemo(() => {
    if (!accounts) return accounts
    const hideClosed = closedPeerLoanIds.size > 0
      && (filter === 'ALL' || (filter === 'RECEIVABLES' && !showClosed))
    return hideClosed ? accounts.filter((account) => !closedPeerLoanIds.has(account.id)) : accounts
  }, [accounts, filter, showClosed, closedPeerLoanIds])

  // The Receivables filter shows the member-wide overview in place of the total card. The
  // closed toggle only filters the rows: the overview keeps every loan so its history stays
  // readable, and the chart always reflects the full ledger.
  const showsReceivablesOverview = filter === 'RECEIVABLES'
    && (peerLoansOverview.data?.loans.length ?? 0) > 0

  // ── Pocket grouping ──────────────────────────────────────────────────────────
  //
  // Pockets (accounts with parentAccountId set) are excluded from the flat list
  // to avoid double-counting their balance. They are rendered nested under their
  // parent Revolut wallet instead. See useAccountTree for the orphaned-pocket
  // fallback (parent wallet soft-deleted) that keeps such a pocket from vanishing.

  const { nonPocketAccounts, walletGroups: allWalletGroups, standaloneAccounts: allStandaloneAccounts } =
    useAccountTree(visibleAccounts)

  // Render time for the freshness grades, kept out of render (React Compiler purity).
  const [now] = useState(() => Date.now())
  const kpis = useMemo(() => accountKpis(nonPocketAccounts, now), [nonPocketAccounts, now])

  // Deleting the last account on a connection removes that connection too, and a bank one
  // costs a full OAuth re-authorisation to get back -- so the dialog names it first.
  const { data: deletionImpact } = useAccountDeletionImpact(deleteId)

  // All non-pocket IDs for history query (split mode for per-account breakdown)
  const allAccountIds = useMemo(() => nonPocketAccounts.map((a) => a.id), [nonPocketAccounts])
  const { data: historyData, isLoading: isHistoryLoading } = useHistory(allAccountIds, 12, true)

  // Non-pocket accounts filtered by type
  const filteredNonPockets = useMemo(() => {
    const types = ASSET_FILTER_MAP[filter]
    if (!types) return nonPocketAccounts
    return nonPocketAccounts.filter((a) => types.includes(a.type))
  }, [nonPocketAccounts, filter])

  // Wallet groups: parents that have child pockets (e.g. Revolut wallet), filtered by
  // the wallet's own type — pockets are shown in full regardless of the asset filter.
  const walletGroups = useMemo(() => {
    const types = ASSET_FILTER_MAP[filter]
    if (!types) return allWalletGroups
    return allWalletGroups.filter(({ wallet }) => types.includes(wallet.type))
  }, [allWalletGroups, filter])

  // Standalone accounts: non-pockets without any child pockets, filtered by type
  const standaloneAccounts = useMemo(() => {
    const types = ASSET_FILTER_MAP[filter]
    if (!types) return allStandaloneAccounts
    return allStandaloneAccounts.filter((a) => types.includes(a.type))
  }, [allStandaloneAccounts, filter])

  const groups = useMemo(() => {
    const items = [
      ...walletGroups.map(({ wallet, pockets }) => ({ account: wallet, pockets })),
      ...standaloneAccounts.map((account) => ({ account, pockets: [] })),
    ]
    if (groupBy === 'institution') {
      return groupByInstitution(items).map((g) => ({
        ...g,
        label: g.label ?? t(`accounts.groupBy.${g.key}`),
        color: null,
      }))
    }
    return groupByAssetClass(items).map((g) => ({
      ...g,
      label: g.key === 'debts' ? t('accounts.filters.DEBTS')
        : g.key === 'receivables' ? t('accounts.filters.RECEIVABLES')
        : t(`assetClasses.${g.key}`),
      color: g.key === 'debts' || g.key === 'receivables' ? 'var(--muted-foreground)' : assetClassColor(g.key),
    }))
  }, [walletGroups, standaloneAccounts, groupBy, t])

  // Gross assets of the filter by class; sumBy leaves liabilities and empty classes out.
  const classBreakdown = useMemo(() =>
    sumBy(filteredNonPockets.map((a) => ({ type: a.type, amount: a.currentBalanceEur })), assetClassOf, ASSET_CLASS_ORDER)
      .sort((a, b) => b.amount - a.amount)
      .map(({ key, amount }) => ({ key, amount, label: t(`assetClasses.${key}`), color: assetClassColor(key) })),
  [filteredNonPockets, t])

  // Whether the current filter has a gain/loss worth showing: an investment account, whose
  // basis comes from its holdings, or a property, whose basis is its purchase price plus fees.
  // Cash-only filters are excluded on purpose -- their PnL is always 0.
  const hasPnl = filteredNonPockets.some(
    a => HOLDING_ACCOUNT_TYPES.includes(a.type) || hasMeasurableGain(a)
  )

  // Summary card values (pockets excluded — their balance is already in the wallet)
  const totalBalance = filteredNonPockets.reduce(
    (sum, a) => (a.type === 'LOAN' ? sum - a.currentBalanceEur : sum + a.currentBalanceEur),
    0,
  )

  // PnL from the latest history point for filtered non-pocket accounts
  const { pnl, pnlPct, totalInvested } = useMemo(() => {
    if (!historyData || !Array.isArray(historyData) || historyData.length === 0 || filteredNonPockets.length === 0) {
      return { pnl: null, pnlPct: null, totalInvested: null }
    }
    const latest = historyData[historyData.length - 1]
    if (!latest || !latest.accounts) return { pnl: null, pnlPct: null, totalInvested: null }

    let inv = 0
    let pnlSum = 0
    let hasObservation = false
    let hasUnknownBasis = false
    for (const a of filteredNonPockets) {
      const ap = latest.accounts[String(a.id)]
      if (ap) {
        hasObservation = true
        const accountInvested = accountInvestedAt(a, ap)
        const accountPnl = accountPnlAt(a, ap)
        if (accountInvested == null || accountPnl == null) {
          hasUnknownBasis = true
          continue
        }
        inv += accountInvested
        pnlSum += accountPnl
      }
    }
    if (!hasObservation || hasUnknownBasis) {
      return { pnl: null, pnlPct: null, totalInvested: null }
    }
    const pct = inv > 0 ? (pnlSum / inv) * 100 : null
    return { pnl: pnlSum, pnlPct: pct, totalInvested: inv }
  }, [historyData, filteredNonPockets])


  // Chart accounts: grouped by type when ALL, individual accounts otherwise
  const chartAccounts = useMemo(() => {
    if (!accounts) return []
    if (filter !== 'ALL') {
      return nonPocketAccounts.filter((a) => ASSET_FILTER_MAP[filter]!.includes(a.type))
    }
    return Object.values(TYPE_GROUP_META).map((meta) => ({
      id: meta.key as unknown as number,
      name: t(meta.labelKey),
      type: 'OTHER' as AccountType,
      provider: null,
      currency: 'EUR',
      currentBalance: 0,
      currentBalanceEur: 0,
      lastSyncedAt: null,
      isManual: false,
      color: meta.color,
      ticker: null,
      logoUrl: null,
      logoKey: null,
      createdAt: '',
      hidden: false,
    }))
  }, [accounts, nonPocketAccounts, filter, t])

  // Chart PnL data from split history (non-pocket accounts only)
  const chartPnlData = useMemo(() => {
    if (!historyData || !Array.isArray(historyData) || !accounts) return []

    if (filter !== 'ALL') {
      const shown = nonPocketAccounts.filter(a => ASSET_FILTER_MAP[filter]!.includes(a.type))

      return historyData
        .filter((p) => p.accounts)
        .map((point) => {
          const row: { date: string; [key: string]: string | number } = { date: point.date! }
          for (const a of shown) {
            const ap = point.accounts![String(a.id)]
            if (ap) {
              const accountPnl = accountPnlAt(a, ap)
              if (accountPnl != null) row[String(a.id)] = accountPnl
            }
          }
          return row
        })
    }

    // ALL → aggregate PnL per type group, pockets excluded. Grouped by account rather than by
    // id string, because a property's PnL is only computable from the account itself (its cost
    // basis lives there).
    const groupMembers: Record<string, Account[]> = {}
    for (const a of nonPocketAccounts) {
      const group = TYPE_TO_GROUP[a.type]
      if (!groupMembers[group]) groupMembers[group] = []
      groupMembers[group].push(a)
    }

    return historyData
      .filter((p) => p.accounts)
      .map((point) => {
        const row: { date: string; [key: string]: string | number } = { date: point.date! }
        for (const [group, members] of Object.entries(groupMembers)) {
          let pnlSum = 0
          let hasObservation = false
          let hasUnknownBasis = false
          for (const a of members) {
            const ap = point.accounts![String(a.id)]
            if (ap) {
              hasObservation = true
              const invested = accountInvestedAt(a, ap)
              const accountPnl = accountPnlAt(a, ap)
              if (invested == null || accountPnl == null) {
                hasUnknownBasis = true
                continue
              }
              pnlSum += accountPnl
            }
          }
          if (hasObservation && !hasUnknownBasis) row[group] = pnlSum
        }
        return row
      })
  }, [historyData, accounts, nonPocketAccounts, filter])

  // With the Immobilier filter on, "add an account" almost certainly means "add a property",
  // so the primary action goes straight to the guided flow instead of the generic picker.
  const addingProperty = filter === 'REAL_ESTATE'

  function handleOpenCreate(type?: AccountType) {
    if (!type && addingProperty) {
      setShowPropertyModal(true)
      return
    }
    setCreateType(type)
    setShowCreateModal(true)
  }

  function handleOpenEdit(account: Account) {
    setSearchParams((params) => { params.set('edit', String(account.id)); return params }, { replace: true })
  }

  function closeEdit() {
    setSearchParams((params) => { params.delete('edit'); return params }, { replace: true })
  }

  async function handleConfirmDelete() {
    if (deleteId === null) return
    await deleteAccount.mutateAsync(deleteId)
    setDeleteId(null)
  }

  const hasAnyAccounts = (accounts?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('accounts.title')}
        actions={
          <div className="flex items-center gap-2">
            {!demoMode && (
              <Button
                onClick={() => setShowExportModal(true)}
                size="sm"
                variant="outline"
                disabled={!accounts || accounts.length === 0}
              >
                <Download className="size-4" />
                {t('accounts.export.button')}
              </Button>
            )}
            <Button onClick={() => handleOpenCreate()} size="sm">
              <Plus className="size-4" />
              {addingProperty ? t('property.add.action') : t('accounts.addAccount')}
            </Button>
            {filter === 'RECEIVABLES' && (
              <Button onClick={() => handleOpenCreate('PEER_LOAN')} size="sm" variant="outline">
                <Plus className="size-4" />
                {t('peerLoan.create')}
              </Button>
            )}
            {addingProperty && (
              <Button onClick={() => setShowScpiModal(true)} size="sm" variant="outline">
                <Plus className="size-4" />
                {t('scpi.add.action')}
              </Button>
            )}
            {filter === 'RECEIVABLES' && closedPeerLoanIds.size > 0 && (
              <Button
                onClick={() => setShowClosed((value) => !value)}
                size="sm"
                variant="outline"
                aria-pressed={showClosed}
              >
                {showClosed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                {t(showClosed ? 'accounts.hideClosedLoans' : 'accounts.showClosedLoans')}
              </Button>
            )}
          </div>
        }
      />

      {/* Savings suggestions banner */}
      {hasSavingsSuggestions && (
        <div className="flex items-center gap-3 rounded-2xl bg-card py-2 pr-2 pl-4 ring-1 ring-foreground/10">
          <PiggyBank className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-sm font-medium">
            {t('savings.suggestionsBanner', { count: savingsSuggestions!.length })}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-9 shrink-0 px-4"
            onClick={() => navigate(`/accounts/${savingsSuggestions![0].accountId}`)}
          >
            {t('savings.configureSavings')}
          </Button>
        </div>
      )}

      {hasAnyAccounts && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            label={t('dashboard.kpi.grossAssets')}
            value={<CurrencyDisplay value={kpis.assets} />}
            footer={<>{t('common.labelColon', { label: t('dashboard.netWorth') })} <CurrencyDisplay value={kpis.assets - kpis.debts} /></>}
          />
          <KpiTile
            label={t('dashboard.kpi.debts')}
            value={<CurrencyDisplay value={kpis.debts} />}
            footer={kpis.debts > 0 ? undefined : t('dashboard.kpi.noLoan')}
          />
          <KpiTile
            label={t('accounts.kpi.tracked')}
            value={kpis.count}
            footer={t('accounts.kpi.manual', { count: kpis.manual })}
          />
          <KpiTile
            label={t('accounts.kpi.upToDate')}
            value={kpis.synced > 0 ? `${kpis.upToDate} / ${kpis.synced}` : '—'}
            footer={kpis.synced > 0 ? t('accounts.kpi.upToDateHint') : t('accounts.kpi.noSynced')}
          />
        </div>
      )}

      {/* Wrapped: the strip's own -m-1 (focus-ring room) would cancel the space-y gap below it. */}
      {hasAnyAccounts && (
        <div>
        <ScrollStrip activeKey={filter}>
          <div className="flex w-max items-center gap-1 md:w-auto md:flex-wrap">
            {FILTER_KEYS.map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  'inline-flex h-10 min-w-32 items-center justify-center rounded-md px-6 text-sm font-medium transition-[background-color,color]',
                  filter === f
                    ? 'bg-primary/12 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {t(`accounts.filters.${f}`)}
              </button>
            ))}
          </div>
        </ScrollStrip>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : !hasAnyAccounts ? (
        <EmptyState
          className="min-h-[calc(100vh-14rem)]"
          icon={<Wallet className="size-12" />}
          title={t('accounts.noAccounts')}
          action={{ label: t('accounts.addAccount'), onClick: () => handleOpenCreate() }}
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-12">
          {showsReceivablesOverview && peerLoansOverview.data && (
            <div className="min-w-0 lg:col-span-12">
              <PeerLoansOverviewCard data={peerLoansOverview.data} />
            </div>
          )}
          {filteredNonPockets.length === 0 && !showsReceivablesOverview ? (
            <EmptyState
              className="lg:col-span-7"
              icon={<Wallet className="size-12" />}
              title={t('accounts.noAccounts')}
              action={{
                label: addingProperty ? t('property.add.action') : t('accounts.addAccount'),
                onClick: () => handleOpenCreate(),
              }}
            />
          ) : filteredNonPockets.length === 0 ? (
            // Every loan closed and hidden: the overview above still lists them.
            null
          ) : (
            <Card className="lg:col-span-7">
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{t('dashboard.kpi.accountCount', { count: filteredNonPockets.length })}</CardTitle>
                <SegmentedControl
                  ariaLabel={t('accounts.groupBy.label')}
                  value={groupBy}
                  onChange={setGroupBy}
                  options={[
                    { value: 'class', label: t('accounts.groupBy.class') },
                    { value: 'institution', label: t('accounts.groupBy.institution') },
                  ]}
                />
              </CardHeader>
              <CardContent className="divide-y divide-border px-2">
                {groups.map((group) => (
                  <section key={group.key} aria-labelledby={`group-${group.key}`} className="py-2">
                    <div className="flex items-center py-1">
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3">
                        <span id={`group-${group.key}`} className="inline-flex min-w-0 items-center gap-2 text-[13px] font-semibold">
                          {/* Colour follows the asset class; an institution has none. */}
                          {group.color && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />}
                          <span className="truncate">{group.label}</span>
                        </span>
                        <CurrencyDisplay value={group.total} className="shrink-0 text-[13px] font-semibold tabular-nums" />
                      </div>
                      {/* The rows' edit / delete column, so the total sits in line with the balances. */}
                      <span className="hidden w-16 shrink-0 sm:block" aria-hidden />
                    </div>
                    <ul>
                      {group.items.map(({ account, pockets }) => (
                        <Fragment key={account.id}>
                          <AccountRow
                            account={account}
                            now={now}
                            closed={closedPeerLoanIds.has(account.id)}
                            onOpen={() => setPanelId(account.id)}
                            onEdit={() => handleOpenEdit(account)}
                            onDelete={() => setDeleteId(account.id)}
                          />
                          {/* Pockets sit under their wallet; their balance is already in it. */}
                          {pockets.map((pocket) => (
                            <AccountRow
                              key={pocket.id}
                              account={pocket}
                              now={now}
                              nested
                              onOpen={() => setPanelId(pocket.id)}
                              onEdit={() => handleOpenEdit(pocket)}
                            />
                          ))}
                        </Fragment>
                      ))}
                    </ul>
                  </section>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
            {/* Total of the current filter */}
            {filter !== 'RECEIVABLES' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('accounts.total')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <CurrencyDisplay value={totalBalance} className="text-3xl leading-tight font-semibold tracking-tight tabular-nums" />
                {hasPnl && pnl !== null && totalInvested !== null && totalInvested > 0 && (
                  <Delta amount={pnl} percent={pnlPct}>{t('dashboard.portfolioPerformance')}</Delta>
                )}
              </CardContent>
            </Card>
            )}

            {classBreakdown.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('accounts.breakdown.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Breakdown
                    items={classBreakdown}
                    defaultView="bar"
                    centerLabel={t('dashboard.grossAssets')}
                    ariaLabel={t('accounts.breakdown.title')}
                  />
                </CardContent>
              </Card>
            )}

            {/* PnL chart */}
            {hasPnl && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('accounts.pnl')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isHistoryLoading ? (
                    <Skeleton className="h-[250px] w-full rounded-xl" />
                  ) : (
                    <AccountsStackedChart accounts={chartAccounts} data={chartPnlData} />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {showPropertyModal && (
        <AddPropertyModal open onOpenChange={setShowPropertyModal} />
      )}

      <ExportAccountsModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        accounts={accounts ?? []}
      />
      {showScpiModal && (
        <AddScpiModal open onOpenChange={setShowScpiModal} />
      )}


      <AddAccountModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        defaultType={createType}
        onCreated={(created) => {
          if (created.type === 'PEER_LOAN') {
            navigate(`/accounts/${created.id}`)
          }
        }}
      />

      <AccountPanel
        account={panelAccount}
        onClose={() => setPanelId(null)}
        onEdit={(account) => { setPanelId(null); handleOpenEdit(account) }}
        onDelete={(account) => { setPanelId(null); setDeleteId(account.id) }}
      />

      <AccountEditDialog account={editingAccount} onClose={closeEdit} />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        title={t('accounts.deleteAccount')}
        description={
          deletionImpact?.removesConnection
            ? `${t('accounts.deleteConfirm')} ${t('accounts.deleteRemovesConnection', { connection: deletionImpact.connectionLabel })}`
            : t('accounts.deleteConfirm')
        }
        onConfirm={handleConfirmDelete}
        loading={deleteAccount.isPending}
        variant="destructive"
      />
    </div>
  )
}
