import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { useDashboard, useNetWorthIntraday, usePnl } from '@/features/dashboard/hooks'
import { useHistory } from '@/features/history/hooks'
import { useCashflow } from '@/features/budget/hooks'
import { usePassiveIncome } from '@/features/income/hooks'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Delta } from '@/components/shared/Delta'
import { KpiTile } from '@/components/shared/KpiTile'
import { PageHeader } from '@/components/shared/PageHeader'
import { NetWorthChart } from '@/components/shared/NetWorthChart'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { TimeRangeSelector, type TimeRange } from '@/components/shared/TimeRangeSelector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatPercent } from '@/lib/utils'
import { liquidityOf } from '@/lib/asset-classes'
import { AllocationCard } from './AllocationCard'
import { AttentionCard } from './AttentionCard'
import { GoalsCard } from './GoalsCard'
import { HealthCard } from './HealthCard'
import { LiquidityCard } from './LiquidityCard'
import { MoversCard } from './MoversCard'
import { PeersCard } from './PeersCard'
import { UpcomingCard } from './UpcomingCard'

type WealthMode = 'net' | 'gross' | 'financial'

// Financial wealth = liquid and investable assets only. Checking is the day-to-day
// cash excluded by design; real estate is tangible property; physical precious
// metals are tangible movables; OTHER has an unknown nature and must not inflate
// the figure by default. SCPI stays in: a share of a real-estate fund is an
// intangible, exchangeable security.
const EXCLUDED_FINANCIAL = new Set(['CHECKING', 'LOAN', 'REAL_ESTATE', 'PRECIOUS_METALS', 'OTHER'])

const RANGE_MONTHS: Record<TimeRange, number> = { '24H': 1, '7D': 1, '1M': 1, '3M': 3, YTD: 12, '1Y': 12, ALL: 1200 }

function rangeStart(range: TimeRange, now: Date): string | undefined {
  const from = (() => {
    switch (range) {
      case '24H': return new Date(now.getTime() - 24 * 60 * 60 * 1000)
      case '7D': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
      case '1M': return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      case '3M': return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      case 'YTD': return new Date(now.getFullYear(), 0, 1)
      case '1Y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      default: return null
    }
  })()
  return from ? from.toISOString().slice(0, 10) : undefined
}

/** First and last value of a history series: the change it shows over its own span. */
function seriesChange(points: { total: number }[] | undefined): { amount: number; percent: number | null } | null {
  if (!points || points.length < 2) return null
  const first = points[0].total
  const last = points[points.length - 1].total
  return { amount: last - first, percent: first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null }
}

export function DashboardPage() {
  const { t } = useTranslation()
  const [range, setRange] = useState<TimeRange>('1Y')
  const [wealthMode, setWealthMode] = useState<WealthMode>('net')
  const [now] = useState(() => new Date())

  const { data, isLoading } = useDashboard(range)
  const income = usePassiveIncome()
  const { data: cycle } = useCashflow('CYCLE')

  // Account IDs filtered by the selected wealth mode: they drive both the headline value
  // and the history chart, so the curve never includes categories the mode excludes.
  const chartAccountIds = useMemo(() => {
    if (!data) return []
    switch (wealthMode) {
      case 'gross': return data.assets.map(d => d.accountId)
      case 'financial': return data.assets.filter(d => !EXCLUDED_FINANCIAL.has(d.accountType)).map(d => d.accountId)
      default: return [...data.assets.map(d => d.accountId), ...data.liabilities.map(l => l.accountId)]
    }
  }, [data, wealthMode])
  const allAccountIds = useMemo(
    () => data ? [...data.assets.map(d => d.accountId), ...data.liabilities.map(l => l.accountId)] : [],
    [data],
  )
  // Accounts that carry holdings: the portfolio performance line only. In "financial" mode it
  // drops the excluded categories too (a real-estate or metals account carrying holdings).
  const investmentAccountIds = useMemo(
    () => data?.assets
      .filter(d => d.hasHoldings)
      .filter(d => wealthMode !== 'financial' || !EXCLUDED_FINANCIAL.has(d.accountType))
      .map(d => d.accountId) ?? [],
    [data, wealthMode],
  )
  // The allocation beside the hero follows the same filter as the headline value and the curve,
  // so it never shows a category the figure excludes; shares are recomputed over that total,
  // since the backend's cover the whole portfolio.
  const displayDistribution = useMemo(() => {
    if (!data) return []
    if (wealthMode !== 'financial') return data.distribution
    const filtered = data.distribution.filter(d => !EXCLUDED_FINANCIAL.has(d.accountType))
    const total = filtered.reduce((s, d) => s + d.balanceEur, 0)
    if (total <= 0) return filtered.map(d => ({ ...d, percentage: 0 }))
    return filtered.map(d => ({ ...d, percentage: (d.balanceEur / total) * 100 }))
  }, [data, wealthMode])

  const { data: history } = useHistory(chartAccountIds, RANGE_MONTHS[range])
  const { data: monthHistory } = useHistory(allAccountIds, 1)
  const { data: intraday } = useNetWorthIntraday(chartAccountIds, range === '24H')
  const { data: pnlData } = usePnl(investmentAccountIds, rangeStart(range, now))

  if (isLoading || !data) {
    return <LoadingSkeleton />
  }

  const grossAssets = data.assets.reduce((s, d) => s + d.balanceEur, 0)
  const wealthValue = wealthMode === 'gross'
    ? grossAssets
    : wealthMode === 'financial'
      ? data.assets.filter(d => !EXCLUDED_FINANCIAL.has(d.accountType)).reduce((s, d) => s + d.balanceEur, 0)
      : data.totalNetWorth
  const rangeChange = range === '24H' ? seriesChange(intraday) : seriesChange(history)
  const monthChange = seriesChange(monthHistory)
  const portfolioPnl = range === 'ALL' ? (pnlData?.pnl ?? null) : (pnlData?.rangePnl ?? null)
  const portfolioPnlPct = range === 'ALL' ? (pnlData?.pnlPercent ?? null) : (pnlData?.rangePnlPercent ?? null)
  const available = data.distribution.filter(d => liquidityOf(d.accountType) === 'available').reduce((s, d) => s + d.balanceEur, 0)
  const savingsRate = cycle && cycle.income > 0 ? (cycle.net / cycle.income) * 100 : null

  const wealthModes: { value: WealthMode; key: string }[] = [
    { value: 'net', key: 'netWorth' },
    { value: 'gross', key: 'grossWorth' },
    { value: 'financial', key: 'financialWorth' },
  ]
  const modeLabel = t(`dashboard.${wealthModes.find(m => m.value === wealthMode)!.key}`)

  return (
    // space-y, not gap: the header keeps its own 24px margin instead of adding the gap to it.
    <div className="space-y-4">
      <PageHeader title={t('dashboard.title')} />

      {/* Wealth hero */}
      <Card>
        <CardContent className="flex flex-col gap-2 py-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex items-center gap-1 self-start text-sm font-medium text-muted-foreground transition-[color] hover:text-foreground">
                {modeLabel}
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 min-w-64">
              {wealthModes.map(m => (
                <DropdownMenuItem key={m.value} onClick={() => setWealthMode(m.value)} className={wealthMode === m.value ? 'font-semibold text-foreground' : ''}>
                  {t(`dashboard.${m.key}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <CurrencyDisplay value={wealthValue} className="text-4xl leading-tight font-bold tracking-tight tabular-nums sm:text-[44px]" />
          {/* One line of context on a wide screen: the change over the range, the portfolio's, then the arithmetic. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {rangeChange && (
              <Delta amount={rangeChange.amount} percent={rangeChange.percent}>
                {t(`dashboard.overRange.${range}`)}
              </Delta>
            )}
            {/* Unknown is not zero: a range without a known P&L reads as a dash. */}
            {portfolioPnl == null
              ? <span className="text-[13px] text-muted-foreground">— {t('dashboard.portfolioPerformance')}</span>
              : <Delta amount={portfolioPnl} percent={portfolioPnlPct}>{t('dashboard.portfolioPerformance')}</Delta>}
            {wealthMode === 'net' && (data.totalLiabilities ?? 0) > 0 && (
              <span className="text-[13px] text-muted-foreground">
                {t('dashboard.assetsMinusDebts')} <CurrencyDisplay value={grossAssets} /> − <CurrencyDisplay value={data.totalLiabilities ?? 0} />
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          label={t('dashboard.kpi.grossAssets')}
          value={<CurrencyDisplay value={grossAssets} />}
          footer={t('dashboard.kpi.accountCount', { count: data.assets.length })}
        />
        <KpiTile
          label={t('dashboard.kpi.debts')}
          value={<CurrencyDisplay value={data.totalLiabilities ?? 0} />}
          footer={data.totalMonthlyPayment
            ? <><CurrencyDisplay value={data.totalMonthlyPayment} /> {t('dashboard.perMonthSuffix')}</>
            : t('dashboard.kpi.noLoan')}
        />
        <KpiTile
          label={t('dashboard.kpi.monthChange')}
          value={monthChange ? <CurrencyDisplay value={monthChange.amount} showSign /> : '—'}
          footer={monthChange?.percent != null ? <Delta percent={monthChange.percent} /> : t('dashboard.kpi.noHistory')}
        />
        <KpiTile
          label={t('dashboard.kpi.passiveIncome')}
          value={<CurrencyDisplay value={income.totals.total} />}
          footer={<>≈ <CurrencyDisplay value={income.totals.total / 12} /> {t('dashboard.perMonthSuffix')}</>}
        />
        <KpiTile
          label={t('dashboard.kpi.savingsRate')}
          value={savingsRate == null ? '—' : formatPercent(savingsRate, { fractionDigits: 0 })}
          footer={t('dashboard.kpi.savingsRateHint')}
        />
        <KpiTile
          label={t('dashboard.kpi.available')}
          value={<CurrencyDisplay value={available} />}
          footer={t('dashboard.kpi.availableHint')}
        />
      </div>

      {/* Evolution + allocation */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {/* The period switch sits beside the title, like every card control, and drops under it on a phone. */}
          <CardHeader className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            {/* Titled by wealth mode: the curve plots (net/gross/financial) wealth, not gain/loss. */}
            <CardTitle>{t(`dashboard.evolution.${wealthMode}`)}</CardTitle>
            <div className="max-w-full min-w-0">
              <TimeRangeSelector value={range} onChange={setRange} />
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <NetWorthChart data={history ?? []} intraday={intraday ?? []} range={range} totalLabel={modeLabel} />
          </CardContent>
        </Card>
        <AllocationCard distribution={displayDistribution} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <LiquidityCard distribution={data.distribution} />
        <UpcomingCard liabilities={data.liabilities} />
        <AttentionCard />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MoversCard />
        <PeersCard grossWorth={grossAssets} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GoalsCard goals={data.goalSummaries} />
        <HealthCard />
      </div>
    </div>
  )
}
