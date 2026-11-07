import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { useBenchmark } from '@/features/analysis/hooks'
import { ErrorState } from '@/components/shared/ErrorState'
import { ScrollStrip } from '@/components/shared/ScrollStrip'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { type ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { AXIS_PROPS, yAxisWidth } from '@/lib/chart-axis'
import { formatApiError } from '@/lib/errors'
import { formatDate, formatDecimal, formatPercent, localeFromLanguage } from '@/lib/utils'
import type { BenchmarkKey, PerformancePoint } from '@/types/api'
import { BENCHMARKS, compareToBenchmark, dateTickFormat, dateTicks, type ComparisonPoint } from './performance'

type Compare = 'none' | BenchmarkKey

const indexTick = (value: number) => formatDecimal(value, 0)
const signedPoints = (value: number) => `${value > 0 ? '+' : ''}${formatDecimal(value, 1)}`

function Swatch({ dashed }: { dashed?: boolean }) {
  return dashed
    ? <span className="h-0.5 w-4 shrink-0 border-t-2 border-dashed" style={{ borderColor: 'var(--color-benchmark)' }} aria-hidden="true" />
    : <span className="h-0.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: 'var(--color-portfolio)' }} aria-hidden="true" />
}

function ComparisonTooltip({ active, payload, portfolioLabel, benchmarkLabel }: {
  active?: boolean
  payload?: { payload: ComparisonPoint }[]
  portfolioLabel: string
  benchmarkLabel: string
}) {
  const { t } = useTranslation()
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  const gap = point.benchmark == null ? null : point.portfolio - point.benchmark
  return (
    <div className="rounded-xl bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10">
      <div className="mb-1.5 font-medium">{formatDate(point.date)}</div>
      <div className="flex items-center gap-2 py-0.5">
        <Swatch />
        <span className="text-muted-foreground">{portfolioLabel}</span>
        <span className="ml-auto pl-3 font-medium tabular-nums">{formatDecimal(point.portfolio, 1)}</span>
      </div>
      {point.benchmark != null && (
        <div className="flex items-center gap-2 py-0.5">
          <Swatch dashed />
          <span className="text-muted-foreground">{benchmarkLabel}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">{formatDecimal(point.benchmark, 1)}</span>
        </div>
      )}
      {gap != null && (
        <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-border pt-1.5">
          <span className="text-muted-foreground">{t('investments.benchmark.gap')}</span>
          <span className="font-medium tabular-nums">{t('investments.benchmark.points', { value: signedPoints(gap) })}</span>
        </div>
      )}
    </div>
  )
}

/**
 * The portfolio's time-weighted index (deposits taken out), optionally beside an index fund,
 * both at 100 on the first date they share: one axis, so the gap reads in points.
 */
export function PerformanceChart({ points, months }: { points: PerformancePoint[]; months: number }) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const [compare, setCompare] = useState<Compare>('none')
  const key = compare === 'none' ? null : compare
  const benchmark = useBenchmark(key, months)
  const name = BENCHMARKS.find((b) => b.key === key)?.label ?? ''

  const compared = useMemo(
    // Guarded: demo mode answers an unhandled endpoint with {}.
    () => (key && benchmark.data ? compareToBenchmark(points, benchmark.data.points ?? []) : []),
    [key, benchmark.data, points],
  )
  // Under two shared dates there is nothing to compare: the portfolio is drawn alone.
  const withBenchmark = compared.length >= 2
  const series = useMemo(() => {
    const rows = withBenchmark ? compared : compareToBenchmark(points, null)
    return rows.map((p) => ({ ...p, dateMs: new Date(p.date).getTime() }))
  }, [withBenchmark, compared, points])

  const xDomain: [number, number] = [series[0]?.dateMs ?? 0, series[series.length - 1]?.dateMs ?? 0]
  const xTicks = dateTicks(...xDomain)
  const tickFormat = dateTickFormat(...xDomain)
  const dateTick = (value: number) => new Date(value).toLocaleDateString(locale, tickFormat)
  const yWidth = yAxisWidth(series.flatMap((p) => (p.benchmark == null ? [p.portfolio] : [p.portfolio, p.benchmark])), indexTick)

  const portfolioLabel = t('investments.benchmark.portfolio')
  const config = {
    portfolio: { label: portfolioLabel, color: 'var(--chart-1)' },
    benchmark: { label: name, color: 'var(--chart-5)' },
  } satisfies ChartConfig

  const last = series[series.length - 1]
  const summary = withBenchmark && last.benchmark != null
    ? t('investments.benchmark.summary', {
      portfolio: formatPercent(last.portfolio - 100, { signed: true }),
      name,
      benchmark: formatPercent(last.benchmark - 100, { signed: true }),
      gap: t('investments.benchmark.points', { value: signedPoints(last.portfolio - last.benchmark) }),
    })
    : null
  const caption = t('investments.benchmark.base', { date: formatDate(series[0]?.date) })

  let chart
  if (key && benchmark.isLoading) {
    chart = <Skeleton className="h-[220px] rounded-xl" />
  } else if (key && benchmark.isError) {
    chart = <ErrorState messageOnly message={formatApiError(benchmark.error, t)} onRetry={() => void benchmark.refetch()} />
  } else {
    chart = (
      <ChartContainer
        config={config}
        role="img"
        aria-label={summary ?? caption}
        className="h-[220px] w-full [&>div>div]:!w-full [&>div>div>svg]:!w-full"
      >
        <LineChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis type="number" dataKey="dateMs" scale="time" domain={xDomain} ticks={xTicks} {...AXIS_PROPS} tickFormatter={dateTick} />
          <YAxis {...AXIS_PROPS} domain={['auto', 'auto']} tickFormatter={indexTick} width={yWidth} tickCount={5} />
          <ReferenceLine y={100} stroke="var(--muted-foreground)" strokeOpacity={0.35} strokeDasharray="2 4" />
          <ChartTooltip content={<ComparisonTooltip portfolioLabel={portfolioLabel} benchmarkLabel={name} />} />
          <Line dataKey="portfolio" type="monotone" stroke="var(--color-portfolio)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          {withBenchmark && (
            <Line dataKey="benchmark" type="monotone" stroke="var(--color-benchmark)" strokeWidth={1.5} strokeDasharray="6 4" dot={false} activeDot={{ r: 3 }} />
          )}
          {withBenchmark && (
            <Legend content={() => (
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 pt-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Swatch />{portfolioLabel}</span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Swatch dashed />{name}</span>
              </div>
            )} />
          )}
        </LineChart>
      </ChartContainer>
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="text-[13px] font-medium text-muted-foreground">{caption}</span>
        <ScrollStrip activeKey={compare}>
          <SegmentedControl
            ariaLabel={t('investments.benchmark.compareTo')}
            value={compare}
            onChange={setCompare}
            options={[
              { value: 'none', label: t('investments.benchmark.none') },
              ...BENCHMARKS.map((b) => ({ value: b.key, label: b.label })),
            ]}
          />
        </ScrollStrip>
      </div>
      {chart}
      {key && !benchmark.isLoading && !benchmark.isError && (
        <p className="text-xs text-muted-foreground">{summary ?? t('investments.benchmark.empty', { name })}</p>
      )}
    </div>
  )
}
