import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ArrowRight, Inbox } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CashflowSankey } from '@/components/shared/CashflowSankey'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Delta } from '@/components/shared/Delta'
import { ErrorState } from '@/components/shared/ErrorState'
import { KpiTile } from '@/components/shared/KpiTile'
import {
  useAllocation,
  useBudgets,
  useCashflow,
  useCashflowFlow,
  useRecurringCalendar,
  useUncategorized,
} from '@/features/budget/hooks'
import { useUpcomingDividends } from '@/features/dividends/hooks'
import { cn, formatDate, formatPercent } from '@/lib/utils'
import type { Budget } from '@/types/api'
import { ColorDot } from './budget-utils'
import { CashflowTab } from './CashflowTab'
import { SavingsRateCard } from './SavingsRateCard'
import { SubscriptionsSummaryCard } from './SubscriptionsSummaryCard'
import { TopMerchantsCard } from './TopMerchantsCard'
import { PeriodNavigator } from './PeriodNavigator'
import { useBudgetPeriod } from './BudgetPeriodContext'
import { previousBucket, savingsRate } from './savings-rate'

/**
 * Dividends and SCPI distributions expected over the next 60 days.
 *
 * Deliberately outside the page's loading/error gate (same idea as the to-categorize
 * nudge): a failed or empty forecast must not replace the recap. Hidden on a past
 * cycle, because the figures are always "from today", not from the period being viewed.
 *
 * The total sums only rows the backend marked `countsInBudget`. Locked wrappers and
 * reinvested SCPI stay in the list, with their own badge, and their sum is a muted
 * aside — the card does not re-decide that from `accountType` or `reinvested`.
 */
function CapitalIncomeAhead() {
  const { t } = useTranslation()
  const dividendsQ = useUpcomingDividends(60)
  const rows = dividendsQ.data ?? []
  const budgetTotal = rows.reduce((sum, row) => sum + (row.countsInBudget ? row.amountEur : 0), 0)
  const lockedTotal = rows.reduce((sum, row) => sum + (row.countsInBudget ? 0 : row.amountEur), 0)
  const quiet = !dividendsQ.isLoading && !dividendsQ.isError && rows.length === 0

  return (
    <Card role="region" aria-labelledby="capital-income-heading">
      <CardHeader>
        <CardTitle id="capital-income-heading">{t('budget.overview.capitalIncome')}</CardTitle>
      </CardHeader>
      <CardContent>
        {dividendsQ.isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : dividendsQ.isError ? (
          <p className="text-sm text-muted-foreground">{t('accounts.dividends.error')}</p>
        ) : quiet ? (
          <p className="text-sm text-muted-foreground">{t('budget.overview.capitalIncomeEmpty')}</p>
        ) : (
          <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
            <div className="min-w-0">
              <p className="text-[22px] leading-tight font-semibold tracking-tight tabular-nums">
                <CurrencyDisplay value={budgetTotal} showSign />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t('budget.overview.capitalIncomeGross')}</p>
              {lockedTotal > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <CurrencyDisplay value={lockedTotal} showSign />
                  {' '}
                  {t('budget.overview.capitalizedOutside')}
                </p>
              )}
            </div>
            <ul className="flex min-w-0 flex-[1_1_20rem] flex-col gap-2">
              {rows.slice(0, 3).map((row) => (
                <li key={row.id} className="flex items-center gap-2 text-[13px]">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">{formatDate(row.expectedDate)}</span>
                  <span className="truncate font-medium">{row.name}</span>
                  {row.reinvested && (
                    <span className="shrink-0 text-xs text-muted-foreground">{t('budget.overview.reinvested')}</span>
                  )}
                  {!row.reinvested && !row.countsInBudget && (
                    <span className="shrink-0 text-xs text-muted-foreground">{t('budget.overview.staysInEnvelope')}</span>
                  )}
                  <CurrencyDisplay value={row.amountEur} className="ml-auto shrink-0 font-semibold tabular-nums text-foreground" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** The card-header link of the dashboard cards, here a button because the cards navigate. */
const VIEW_ALL = 'text-sm font-medium text-primary transition-colors hover:text-foreground'

/** First-load skeleton mirroring the KPI row so the layout doesn't jump. */
function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[92px] w-full rounded-2xl" />
      ))}
    </div>
  )
}

/** One envelope: spent against its limit, the bar turning amber from 80 % and loss-coloured past 100 %. */
function EnvelopeRow({ budget: b }: { budget: Budget }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
        <span className="flex min-w-0 items-center gap-2">
          <ColorDot color={b.categoryColor} />
          <span className="truncate font-semibold">{b.categoryName}</span>
        </span>
        <span className={cn('ml-auto shrink-0 tabular-nums', b.overBudget ? 'font-semibold text-loss' : 'text-muted-foreground')}>
          <CurrencyDisplay value={b.spent} className={b.overBudget ? undefined : 'text-foreground'} />
          {' / '}
          <CurrencyDisplay value={b.monthlyLimit} />
          {' · '}
          {formatPercent(b.percent, { fractionDigits: 0 })}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar" aria-label={b.categoryName}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(b.percent, 100)}
        aria-valuetext={formatPercent(b.percent, { fractionDigits: 0 })}>
        <div className={cn('h-full rounded-full', b.overBudget ? 'bg-loss' : b.percent >= 80 ? 'bg-warning' : 'bg-primary')}
          style={{ width: `${Math.min(b.percent, 100)}%` }} />
      </div>
    </li>
  )
}

export function OverviewTab() {
  const { t } = useTranslation()
  // Cards deep-link into the nested budget routes (relative to `/budget`).
  const navigate = useNavigate()
  const { anchor, setAnchor } = useBudgetPeriod()
  const cashflowQ = useCashflow('CYCLE', anchor)
  const budgetsQ = useBudgets()
  const upcomingQ = useRecurringCalendar(30)
  const allocationQ = useAllocation('CYCLE', anchor)
  const uncategorizedQ = useUncategorized()
  const flowQ = useCashflowFlow('CYCLE', anchor)
  // The year's cycles up to the displayed one: the bars, the savings-rate trend and the previous
  // cycle to compare with. A past cycle anchors the year on its own end so the series stops there.
  // shortcut: a cycle straddling 1 January only gets its January part in this series (YTD starts
  // on 1 January), so its bar is short and it has no previous cycle; upgrade with a rolling series.
  const seriesQ = useCashflow('YTD', anchor ? cashflowQ.data?.to : undefined)

  const cashflow = cashflowQ.data
  const budgets = budgetsQ.data
  const upcoming = upcomingQ.data
  const allocation = allocationQ.data
  const uncategorized = uncategorizedQ.data
  const series = seriesQ.data?.series ?? []

  // Envelope-usage and upcoming-charges data are always server-computed for the *current*
  // cycle, so they can't follow the period navigator's anchor. When the displayed cycle has
  // already ended (its `to` is before today), hide those cards to avoid mixing past + present.
  const [todayIso] = useState(() => new Date().toLocaleDateString('en-CA'))
  const viewingPast = !!cashflow?.to && cashflow.to < todayIso

  // The KPI row is the page's core; the to-categorize nudge, the flow and the per-cycle charts are
  // non-blocking extras, so their queries are deliberately excluded from the loading/error gate.
  const coreQueries = [cashflowQ, budgetsQ, upcomingQ, allocationQ]
  const isLoading = coreQueries.some((q) => q.isLoading)
  const isError = coreQueries.some((q) => q.isError)
  const refetchAll = () => coreQueries.forEach((q) => void q.refetch())

  const totalSpent = (budgets ?? []).reduce((s, b) => s + b.spent, 0)
  const totalLimit = (budgets ?? []).reduce((s, b) => s + b.monthlyLimit, 0)
  const overCount = (budgets ?? []).filter((b) => b.overBudget).length
  const topEnvelopes = [...(budgets ?? [])].sort((a, b) => b.percent - a.percent).slice(0, 6)
  // Debits the recurring calendar still expects before the cycle closes.
  const toPay = (upcoming ?? []).filter((o) => o.expectedAmount < 0 && (!cashflow || o.dueDate <= cashflow.to))
  const toPayTotal = -toPay.reduce((s, o) => s + o.expectedAmount, 0)
  const previous = previousBucket(series, cashflow?.from)
  const rate = cashflow ? savingsRate(cashflow.income, cashflow.expense) : null
  const showEnvelopes = !viewingPast && topEnvelopes.length > 0

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PeriodNavigator
          period="CYCLE"
          from={cashflowQ.data?.from}
          to={cashflowQ.data?.to}
          onAnchorChange={setAnchor}
        />
      </div>
      {viewingPast && (
        <p className="text-xs text-muted-foreground">{t('budget.overview.pastPeriodNote')}</p>
      )}
      {isError ? (
        <ErrorState message={t('budget.overview.error')} onRetry={refetchAll} />
      ) : isLoading ? (
        <OverviewSkeleton />
      ) : (
      <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile
          label={t('budget.cashflow.income')}
          value={<CurrencyDisplay value={cashflow?.income ?? 0} />}
          footer={previous && cashflow && (
            <Delta amount={cashflow.income - previous.income}>{t('budget.overview.vsPreviousCycle')}</Delta>
          )}
        />
        <KpiTile
          label={t('budget.cashflow.expense')}
          value={<CurrencyDisplay value={cashflow?.expense ?? 0} />}
          footer={previous && cashflow && (
            <Delta amount={cashflow.expense - previous.expense} invert>{t('budget.overview.vsPreviousCycle')}</Delta>
          )}
        />
        <KpiTile
          label={t('budget.overview.saved')}
          value={<CurrencyDisplay value={allocation?.totalContributions ?? 0} />}
          footer={<>{t('common.labelColon', { label: t('budget.overview.investable') })} <CurrencyDisplay value={allocation?.totalStock ?? 0} /></>}
        />
        <KpiTile
          label={t('dashboard.kpi.savingsRate')}
          value={rate == null ? '—' : formatPercent(rate, { fractionDigits: 0 })}
          footer={<>{t('common.labelColon', { label: t('budget.overview.netThisCycle') })} <CurrencyDisplay value={cashflow?.net ?? 0} showSign /></>}
        />
        {!viewingPast && (
          <KpiTile
            label={t('budget.overview.toPay')}
            value={<CurrencyDisplay value={toPayTotal} />}
            footer={t('budget.overview.toPayCount', { count: toPay.length })}
          />
        )}
      </div>

      {/* To-categorize nudge */}
      {(uncategorized?.length ?? 0) > 0 && (
        <button type="button" onClick={() => navigate('review')} className="block w-full text-left">
          <Card className="bg-warning/5 ring-warning/30 transition-colors hover:bg-warning/10">
            <CardContent className="flex items-center gap-3">
              <Inbox className="size-4 shrink-0 text-warning" aria-hidden="true" />
              <span className="text-sm font-medium">
                {t('budget.overview.toCategorize', { count: uncategorized!.length })}
              </span>
              <ArrowRight className="ml-auto size-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </button>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className={showEnvelopes ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <CardHeader>
            <CardTitle>{t('budget.flow.diagram')}</CardTitle>
            <CardAction>
              <button type="button" className={VIEW_ALL} onClick={() => navigate('spending')}>{t('dashboard.viewAll')}</button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {flowQ.isLoading ? (
              <Skeleton className="h-[300px] w-full rounded-xl" />
            ) : flowQ.isError ? (
              <ErrorState messageOnly message={t('budget.flow.error')} onRetry={() => void flowQ.refetch()} />
            ) : flowQ.data && flowQ.data.nodes.length > 0 ? (
              <CashflowSankey flow={flowQ.data} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('budget.flow.empty')}</p>
            )}
          </CardContent>
        </Card>

        {/* Envelope-budget data, current cycle only (see viewingPast). */}
        {showEnvelopes && (
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>{t('budget.overview.topEnvelopes')}</CardTitle>
              <CardDescription>
                <CurrencyDisplay value={totalSpent} /> / <CurrencyDisplay value={totalLimit} />
                {' · '}
                {overCount > 0
                  ? t('budget.overview.overBudget', { count: overCount })
                  : t('budget.overview.onTrack')}
              </CardDescription>
              <CardAction>
                <button type="button" className={VIEW_ALL} onClick={() => navigate('envelopes')}>{t('dashboard.viewAll')}</button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3.5">
                {topEnvelopes.map((b) => <EnvelopeRow key={b.id} budget={b} />)}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {seriesQ.isError ? (
        <ErrorState messageOnly message={t('budget.cashflow.error')} onRetry={() => void seriesQ.refetch()} />
      ) : seriesQ.isLoading ? (
        <Skeleton className="h-[340px] w-full rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="*:h-full lg:col-span-8"><CashflowTab series={series} /></div>
          <div className="*:h-full lg:col-span-4"><SavingsRateCard series={series} /></div>
        </div>
      )}

      {/* Merchants follow the displayed cycle; the subscriptions are today's, so current cycle only. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={cn('*:h-full', viewingPast ? 'lg:col-span-12' : 'lg:col-span-7')}><TopMerchantsCard anchor={anchor} /></div>
        {!viewingPast && <div className="*:h-full lg:col-span-5"><SubscriptionsSummaryCard /></div>}
      </div>

      {/* Capital-income forecast — current window only, and never part of the core gate. */}
      {!viewingPast && <CapitalIncomeAhead />}
      </>
      )}
    </div>
  )
}
