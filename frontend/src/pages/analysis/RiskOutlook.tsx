import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useProjectionDateLabel, useProjectionRisk } from '@/features/analysis/hooks'
import { useMoney } from '@/hooks/use-money'
import { MONEY_AXIS_WIDTH } from '@/lib/money'
import { AXIS_PROPS, AXIS_PROPS_FLUSH } from '@/lib/chart-axis'
import { formatNumber, formatPercent } from '@/lib/utils'
import { ErrorState } from '@/components/shared/ErrorState'
import type { RiskBand } from '@/types/api'

const BAND_COLOR = 'var(--chart-1)'
const CONTRIBUTED_COLOR = 'var(--chart-5)'

interface Row {
  date: string
  outer: [number, number]
  inner: [number, number]
  median: number
  contributed: number
  band: RiskBand
}

function RiskTooltip({ active, payload, label }: Readonly<{ active?: boolean; payload?: { payload: Row }[]; label?: string }>) {
  const { t } = useTranslation()
  const money = useMoney()
  const dateLabel = useProjectionDateLabel()
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const lines: [string, number][] = [
    [t('analysis.projection.risk.p90'), row.band.p90Eur],
    [t('analysis.projection.risk.p50'), row.band.p50Eur],
    [t('analysis.projection.risk.p10'), row.band.p10Eur],
    [t('analysis.projection.contributed'), row.band.contributedEur],
  ]
  return (
    <div className="rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/10">
      <p className="mb-1 font-medium">{dateLabel(String(label))}</p>
      {lines.map(([name, value]) => (
        <p key={name} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{name}</span>
          <span className="font-semibold tabular-nums">{money.amount(value, 'EUR', { maximumFractionDigits: 0 })}</span>
        </p>
      ))}
    </div>
  )
}

/**
 * The projection drawn over thousands of random futures: a fan instead of four steady curves,
 * and the risk figures said in words — the odds of ending below what was paid in, and of going
 * through a hard fall on the way.
 */
export function RiskOutlook({ years }: Readonly<{ years: number }>) {
  const { t } = useTranslation()
  const money = useMoney()
  const risk = useProjectionRisk(years)

  const rows = useMemo<Row[]>(
    () =>
      (risk.data?.points ?? []).map((band) => ({
        date: band.date,
        outer: [band.p10Eur, band.p90Eur],
        inner: [band.p25Eur, band.p75Eur],
        median: band.p50Eur,
        contributed: band.contributedEur,
        band,
      })),
    [risk.data],
  )

  const config = useMemo<ChartConfig>(
    () => ({
      outer: { label: t('analysis.projection.risk.outer'), color: BAND_COLOR },
      inner: { label: t('analysis.projection.risk.inner'), color: BAND_COLOR },
      median: { label: t('analysis.projection.risk.p50'), color: BAND_COLOR },
      contributed: { label: t('analysis.projection.contributed'), color: CONTRIBUTED_COLOR },
    }),
    [t],
  )

  // Same footprint as the loaded view, so the card does not jump when the simulation answers.
  if (risk.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-[300px] w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    )
  }
  if (risk.isError && !risk.data) {
    return <ErrorState messageOnly message={t('common.error')} onRetry={() => void risk.refetch()} />
  }
  if (!risk.data) return null
  const last = risk.data.points.at(-1)
  if (!last) return null
  const { summary } = risk.data
  const horizon = last.date.slice(0, 4)
  const pct = (value: number) => formatPercent(value, { fractionDigits: 0 })
  // Rounded to the thousand: these are odds over decades, and 411 845 € claims a precision they do not have.
  const whole = (value: number) => money.amount(Math.round(value / 1000) * 1000, 'EUR', { maximumFractionDigits: 0 })

  const facts = [
    {
      key: 'range',
      label: t('analysis.projection.risk.rangeLabel', { year: horizon }),
      value: `${money.compact(last.p10Eur)} – ${money.compact(last.p90Eur)}`,
      note: t('analysis.projection.risk.rangeNote', { median: whole(last.p50Eur) }),
    },
    {
      key: 'worst',
      label: t('analysis.projection.risk.worstLabel'),
      value: whole(summary.p5Eur),
      note: t('analysis.projection.risk.worstNote'),
    },
    {
      key: 'below',
      label: t('analysis.projection.risk.belowLabel'),
      value: pct(summary.belowContributedPercent),
      note: t('analysis.projection.risk.belowNote', { contributed: whole(last.contributedEur) }),
    },
    {
      key: 'drawdown',
      label: t('analysis.projection.risk.drawdownLabel', { threshold: pct(summary.drawdownThresholdPercent) }),
      value: pct(summary.drawdownPercent),
      note: t('analysis.projection.risk.drawdownNote', { median: pct(summary.medianWorstDrawdownPercent) }),
    },
  ]

  const volatility = risk.data.assumptions
    .filter((a) => a.volatilityPercent > 0)
    .map((a) =>
      t('analysis.projection.risk.assumption', {
        tier: t(`analysis.tiers.${a.tier}`),
        expected: formatPercent(a.expectedPercent),
        volatility: pct(a.volatilityPercent),
      }),
    )
    .join(' · ')

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer
        config={config}
        className="h-[300px] w-full"
        role="img"
        aria-label={t('analysis.projection.risk.chartLabel', {
          year: horizon,
          low: whole(last.p10Eur),
          median: whole(last.p50Eur),
          high: whole(last.p90Eur),
        })}
      >
        <ComposedChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={(value: string) => value.slice(0, 4)} />
          <YAxis {...AXIS_PROPS_FLUSH} width={MONEY_AXIS_WIDTH} domain={[0, 'auto']} tickFormatter={money.tick} />
          <ChartTooltip content={<RiskTooltip />} />
          <Area type="monotone" dataKey="outer" stroke="none" fill={BAND_COLOR} fillOpacity={0.14} activeDot={false} animationDuration={900} />
          <Area type="monotone" dataKey="inner" stroke="none" fill={BAND_COLOR} fillOpacity={0.26} activeDot={false} animationDuration={900} animationBegin={120} />
          <Line type="monotone" dataKey="contributed" stroke={CONTRIBUTED_COLOR} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} animationDuration={900} />
          <Line type="monotone" dataKey="median" stroke={BAND_COLOR} strokeWidth={3} dot={false} animationDuration={900} animationBegin={240} />
        </ComposedChart>
      </ChartContainer>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label={t('analysis.projection.risk.legend')}>
        <li className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 rounded-full" style={{ backgroundColor: BAND_COLOR }} aria-hidden="true" />{t('analysis.projection.risk.p50')}</li>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-sm opacity-50" style={{ backgroundColor: BAND_COLOR }} aria-hidden="true" />{t('analysis.projection.risk.inner')}</li>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-sm opacity-25" style={{ backgroundColor: BAND_COLOR }} aria-hidden="true" />{t('analysis.projection.risk.outer')}</li>
        <li className="flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: CONTRIBUTED_COLOR }} aria-hidden="true" />{t('analysis.projection.contributed')}</li>
      </ul>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {facts.map((fact, i) => (
          <div
            key={`${fact.key}-${years}`}
            className="flex flex-col gap-1 rounded-xl bg-muted/60 p-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-300"
            style={{ animationDelay: `${300 + i * 60}ms` }}
          >
            <dt className="text-xs font-medium text-muted-foreground">{fact.label}</dt>
            <dd className="text-lg font-semibold tabular-nums text-foreground">{fact.value}</dd>
            <dd className="text-xs text-muted-foreground">{fact.note}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-muted-foreground">
        {t('analysis.projection.risk.method', { paths: formatNumber(risk.data.paths) })} {volatility}
      </p>
    </div>
  )
}
