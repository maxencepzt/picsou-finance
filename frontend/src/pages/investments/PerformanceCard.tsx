import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePerformance } from '@/features/analysis/hooks'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { ScrollStrip } from '@/components/shared/ScrollStrip'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatApiError } from '@/lib/errors'
import { cn, formatDate, formatPercent } from '@/lib/utils'
import { PerformanceChart } from './PerformanceChart'
import { PERF_PERIODS, type PerfPeriod } from './performance'

/**
 * A KPI tile whose caption wraps instead of truncating: when the figure is missing, the caption is
 * the reason, and it must stay readable at phone width. An unmeasured metric is never shown as 0.
 */
function Metric({ label, value, note, missing }: { label: string; value: string | null; note: string; missing: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-muted p-3">
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      <span className="text-[22px] leading-tight font-semibold tracking-tight tabular-nums text-foreground">
        {value ?? <span aria-label={missing} title={missing}>—</span>}
      </span>
      <span className="text-xs text-muted-foreground">{value == null ? missing : note}</span>
    </div>
  )
}

const signed = (value: number | null) => (value == null ? null : formatPercent(value, { signed: true }))

/** Time- and money-weighted return of the investment accounts, their risk, and a comparison with an index. */
export function PerformanceCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [months, setMonths] = useState<PerfPeriod>(12)
  const performance = usePerformance(months)
  const data = performance.data

  let body
  if (performance.isLoading) {
    body = (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
        </div>
        <Skeleton className="h-[220px] rounded-xl" />
      </div>
    )
  } else if (performance.isError) {
    body = <ErrorState messageOnly message={formatApiError(performance.error, t)} onRetry={() => void performance.refetch()} />
  } else if (!data?.points?.length) {
    body = <EmptyState className="py-8" title={t('investments.perf.empty')} description={t('investments.perf.emptyHint')} />
  } else {
    const drawdownNote = data.maxDrawdownFrom && data.maxDrawdownTo
      ? t('investments.perf.drawdownDates', { from: formatDate(data.maxDrawdownFrom), to: formatDate(data.maxDrawdownTo) })
      : t('investments.perf.noDrawdown')
    body = (
      <>
        <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3">
          <Metric label={t('investments.perf.twr')} value={signed(data.twrPercent)} note={t('investments.perf.twrNote')} missing={t('investments.perf.missing.history')} />
          <Metric label={t('investments.perf.annualized')} value={signed(data.annualizedPercent)} note={t('investments.perf.annualizedNote')} missing={t('investments.perf.missing.year')} />
          <Metric label={t('investments.perf.xirr')} value={signed(data.xirrPercent)} note={t('investments.perf.xirrNote')} missing={t('investments.perf.missing.xirr')} />
          <Metric
            label={t('investments.perf.volatility')}
            value={data.volatilityPercent == null ? null : formatPercent(data.volatilityPercent)}
            note={t('investments.perf.volatilityNote')}
            missing={t('investments.perf.missing.returns')}
          />
          <Metric
            label={t('investments.perf.drawdown')}
            value={data.maxDrawdownPercent == null ? null : formatPercent(data.maxDrawdownPercent)}
            note={drawdownNote}
            missing={t('investments.perf.missing.history')}
          />
          <p className="col-span-2 self-center text-xs text-muted-foreground @lg:col-span-1">{t('investments.perf.explain')}</p>
        </div>
        <PerformanceChart points={data.points} months={months} />
      </>
    )
  }

  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader>
        <CardTitle>{t('investments.perf.title')}</CardTitle>
        {data?.points?.length
          ? <CardDescription>{t('investments.perf.window', { from: formatDate(data.from), to: formatDate(data.to) })}</CardDescription>
          : null}
      </CardHeader>
      <CardContent className="@container flex flex-col gap-4">
        <ScrollStrip activeKey={String(months)}>
          <SegmentedControl
            ariaLabel={t('investments.perf.period')}
            value={String(months)}
            onChange={(value) => setMonths(Number(value) as PerfPeriod)}
            options={PERF_PERIODS.map((m) => ({ value: String(m), label: t(`investments.perf.periods.${m}`) }))}
          />
        </ScrollStrip>
        {body}
      </CardContent>
    </Card>
  )
}
