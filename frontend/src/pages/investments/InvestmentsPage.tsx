import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts, usePortfolio } from '@/features/accounts/hooks'
import { useDiversification } from '@/features/analysis/hooks'
import { useNetWorthIntraday } from '@/features/dashboard/hooks'
import { useReceivedDividends } from '@/features/dividends/hooks'
import { useHistory } from '@/features/history/hooks'
import { useRealizedPnls } from '@/features/investments/hooks'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Delta } from '@/components/shared/Delta'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { NetWorthChart } from '@/components/shared/NetWorthChart'
import { PageHeader } from '@/components/shared/PageHeader'
import { type TimeRange } from '@/components/shared/TimeRangeSelector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HOLDING_ACCOUNT_TYPES } from '@/lib/constants'
import { formatApiError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { DiversificationSection } from '@/pages/analysis/DiversificationSection'
import { ConcentrationCard } from './ConcentrationCard'
import { PositionsCard } from './PositionsCard'
import { RealizedGainsCard } from './RealizedGainsCard'
import { TaxWrappersCard } from './TaxWrappersCard'
import { TAX_WRAPPER_YEARS, eurRate, investmentLines, portfolioTotals, realizedInYear, realizedYears, type RealizedSource } from './investments'

const RANGE_MONTHS: Record<TimeRange, number> = { '24H': 1, '7D': 1, '1M': 1, '3M': 3, YTD: 12, '1Y': 12, ALL: 1200 }

function Stat({ label, value, footer }: { label: string; value: ReactNode; footer?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="truncate text-[13px] font-medium text-muted-foreground">{label}</dt>
      <dd className="truncate text-lg font-semibold tabular-nums text-foreground">{value}</dd>
      {footer && <dd className="truncate text-xs text-muted-foreground">{footer}</dd>}
    </div>
  )
}

export function InvestmentsPage() {
  const { t } = useTranslation()
  const [now] = useState(() => new Date())
  const [range, setRange] = useState<TimeRange>('1Y')

  const portfolio = usePortfolio()
  const { data: accounts } = useAccounts()
  const { data: received } = useReceivedDividends(365)
  const { data: diversification } = useDiversification()

  const lines = useMemo(() => investmentLines(portfolio.data ?? []), [portfolio.data])
  const investmentAccounts = useMemo(() => (accounts ?? []).filter((a) => HOLDING_ACCOUNT_TYPES.includes(a.type)), [accounts])
  const accountIds = useMemo(() => investmentAccounts.map((a) => a.id), [investmentAccounts])

  const realized = useRealizedPnls(accountIds)
  const { data: history } = useHistory(accountIds, RANGE_MONTHS[range])
  const { data: intraday } = useNetWorthIntraday(accountIds, range === '24H')

  const sources = useMemo<RealizedSource[]>(() => investmentAccounts.flatMap((a, i) => {
    // Guarded: demo mode answers an unhandled endpoint with {}.
    const lots = realized.data[i]?.lots
    return lots ? [{ accountId: a.id, accountName: a.name, accountType: a.type, rate: eurRate(a), lots }] : []
  }), [investmentAccounts, realized.data])

  if (portfolio.isLoading) return <LoadingSkeleton />

  const header = <PageHeader title={t('nav.investments')} />
  if (portfolio.isError) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ErrorState title={t('error.crashTitle')} message={formatApiError(portfolio.error, t)} onRetry={() => void portfolio.refetch()} />
      </div>
    )
  }
  if (lines.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <EmptyState title={t('investments.empty')} description={t('investments.emptyHint')} />
      </div>
    )
  }

  const totals = portfolioTotals(lines)
  const year = now.getFullYear()
  const realizedNet = realizedInYear(sources, year).net
  const years = realizedYears(sources)
  const rates = new Map(investmentAccounts.map((a) => [a.id, eurRate(a)]))
  // shortcut: a non-EUR credit is assumed to be in its account's currency; upgrade when ReceivedDividend carries an amountEur.
  const dividends = received?.reduce((sum, d) => sum + d.amount * (d.currency === 'EUR' ? 1 : rates.get(d.accountId) ?? 1), 0)
  const wrapperCount = new Set(lines.map((l) => l.accountId)).size
  const taxAccounts = investmentAccounts.filter((a) => TAX_WRAPPER_YEARS[a.type] != null)
  const bothBottom = years.length > 0 && taxAccounts.length > 0

  return (
    <div className="flex flex-col gap-4">
      {header}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-x-8 gap-y-5 py-2">
          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">{t('investments.value')}</span>
            <CurrencyDisplay value={totals.value} className="text-4xl leading-tight font-bold tracking-tight tabular-nums sm:text-[44px]" />
            {totals.pnlPercent != null && (
              <Delta amount={totals.pnl} percent={totals.pnlPercent}>
                {t(totals.pnl < 0 ? 'investments.unrealisedLoss' : 'investments.unrealisedGain')}
              </Delta>
            )}
          </div>
          <dl className="grid min-w-0 flex-[2_1_480px] grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label={t('holdings.capitalInvested')} value={<CurrencyDisplay value={totals.invested} />} />
            <Stat
              label={t('investments.realisedYear', { year })}
              value={realized.isLoading
                ? '—'
                : <CurrencyDisplay value={realizedNet} showSign className={realizedNet > 0 ? 'text-gain' : realizedNet < 0 ? 'text-loss' : undefined} />}
            />
            <Stat label={t('investments.dividends12m')} value={dividends == null ? '—' : <CurrencyDisplay value={dividends} />} />
            <Stat label={t('investments.lines')} value={lines.length} footer={t('investments.wrapperCount', { count: wrapperCount })} />
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('investments.chartTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <NetWorthChart data={history ?? []} intraday={intraday ?? []} range={range} onRangeChange={setRange} />
          </CardContent>
        </Card>
        <ConcentrationCard lines={lines} />
      </div>

      <PositionsCard lines={lines} />

      {diversification && <DiversificationSection data={diversification} />}

      {(years.length > 0 || taxAccounts.length > 0) && (
        <div className={cn('grid gap-4', bothBottom && 'lg:grid-cols-3')}>
          {years.length > 0 && (
            <RealizedGainsCard sources={sources} years={years} currentYear={year} className={bothBottom ? 'lg:col-span-2' : undefined} />
          )}
          {taxAccounts.length > 0 && <TaxWrappersCard accounts={taxAccounts} now={now} />}
        </div>
      )}
    </div>
  )
}
