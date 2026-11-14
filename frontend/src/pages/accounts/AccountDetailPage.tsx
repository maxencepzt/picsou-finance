import { useState, useRef, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useParams, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import {
  useAccount, useAccountHistory, useHoldingsWithLivePrices, useAccountPositions,
  useAccountTransactions, useAddTransaction, useDeleteTransaction,
  useUpdateTransaction, useUpdateHolding, useDeleteHolding, useImportTRTransactions
} from '@/features/accounts/hooks'
import { euroFundLabelKey, hasSyncedEuroFund } from '@/features/accounts/euro-fund'
import { useCategories, useCategorize } from '@/features/budget/hooks'
import { useHistory } from '@/features/history/hooks'
import { BalanceHistoryChart } from '@/components/shared/BalanceHistoryChart'
import { NetWorthChart } from '@/components/shared/NetWorthChart'
import { HoldingsTable } from '@/components/shared/HoldingsTable'
import { PositionsByProduct } from '@/components/shared/PositionsByProduct'
import { RealizedPnlSection } from '@/components/shared/RealizedPnlSection'
import { TransactionsList } from '@/components/shared/TransactionsList'
import { AddTransactionModal } from '@/components/shared/AddTransactionModal'
import { ImportTransactionsModal } from '@/components/shared/ImportTransactionsModal'
import { EditHoldingModal } from '@/components/shared/EditHoldingModal'
import { MonthEndBalanceModal } from '@/components/shared/MonthEndBalanceModal'
import { ExportAccountsModal } from '@/components/shared/ExportAccountsModal'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Delta } from '@/components/shared/Delta'
import { CeilingGauge } from '@/components/shared/CeilingRing'
import { accountCeiling } from '@/lib/ceiling'
import { LoanDetailSection } from '@/components/loan/LoanDetailSection'
import { PeerLoanDetailSection } from '@/components/peer-loan/PeerLoanDetailSection'
import { CreatePeerLoanDialog } from '@/components/peer-loan/CreatePeerLoanDialog'
import { AssignRepaymentDialog } from '@/components/peer-loan/AssignRepaymentDialog'
import {
  useAssignPeerLoanRepayment,
  useCreatePeerLoanFromTransaction,
  useOpenPeerLoans,
} from '@/features/peer-loans/hooks'
import { extractErrorMessage } from '@/lib/errors'
import { OwnershipEditor } from '@/components/property/OwnershipEditor'
import { SavingsConfigSection } from '@/features/savings/SavingsConfigSection'
import { useSavingsInterest, useSavingsSuggestions } from '@/features/savings/hooks'
import { PropertyDetailSection } from '@/components/property/PropertyDetailSection'
import { PropertyValuationChart } from '@/components/property/PropertyValuationChart'
import { ScpiDetailSection } from '@/components/scpi/ScpiDetailSection'
import { LifeContractSection } from '@/components/accounts/LifeContractSection'
import { AccountDividendsSection } from '@/components/dividends/AccountDividendsSection'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowLeft, Calendar, Download, Pencil, Plus, TriangleAlert, Upload } from 'lucide-react'
import { cn, FRESHNESS_TEXT_CLASS, formatLocalDate, formatNumber, formatPercent, formatTimeAgo, localeFromLanguage } from '@/lib/utils'
import { accountTypeLabelKey, CASH_ACCOUNT_TYPES, HOLDING_ACCOUNT_TYPES } from '@/lib/constants'
import { type TimeRange } from '@/components/shared/TimeRangeSelector'
import { useAppStore } from '@/stores/app-store'
import type { Account, HoldingResponse, Transaction } from '@/types/api'
import { accountFreshness, FRESHNESS_DOT_CLASS, monthChange } from './account-groups'
import { AccountEditDialog } from './AccountEditDialog'
import { AccountMark } from './AccountRow'

/** One figure of the hero card: label, value in ink, an optional caption. */
function Stat({ label, value, footer }: { label: string; value: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[13px] font-medium text-muted-foreground">{label}</dt>
      <dd className="truncate text-lg font-semibold tabular-nums text-foreground">{value}</dd>
      {footer && <dd className="text-xs text-muted-foreground">{footer}</dd>}
    </div>
  )
}

/** The projected interest of a configured livret; its own query, so it mounts only there. */
function SavingsInterestStat({ accountId }: { accountId: number }) {
  const { t } = useTranslation()
  const [year] = useState(() => new Date().getFullYear())
  const { data } = useSavingsInterest(accountId)
  if (!data) return null
  return (
    <Stat
      label={t('savings.projectionTitle', { year })}
      value={<CurrencyDisplay value={data.projectedInterestFullYear} />}
      footer={<>{t('common.labelColon', { label: t('savings.projectionYtd') })} <CurrencyDisplay value={data.estimatedInterestYtd} /></>}
    />
  )
}

/** Type · institution (a property: kind · city), then how fresh the figure is. */
function AccountSubtitle({ account, now }: { account: Account; now: number }) {
  const { t } = useTranslation()
  const property = account.type === 'REAL_ESTATE' ? account.realEstate : undefined
  const parts = property
    ? [property.propertyKind ? t(`property.kind.${property.propertyKind}`) : t(accountTypeLabelKey(account.type)), property.city]
    : [t(accountTypeLabelKey(account.type)), account.provider]
  const freshness = accountFreshness(account, now)
  const ago = freshness ? formatTimeAgo(freshness.date) : null

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] font-medium text-muted-foreground">
      <span>{parts.filter(Boolean).join(' · ')}</span>
      {account.isManual && !property && <><span aria-hidden>·</span><span>{t('accounts.manual')}</span></>}
      {freshness && ago && (
        // Its own line on a phone, so a wrap never leaves a dangling separator.
        <span className="inline-flex items-center gap-1.5 max-sm:basis-full">
          <span aria-hidden className="max-sm:hidden">·</span>
          {freshness.warn ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className={cn('inline-flex items-center gap-1', FRESHNESS_TEXT_CLASS[freshness.level])}>
                    <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                    {t('accounts.syncStale', { time: ago })}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{t('accounts.syncStaleTooltip')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('size-1.5 shrink-0 rounded-full', FRESHNESS_DOT_CLASS[freshness.level])} aria-hidden />
              {freshness.valuation
                ? `${t('common.labelColon', { label: t('accounts.lastValuation') })} ${ago}`
                : account.isManual ? ago : t('topbar.synced', { time: ago })}
            </span>
          )}
        </span>
      )}
    </p>
  )
}

/**
 * One account's page: value history, holdings and positions, transactions, and the sections that
 * only apply to its type (property, SCPI, a synced CORUM Life contract, dividends).
 */
export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const accountId = parseInt(id!, 10)
  // The demo adapter has no handler for the export route (see AccountsPage).
  const demoMode = useAppStore(state => state.demoMode)

  const { data: account, isLoading } = useAccount(accountId)
  const { data: history } = useAccountHistory(accountId)
  const { data: holdings } = useHoldingsWithLivePrices(accountId)
  const { data: positions } = useAccountPositions(accountId)
  const { data: transactions } = useAccountTransactions(accountId)
  const addTxMutation = useAddTransaction(accountId)
  const deleteTxMutation = useDeleteTransaction(accountId)
  const updateTxMutation = useUpdateTransaction(accountId)
  const deleteHoldingMutation = useDeleteHolding(accountId)
  const updateHoldingMutation = useUpdateHolding(accountId)
  const importTRMutation = useImportTRTransactions(accountId)
  const createPeerLoan = useCreatePeerLoanFromTransaction()
  const assignRepayment = useAssignPeerLoanRepayment()
  const openLoans = useOpenPeerLoans()
  const { data: pnlData } = useHistory(accountId ? [accountId] : [], 12)
  const { data: savingsSuggestions } = useSavingsSuggestions()
  const { data: categories } = useCategories()
  const categorizeMutation = useCategorize()
  const qc = useQueryClient()

  const [showHistory, setShowHistory] = useState(false)
  const [showAddTx, setShowAddTx] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [editingHolding, setEditingHolding] = useState<HoldingResponse | null>(null)
  const [peerLoanTx, setPeerLoanTx] = useState<Transaction | null>(null)
  const [repaymentTx, setRepaymentTx] = useState<Transaction | null>(null)
  const [range, setRange] = useState<TimeRange>('1Y')
  // Render time for the freshness grade, kept out of render (React Compiler purity).
  const [now] = useState(() => Date.now())
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      importTRMutation.mutate(file, {
        onSuccess: (result) => {
          if (result && result.inserted > 0) {
            toast.success(
              result.skipped > 0
                ? t('accounts.importSuccessWithSkipped', { count: result.inserted, skipped: result.skipped })
                : t('accounts.importSuccess', { count: result.inserted }),
            )
          } else {
            toast.info(t('accounts.importAlreadyDone'))
          }
        },
        onError: (err) => {
          toast.error(t('accounts.importError', { message: err instanceof Error ? err.message : 'Unknown error' }))
        },
      })
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function handleCategorize(txId: number, categoryId: number) {
    categorizeMutation.mutate(
      { id: txId, data: { categoryId, createRule: false } },
      {
        // The hook's own onSuccess already invalidates ['budget'] and ['dashboard'].
        // Additionally refresh the account transaction list so the new category shows.
        onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts', accountId, 'transactions'] }),
      },
    )
  }

  if (!account && !isLoading) return null

  if (!account) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 pt-11">
          <Skeleton className="size-11 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  const chartData = (history ?? []).map(s => ({ date: s.date, balance: s.balance }))
  const isLoan = account.type === 'LOAN'
  const isCard = account.type === 'CREDIT_CARD'
  // A peer loan is a receivable: its own section replaces the transaction ledger and the
  // snapshot list, exactly as a LOAN's amortization view does.
  const isPeerLoan = account.type === 'PEER_LOAN'
  const hidesLedger = isLoan || isPeerLoan
  const canStartPeerLoan = CASH_ACCOUNT_TYPES.includes(account.type)
  // A freshly bank-synced livret is typed CHECKING until configured, so also surface the
  // section when it already has a config or the detector flagged it as a savings candidate.
  const savingsSuggestion = Array.isArray(savingsSuggestions)
    ? savingsSuggestions.find(s => s.accountId === account.id)
    : undefined
  const isSavings = account.type === 'SAVINGS' || account.type === 'LEP' || !!account.savingsConfig || !!savingsSuggestion
  const isRealEstate = account.type === 'REAL_ESTATE'
  const isScpi = account.type === 'SCPI'
  const showHoldings = HOLDING_ACCOUNT_TYPES.includes(account.type)
  const recentSnapshots = [...(history ?? [])].reverse().slice(0, 10)
  const canEdit = account.isOwner !== false

  // The backend owns EUR valuation and falls back atomically to the broker snapshot.
  const displayBalance = account.currentBalanceEur

  // PnL from unified history endpoint (pre-computed by backend)
  const pnlLatest = pnlData && pnlData.length > 0 ? pnlData[pnlData.length - 1] : null
  const invested = pnlLatest?.invested != null && pnlLatest.invested > 0 ? pnlLatest.invested : null
  const pnl = invested != null && pnlLatest?.pnl != null ? pnlLatest.pnl : null
  const pnlPct = pnl !== null && invested != null ? (pnl / invested) * 100 : null

  // ── Hero: the balance, what moved it, and the few figures that matter for this type ──
  // Snapshots are in the account's currency, so the month change is only stated in euros.
  const change = account.currency === 'EUR' ? monthChange(history ?? []) : null
  const property = isRealEstate ? account.realEstate : undefined
  const propertyGain = property && property.costBasis > 0 ? displayBalance - property.costBasis : null

  let heroLabel = t('accounts.currentBalance')
  let delta: ReactNode = change && (
    // A falling debt is the good news.
    <Delta amount={change.amount} percent={change.percent} invert={isLoan}>{t('dashboard.overRange.1M')}</Delta>
  )
  const stats: ReactNode[] = []
  const ceiling = accountCeiling(account, invested)

  if (showHoldings) {
    heroLabel = t('investments.value')
    if (pnl !== null) {
      delta = <Delta amount={pnl} percent={pnlPct}>{t(pnl < 0 ? 'investments.unrealisedLoss' : 'investments.unrealisedGain')}</Delta>
    }
    if (invested != null) stats.push(<Stat key="invested" label={t('holdings.capitalInvested')} value={<CurrencyDisplay value={invested} />} />)
    if (ceiling) stats.push(<CeilingGauge key="ceiling" usage={ceiling} />)
    if (account.cashBalance != null) {
      stats.push(
        <Stat
          key="cash"
          label={t(hasSyncedEuroFund(account) ? euroFundLabelKey(account) : 'accounts.cashBalance')}
          value={<CurrencyDisplay value={account.cashBalance} />}
        />,
      )
    }
    if (holdings && holdings.length > 0) stats.push(<Stat key="lines" label={t('accounts.holdings')} value={holdings.length} />)
    if (account.openedAt) stats.push(<Stat key="opened" label={t('accounts.openedAt')} value={formatLocalDate(account.openedAt)} />)
  } else if (isCard) {
    heroLabel = t('accounts.currentDebt')
    if (account.paymentDueAmount != null) stats.push(<Stat key="due" label={t('accounts.amex.amountDue')} value={<CurrencyDisplay value={account.paymentDueAmount} />} />)
    if (account.paymentDueDate) stats.push(<Stat key="date" label={t('accounts.amex.dueDate')} value={formatLocalDate(account.paymentDueDate)} />)
    if (account.cardNature) stats.push(<Stat key="nature" label={t('accounts.cardNature.label')} value={t(`accounts.cardNature.${account.cardNature}`)} />)
    if (account.rewardPoints != null) stats.push(<Stat key="miles" label={t('accounts.amex.miles')} value={formatNumber(account.rewardPoints, locale)} />)
  } else if (isPeerLoan) {
    // What is still owed back; the terms, ledger and forecast live in its own section below.
    heroLabel = t('peerLoan.summary.remaining')
  } else if (isLoan) {
    heroLabel = t('debt.remainingBalance')
    const debt = account.debt
    if (debt) {
      stats.push(<Stat key="borrowed" label={t('debt.borrowedAmount')} value={<CurrencyDisplay value={debt.borrowedAmount} />} />)
      if (debt.monthlyPayment != null) stats.push(<Stat key="monthly" label={t('debt.monthlyPayment')} value={<CurrencyDisplay value={debt.monthlyPayment} />} />)
      if (debt.interestRate != null) stats.push(<Stat key="rate" label={t('debt.interestRate')} value={formatPercent(debt.interestRate * 100, { fractionDigits: 2 }, locale)} />)
      if (debt.endDate) {
        stats.push(
          <Stat
            key="end"
            label={t('debt.endDate')}
            value={<span className="capitalize">{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(debt.endDate))}</span>}
          />,
        )
      }
    }
  } else if (property) {
    heroLabel = t('property.details.currentValue')
    if (propertyGain != null) {
      delta = (
        <Delta amount={propertyGain} percent={(propertyGain / property.costBasis) * 100}>
          {t('realEstatePage.kpi.sincePurchase')}
        </Delta>
      )
      stats.push(<Stat key="cost" label={t('property.details.costBasis')} value={<CurrencyDisplay value={property.costBasis} />} />)
    }
    if (property.surfaceArea != null) stats.push(<Stat key="surface" label={t('property.form.surfaceArea')} value={`${formatNumber(property.surfaceArea, locale)} m²`} />)
  } else if (isScpi && account.scpi) {
    const scpi = account.scpi
    stats.push(<Stat key="shares" label={t('scpi.shareCount')} value={formatNumber(scpi.shareCount, locale)} />)
    if (scpi.withdrawalPriceEur != null) stats.push(<Stat key="withdrawal" label={t('scpi.withdrawalPrice')} value={<CurrencyDisplay value={scpi.withdrawalPriceEur} />} />)
    if (scpi.subscriptionPriceEur != null) stats.push(<Stat key="subscription" label={t('scpi.subscriptionPrice')} value={<CurrencyDisplay value={scpi.subscriptionPriceEur} />} />)
    if (scpi.annualDistributionPerShareEur != null) stats.push(<Stat key="distribution" label={t('scpi.annualDistribution')} value={<CurrencyDisplay value={scpi.annualDistributionPerShareEur} />} />)
  } else if (account.savingsConfig) {
    const config = account.savingsConfig
    stats.push(<Stat key="rate" label={t('accounts.detail.rate')} value={formatPercent(config.annualRate, { fractionDigits: 2 }, locale)} />)
    if (ceiling) stats.push(<CeilingGauge key="ceiling" usage={ceiling} />)
    stats.push(<SavingsInterestStat key="interest" accountId={account.id} />)
  }
  if (account.sharePercent != null) {
    stats.push(<Stat key="share" label={t('accounts.detail.share')} value={formatPercent(Number(account.sharePercent), { fractionDigits: 0 }, locale)} />)
  }

  const historyCard = chartData.length > 1 ? (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle>{t('accounts.history')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center">
        <BalanceHistoryChart data={chartData} />
      </CardContent>
    </Card>
  ) : null

  // The value chart sits beside the hero: a property's estimates against its cost when it has
  // two of them, else the balance history. A loan draws its amortisation curve further down.
  const chart = hidesLedger ? null : showHoldings && pnlData && pnlData.length > 1 ? (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle>{t('accounts.valueAndInvested')}</CardTitle>
      </CardHeader>
      <CardContent>
        <NetWorthChart data={pnlData} range={range} onRangeChange={setRange} totalLabel={heroLabel} />
      </CardContent>
    </Card>
  ) : property ? (
    <PropertyValuationChart accountId={account.id} costBasis={property.costBasis} className="xl:col-span-2" fallback={historyCard} />
  ) : historyCard

  const hero = (
    <Card className={cn('@container', chart ? 'xl:col-span-1' : 'xl:col-span-3')}>
      <CardContent className="flex flex-col gap-5 py-2 @3xl:flex-row @3xl:items-end @3xl:gap-8">
        <div className="flex min-w-0 flex-col gap-1.5 @3xl:flex-none">
          <span className="text-sm font-medium text-muted-foreground">{heroLabel}</span>
          <CurrencyDisplay value={displayBalance} className="text-4xl leading-tight font-bold tracking-tight tabular-nums text-foreground @sm:text-[44px]" />
          {delta}
          {account.currency !== 'EUR' && (
            <span className="text-xs text-muted-foreground">
              <CurrencyDisplay value={account.currentBalance} currency={account.currency} />
              {account.ticker ? ` (${account.ticker})` : ''}
            </span>
          )}
        </div>
        {stats.length > 0 && (
          // Under the balance in a narrow hero (hairline between), beside it in a wide one.
          <dl className="grid min-w-0 grid-cols-2 gap-4 border-t pt-5 @3xl:flex-1 @3xl:grid-flow-col @3xl:grid-cols-none @3xl:auto-cols-fr @3xl:border-t-0 @3xl:pt-0">
            {stats}
          </dl>
        )}
      </CardContent>
    </Card>
  )

  // Transactions and the latest snapshots, side by side on a wide screen. Rendered flat for most
  // accounts, or inside the "Aperçu" tab for savings accounts (config lives in its own tab).
  const activitySections = hidesLedger ? null : (
    <div className="grid items-start gap-4 xl:grid-cols-12">
      {transactions && (
        <div className={cn('min-w-0', recentSnapshots.length > 0 && 'xl:col-span-8')}>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <TransactionsList
            actions={<>
              {account.provider === 'Trade Republic' && account.type === 'CHECKING' && (
                <Button size="sm" variant="outline" className="h-9 px-4" onClick={() => fileInputRef.current?.click()} disabled={importTRMutation.isPending}>
                  {importTRMutation.isPending ? t('common.loading') : t('accounts.importCsvTR')}
                </Button>
              )}
              {showHoldings && (
                <Button size="sm" variant="outline" className="h-9 px-4" onClick={() => setShowImport(true)}>
                  <Upload className="size-4" />
                  {t('import.importCsv')}
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-9 px-4" onClick={() => setShowAddTx(true)}>
                <Plus className="size-4" />
                {t('common.add')}
              </Button>
            </>}
            transactions={transactions}
            accountProvider={account.provider}
            onDelete={(txId) => deleteTxMutation.mutate(txId)}
            onEdit={(tx) => setEditingTx(tx)}
            categories={categories}
            onCategorize={handleCategorize}
            onCreatePeerLoan={setPeerLoanTx}
            onAssignRepayment={setRepaymentTx}
            canAssignRepayment={(tx) => tx.amount > 0 && canStartPeerLoan}
            canCreatePeerLoan={(tx) => tx.amount < 0 && canStartPeerLoan}
          />
        </div>
      )}

      {recentSnapshots.length > 0 && (
        <Card className={cn('min-w-0', transactions && 'xl:col-span-4')}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>{t('accounts.snapshots')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {recentSnapshots.map(snap => (
                <li key={snap.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-[13px] text-muted-foreground">{formatLocalDate(snap.date)}</span>
                  <CurrencyDisplay value={snap.balance} className="text-sm font-semibold tabular-nums" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <header className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <Button
            variant="ghost"
            className="-ml-3 h-9 w-fit gap-1.5 px-3 text-muted-foreground"
            onClick={() => navigate('/accounts')}
          >
            <ArrowLeft className="size-4" />
            {t('accounts.title')}
          </Button>
          <div className="flex min-w-0 items-center gap-3">
            <AccountMark account={account} size="lg" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="line-clamp-2 text-2xl leading-tight font-bold tracking-tight break-words text-foreground">
                {account.name}
              </h1>
              <AccountSubtitle account={account} now={now} />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" className="px-4" onClick={() => setShowHistory(true)}>
            <Calendar className="size-4" />
            {t('accounts.snapshots')}
          </Button>
          {canEdit && (
            <Button variant="outline" className="px-4" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              {t('common.edit')}
            </Button>
          )}
          {!demoMode && (
            <Button
              variant="outline"
              size="icon"
              aria-label={t('accounts.export.button')}
              title={t('accounts.export.button')}
              onClick={() => setShowExport(true)}
            >
              <Download className="size-4" />
            </Button>
          )}
        </div>
      </header>

      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        {hero}
        {chart}
      </div>

      {/* Loan detail: repayment, cost and amortisation */}
      {isLoan && <LoanDetailSection accountId={account.id} />}

      {/* A mortgage split is independent from the property's and from the debt details:
          the editor lives outside the loan section so the split stays editable with or
          without debt details, for owners and co-owners (issues #354, #550). */}
      {isLoan && <OwnershipEditor accountId={account.id} canEdit={account.isOwner !== false} />}

      {/* Peer loan detail: nominal receivable, dated ledger, forecast and closure */}
      {isPeerLoan && <PeerLoanDetailSection accountId={account.id} />}

      {/* Property detail: description, valuation, financing and ownership split */}
      {isRealEstate && <PropertyDetailSection account={account} />}

      {isScpi && <ScpiDetailSection account={account} />}

      {/* Contract figures the insurer reports (a synced assurance-vie). */}
      {account.type === 'ASSURANCE_VIE' && account.contract && <LifeContractSection account={account} />}

      {/* Upcoming dividends for a libre securities account, a brokerage account or a PEA only.
          Other wrappers (assurance vie, PER, employee savings) and a checking account stay off
          this view. Keyed on the account id: this route reuses the page across :id, and the
          carousel scroll must not carry from one compte to the next. */}
      {(account.type === 'COMPTE_TITRES' || account.type === 'BROKERAGE' || account.type === 'PEA') && (
        <AccountDividendsSection
          key={`dividends-${account.id}`}
          accountId={account.id}
          holdings={holdings}
        />
      )}

      {/* Holdings — grouped by product when the connector reports one (crypto exchanges),
          otherwise the flat table.

          Both are keyed on the account id so their column sort resets when the reader moves to
          another account. This route keeps the same component across a change of :id, so without
          the key a sort chosen on one portfolio would silently carry over to the next. The prefix
          keeps it distinct from the realized P&L section's key: both are siblings here. */}
      {showHoldings && (
        holdings ? (
          positions && positions.length > 0 ? (
            <PositionsByProduct key={`holdings-${accountId}`} positions={positions} />
          ) : (
            <HoldingsTable
              key={`holdings-${accountId}`}
              holdings={holdings}
              onEdit={setEditingHolding}
              onDelete={(h) => deleteHoldingMutation.mutate(h.ticker)}
            />
          )
        ) : (
          <Skeleton className="h-40 w-full rounded-2xl" />
        )
      )}

      {/* Realized P&L on closed positions (investment accounts only) */}
      {showHoldings && <RealizedPnlSection key={`realized-${accountId}`} accountId={accountId} enabled={showHoldings} />}

      {/* Savings accounts: split into Overview / Config tabs so the page stays clean. */}
      {isSavings ? (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">{t('accounts.tabOverview')}</TabsTrigger>
            <TabsTrigger value="config">{t('savings.configSection')}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            {activitySections}
          </TabsContent>
          <TabsContent value="config" className="mt-4">
            <SavingsConfigSection
              accountId={account.id}
              initialConfig={account.savingsConfig}
              suggestedProduct={savingsSuggestion?.suggestedProduct}
              suggestedRate={savingsSuggestion?.defaultAnnualRate}
            />
          </TabsContent>
        </Tabs>
      ) : (
        activitySections
      )}

      {/* Add Transaction modal */}
      <AddTransactionModal
        open={showAddTx}
        onOpenChange={setShowAddTx}
        accountId={account.id}
        accountType={account.type}
        onSubmit={async (data) => { await addTxMutation.mutateAsync(data) }}
        isLoading={addTxMutation.isPending}
      />

      {/* Import CSV modal (investment accounts) */}
      {showHoldings && (
        <ImportTransactionsModal
          open={showImport}
          onOpenChange={setShowImport}
          accountId={account.id}
        />
      )}

      {/* Edit Transaction modal */}
      {editingTx && (
        <AddTransactionModal
          open={!!editingTx}
          onOpenChange={(open) => { if (!open) setEditingTx(null) }}
          accountId={account.id}
          accountType={account.type}
          initialValues={{
            id: editingTx.id,
            date: editingTx.date,
            description: editingTx.description,
            amount: editingTx.amount,
            txType: editingTx.txType ?? null,
            ticker: editingTx.ticker ?? undefined,
            name: editingTx.name ?? undefined,
            quantity: editingTx.quantity ?? undefined,
            pricePerUnit: editingTx.pricePerUnit ?? undefined,
            currency: editingTx.nativeCurrency,
            categoryId: editingTx.categoryId ?? undefined,
          }}
          onSubmit={async (data) => {
            await updateTxMutation.mutateAsync({ txId: editingTx.id, data })
            setEditingTx(null)
          }}
          isLoading={updateTxMutation.isPending}
        />
      )}

      {/* Edit Holding modal */}
      <EditHoldingModal
        open={!!editingHolding}
        onOpenChange={(open) => { if (!open) setEditingHolding(null) }}
        holding={editingHolding}
        // Synced accounts (on-chain wallets, exchanges) own the quantity from
        // the chain/exchange, so only the cost basis is editable there.
        quantityReadOnly={!account.isManual}
        onSubmit={async (ticker, quantity, averageBuyIn) => {
          await updateHoldingMutation.mutateAsync({ ticker, data: { quantity, averageBuyIn } })
          setEditingHolding(null)
        }}
        isLoading={updateHoldingMutation.isPending}
      />

      {/* Create a peer loan from an outgoing transaction (the transaction becomes its
          cash leg, so the outflow is not counted twice). */}
      <CreatePeerLoanDialog
        open={!!peerLoanTx}
        onOpenChange={(open) => { if (!open) setPeerLoanTx(null) }}
        transaction={peerLoanTx}
        loading={createPeerLoan.isPending}
        onSubmit={async (data) => {
          try {
            const created = await createPeerLoan.mutateAsync(data)
            toast.success(t('peerLoan.fromTransaction.created'))
            setPeerLoanTx(null)
            navigate(`/accounts/${created.accountId}`)
          } catch (err) {
            toast.error(extractErrorMessage(err, t('common.error')))
            throw err
          }
        }}
      />

      <AssignRepaymentDialog
        open={!!repaymentTx}
        onOpenChange={(open) => { if (!open) setRepaymentTx(null) }}
        transaction={repaymentTx}
        loans={openLoans.data ?? []}
        loading={assignRepayment.isPending}
        onSubmit={async (loanAccountId, data) => {
          try {
            await assignRepayment.mutateAsync({ accountId: loanAccountId, data })
            toast.success(t('peerLoan.assignRepayment.created'))
            setRepaymentTx(null)
            navigate(`/accounts/${loanAccountId}`)
          } catch (err) {
            toast.error(extractErrorMessage(err, t('common.error')))
            throw err
          }
        }}
      />

      {/* Monthly history dialog */}
      <MonthEndBalanceModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        accountId={accountId}
        history={history}
        amountOwed={isCard}
      />

      {/* Mounted while open: both read queries of their own. */}
      {editing && <AccountEditDialog account={account} onClose={() => setEditing(false)} />}
      {showExport && <ExportAccountsModal open onOpenChange={setShowExport} accounts={[account]} />}
    </div>
  )
}
