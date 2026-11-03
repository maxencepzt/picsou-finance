import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Coins } from 'lucide-react'
import { usePassiveIncome } from '@/features/income/hooks'
import { useReceivedDividends } from '@/features/dividends/hooks'
import { useAllocationTargets } from '@/features/analysis/hooks'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMoney } from '@/hooks/use-money'
import { formatPercent, formatShortDate, localeFromLanguage } from '@/lib/utils'
import type { DividendCadence } from '@/types/api'
import type { IncomeSource } from '@/features/income/passive-income'
import { IncomeMonthsChart } from './IncomeMonthsChart'
import { INCOME_SOURCES, SOURCE_COLORS, incomeBySource, nextPayments, receivedTotal, type IncomePayment } from './income-view'

/** Passive income over the next twelve months: where it comes from, when it lands, who pays it. */
export function IncomePage() {
  const { t, i18n } = useTranslation()
  const money = useMoney()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const income = usePassiveIncome()
  const received = useReceivedDividends(365)
  const { data: targets } = useAllocationTargets()

  if (income.isLoading || received.isLoading) return <LoadingSkeleton />

  const header = <PageHeader title={t('nav.income')} />
  if (income.isError) {
    return <>{header}<ErrorState message={t('income.error')} onRetry={income.refetch} /></>
  }

  const { totals } = income
  const receivedSum = receivedTotal(received.data ?? [])
  if (totals.total === 0 && receivedSum === 0) {
    return (
      <>
        {header}
        <EmptyState icon={<Coins className="size-12" />} title={t('income.empty.title')} description={t('income.empty.description')} />
      </>
    )
  }

  const sources = INCOME_SOURCES.filter((s) => totals[s] > 0)
  const share = (s: IncomeSource) => (totals.total > 0 ? (totals[s] / totals.total) * 100 : 0)
  const perMonth = totals.total / 12
  const expenses = targets?.monthlyEssentialExpenses ?? 0
  const coverage = expenses > 0 ? (perMonth / expenses) * 100 : null
  const payments = nextPayments(income.upcoming, income.savings)
  const rows = incomeBySource(income.months, income.upcoming, income.savings)
  const cadence = (c: DividendCadence | null) => (c ? t(`accounts.dividends.cadence.${c}`) : '—')

  const paymentHint = (p: IncomePayment) => [
    t(`income.payment.${p.source}`),
    p.ratePct != null ? formatPercent(p.ratePct, { fractionDigits: 2 }) : p.cadence && cadence(p.cadence),
    p.exDateOnly && t('income.upcoming.exDate'),
  ].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-4">
      {header}

      <Card>
        <CardContent className="flex flex-wrap gap-8">
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
            <span className="text-[13px] font-medium text-muted-foreground">{t('income.hero.projected')}</span>
            <CurrencyDisplay value={totals.total} className="text-4xl leading-tight font-bold tracking-tight tabular-nums text-foreground sm:text-[44px]" />
            <span className="text-[13px] text-muted-foreground">
              {t('income.hero.perMonth', { amount: money.amount(perMonth) })}
              {receivedSum > 0 && <> · {t('income.hero.received', { amount: money.amount(receivedSum) })}</>}
            </span>
          </div>

          {sources.length > 0 && (
            <div className="flex min-w-0 flex-[2_1_380px] flex-col gap-2.5">
              <span className="text-[13px] font-medium text-muted-foreground">{t('income.hero.sources')}</span>
              <div
                className="flex h-3 gap-0.5 overflow-hidden rounded-full"
                role="img"
                aria-label={`${t('common.labelColon', { label: t('income.hero.sources') })} ${sources
                  .map((s) => `${t(`income.source.${s}`)} ${formatPercent(share(s), { fractionDigits: 0 })}`)
                  .join(', ')}`}
              >
                {sources.map((s) => (
                  <span key={s} style={{ width: `${share(s)}%`, backgroundColor: SOURCE_COLORS[s] }} />
                ))}
              </div>
              <ul className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-4 gap-y-2 text-[13px]">
                {sources.map((s) => (
                  <li key={s} className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: SOURCE_COLORS[s] }} aria-hidden="true" />
                      <span className="truncate">{t(`income.source.${s}`)}</span>
                    </span>
                    <CurrencyDisplay value={totals[s]} className="font-semibold tabular-nums text-foreground" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2 rounded-xl bg-muted p-4">
            <span className="text-[13px] font-medium text-muted-foreground">{t('income.hero.coverage')}</span>
            {coverage == null ? (
              <p className="text-xs text-muted-foreground">
                {t('income.hero.coverageUnknown')}{' '}
                <Link to="/analysis" className="font-medium text-primary hover:text-foreground">{t('nav.analysis')}</Link>
              </p>
            ) : (
              <>
                <span className="text-[22px] leading-tight font-semibold tabular-nums text-foreground">
                  {formatPercent(coverage, { fractionDigits: 1 })}
                </span>
                <Progress value={Math.min(coverage, 100)} aria-label={t('income.hero.coverage')} />
                <span className="text-xs text-muted-foreground">
                  {t('income.hero.coverageDetail', { income: money.amount(perMonth), expenses: money.amount(expenses) })}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('income.months.title')}</CardTitle>
            <CardDescription>{t('income.months.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <IncomeMonthsChart months={income.months} sources={sources} />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('income.upcoming.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('income.upcoming.empty')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {payments.map((p) => (
                  <li key={p.id} className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-3 py-2">
                    <span className="text-center text-xs leading-tight font-semibold text-muted-foreground">
                      {formatShortDate(p.date, locale)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{paymentHint(p)}</span>
                    </span>
                    <CurrencyDisplay value={p.amount} className="text-sm font-semibold tabular-nums text-foreground" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{t('income.table.title')}</CardTitle>
          <CardDescription>{t('income.table.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[640px] text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>{t('income.table.source')}</TableHead>
                <TableHead>{t('income.table.type')}</TableHead>
                <TableHead className="text-right">{t('income.table.amount')}</TableHead>
                <TableHead className="text-right">{t('income.table.rate')}</TableHead>
                <TableHead>{t('income.table.cadence')}</TableHead>
                <TableHead>{t('income.table.next')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-semibold">{row.name ?? t('income.source.rent')}</TableCell>
                  <TableCell><Badge variant="secondary">{t(`income.type.${row.source}`)}</Badge></TableCell>
                  <TableCell className="text-right">
                    <CurrencyDisplay value={row.amount} className="font-semibold tabular-nums text-foreground" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.ratePct != null ? formatPercent(row.ratePct, { fractionDigits: 2 }) : '—'}
                  </TableCell>
                  <TableCell>{cadence(row.cadence)}</TableCell>
                  <TableCell>{row.nextDate ? formatShortDate(row.nextDate, locale) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
