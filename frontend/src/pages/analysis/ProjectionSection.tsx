import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, XAxis, YAxis, usePlotArea, useXAxisScale, useYAxisScale } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { AllocationTrajectory } from './AllocationTrajectory'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import { useProjection, useProjectionDateLabel } from '@/features/analysis/hooks'
import { useMoney } from '@/hooks/use-money'
import { useIsMobile } from '@/hooks/use-mobile'
import { MONEY_AXIS_WIDTH } from '@/lib/money'
import { MoneyChartTooltip } from '@/components/shared/MoneyChartTooltip'
import { cn, formatPercent } from '@/lib/utils'
import type { ProjectionScenario } from '@/types/api'
import { AXIS_PROPS, AXIS_PROPS_FLUSH } from '@/lib/chart-axis'
import { labelGutter, spreadLabels } from './projection-labels'

const HORIZONS = [10, 20, 30] as const

/**
 * The theme's chart tokens are a single-hue ramp, not five distinct hues — which suits ordered
 * data exactly. Spread across it darkest-to-lightest so "more optimistic" reads as "brighter";
 * chart-5 is the app's "invested" reference, kept for the contributions.
 */
const SCENARIO_COLORS: Record<ProjectionScenario['key'], string> = {
  PESSIMISTIC: 'var(--chart-3)',
  CAUTIOUS: 'var(--chart-1)',
  REFERENCE: 'var(--chart-2)',
  OPTIMISTIC: 'var(--chart-4)',
}

/** Contributions are drawn beneath every scenario, so they read as the floor the gain sits on. */
const CONTRIBUTED_COLOR = 'var(--chart-5)'

/** The series the legend can toggle: contributions first, then the scenarios in payload order. */
const CONTRIBUTED_KEY = 'contributed'

/** Vertical room per end label: 11px text plus air. */
const LABEL_GAP = 14

interface ScenarioEnd {
  key: string
  date: string
  value: number
  text: string
  color: string
}

/**
 * The final value of each visible scenario, written at the right end of its line and spread so
 * no two overlap. A dot marks the line's real end and a short leader joins it to a label that
 * had to move. Rendered inside the chart, where Recharts' hooks give the scales.
 */
function ScenarioEndLabels({ ends }: { ends: ScenarioEnd[] }) {
  const xScale = useXAxisScale()
  const yScale = useYAxisScale()
  const plot = usePlotArea()
  if (!xScale || !yScale || !plot) return null
  const anchored = ends.flatMap((end) => {
    const x = xScale(end.date)
    const y = yScale(end.value)
    return x == null || y == null ? [] : [{ ...end, x, y }]
  })
  const placed = spreadLabels(anchored, LABEL_GAP, plot.y + LABEL_GAP / 2, plot.y + plot.height - LABEL_GAP / 2)
  return (
    <g aria-hidden="true">
      {placed.map((end) => (
        <g key={end.key}>
          <circle cx={end.x} cy={end.y} r={2.5} fill={end.color} />
          {Math.abs(end.labelY - end.y) > 1 && (
            <line x1={end.x + 2} y1={end.y} x2={end.x + 6} y2={end.labelY} stroke={end.color} strokeWidth={1} />
          )}
          <text
            x={end.x + 8}
            y={end.labelY}
            dominantBaseline="central"
            className="fill-foreground text-[11px] font-semibold tabular-nums"
          >
            {end.text}
          </text>
        </g>
      ))}
    </g>
  )
}

/**
 * The next round number at or above a value — 1, 2, 2.5 or 5 times a power of ten.
 *
 * <p>Needed because the Y domain is pinned rather than derived from what is on screen (see below),
 * and a hard-coded maximum of, say, 1 284 617 would put its ticks at 256 923 intervals.
 */
function niceCeiling(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const scaled = value / magnitude
  const step = [1, 2, 2.5, 5, 10].find((candidate) => scaled <= candidate) ?? 10
  return step * magnitude
}

export function ProjectionSection({ className }: { className?: string }) {
  const { t } = useTranslation()
  const dateLabel = useProjectionDateLabel()
  const [years, setYears] = useState<number>(20)
  // Two questions, one card: how much, and in what. Tabs rather than two cards because they
  // share a horizon — switching view must not lose it.
  const [view, setView] = useState<'wealth' | 'allocation'>('wealth')
  // Everything visible until the reader says otherwise. Hidden rather than shown, so a scenario
  // added later to the payload appears without anyone remembering to opt it in.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const money = useMoney()
  // A phone's chart has no room beside the lines; the legend and the tooltip still carry the values.
  const showEndLabels = !useIsMobile()
  const projection = useProjection(years)

  const config = useMemo<ChartConfig>(() => {
    const entries = (projection.data?.scenarios ?? []).map((s) => [
      s.key,
      {
        // The rate comes from the payload, never restated here: a label that disagrees with the
        // curve that produced it is worse than no label.
        label: t(`analysis.projection.scenarios.${s.key}`, {
          value: formatPercent(s.annualPercent),
        }),
        color: SCENARIO_COLORS[s.key],
      },
    ])
    return Object.fromEntries(entries) as ChartConfig
  }, [projection.data, t])

  // Recharts wants one row per x value with a column per series.
  const rows = useMemo(() => {
    const scenarios = projection.data?.scenarios ?? []
    const first = scenarios[0]
    if (!first) return []
    return first.points.map((point, i) => {
      // The same for every scenario — it is capital in, not a return — so it is read off the
      // first and drawn once. The gap above it is the gain, which is the figure this chart was
      // computing all along and never showed.
      const row: Record<string, string | number> = {
        date: point.date,
        contributed: point.contributedEur,
      }
      for (const scenario of scenarios) {
        row[scenario.key] = scenario.points[i]?.valueEur ?? 0
      }
      return row
    })
  }, [projection.data])

  /**
   * Pinned to the full set of series, not to the visible ones.
   *
   * <p>Letting the axis breathe when a curve is hidden makes every remaining curve jump to a new
   * scale — so the act of hiding the optimistic line appears to move the pessimistic one, which
   * is the opposite of what the reader clicked for.
   */
  const yMax = useMemo(() => {
    let max = 0
    for (const row of rows) {
      for (const [key, value] of Object.entries(row)) {
        if (key !== 'date' && typeof value === 'number') max = Math.max(max, value)
      }
    }
    return niceCeiling(max)
  }, [rows])

  const legend = useMemo(
    () => [
      { key: CONTRIBUTED_KEY, label: t('analysis.projection.contributed'), color: CONTRIBUTED_COLOR },
      ...(projection.data?.scenarios ?? []).map((scenario) => ({
        key: scenario.key,
        label: t(`analysis.projection.scenarios.${scenario.key}`, {
          value: formatPercent(scenario.annualPercent),
        }),
        color: SCENARIO_COLORS[scenario.key],
      })),
    ],
    [projection.data, t],
  )

  const ends = useMemo<ScenarioEnd[]>(() => {
    const last = rows.at(-1)
    if (!last) return []
    return Object.keys(config)
      .filter((key) => !hidden.has(key))
      .map((key) => ({
        key,
        date: String(last.date),
        value: Number(last[key] ?? 0),
        text: money.compact(Number(last[key] ?? 0)),
        color: SCENARIO_COLORS[key as ProjectionScenario['key']],
      }))
  }, [rows, config, hidden, money])

  const toggle = (key: string) =>
    setHidden((previous) => {
      const next = new Set(previous)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const hasSomethingToProject =
    (projection.data?.baseValueEur ?? 0) > 0 || (projection.data?.monthlyInflowEur ?? 0) > 0

  const viewOptions = (['wealth', 'allocation'] as const).map((key) => ({
    value: key,
    label: t(`analysis.projection.views.${key}`),
  }))
  const horizonOptions = HORIZONS.map((horizon) => ({
    value: String(horizon),
    label: t('analysis.projection.years', { count: horizon }),
  }))

  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle>{t('analysis.projection.title')}</CardTitle>
          {/* The base is stated because it is not the net worth on the dashboard: property,
              loans and alternative assets are out, and a reader has to know that. */}
          {projection.data && hasSomethingToProject && (
            <CardDescription>
              {t('analysis.projection.basis')}{' '}
              <CurrencyDisplay value={projection.data.baseValueEur} className="text-foreground" />
              {projection.data.monthlyInflowEur > 0 && (
                <>
                  {' · '}
                  {t('analysis.projection.monthly')}{' '}
                  <CurrencyDisplay value={projection.data.monthlyInflowEur} className="text-foreground" />
                </>
              )}
            </CardDescription>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            options={viewOptions}
            value={view}
            onChange={setView}
            ariaLabel={t('analysis.projection.viewLabel')}
          />
          <SegmentedControl
            options={horizonOptions}
            value={String(years)}
            onChange={(value) => setYears(Number(value))}
            ariaLabel={t('analysis.projection.horizonLabel')}
          />
        </div>
      </CardHeader>
      <CardContent>
        {!projection.data ? null : !hasSomethingToProject ? (
          <p className="text-sm text-muted-foreground">{t('analysis.projection.nothingToProject')}</p>
        ) : (
          <>
            {view === 'allocation' ? (
              <AllocationTrajectory allocation={projection.data.allocation} />
            ) : (
              <>
            <ChartContainer
              config={config}
              className="h-[300px] w-full"
              role="img"
              aria-label={t('analysis.projection.chartLabel', {
                years,
                values: ends.map((end) => `${config[end.key]?.label ?? end.key} ${end.text}`).join(', '),
              })}
            >
              <LineChart
                data={rows}
                margin={{ left: 4, right: showEndLabels && ends.length > 0 ? labelGutter(ends.map((end) => end.text)) : 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  {...AXIS_PROPS}
                  tickFormatter={(value: string) => value.slice(0, 4)}
                />
                <YAxis
                  {...AXIS_PROPS_FLUSH}
                  width={MONEY_AXIS_WIDTH}
                  domain={[0, yMax]}
                  tickFormatter={money.tick}
                />
                <ChartTooltip
                  content={
                    <MoneyChartTooltip
                      config={config}
                      indicator="line"
                      labelFormatter={(value) => dateLabel(String(value))}
                    />
                  }
                />
                {!hidden.has(CONTRIBUTED_KEY) && (
                  <Line
                    type="monotone"
                    dataKey="contributed"
                    stroke={CONTRIBUTED_COLOR}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    name={t('analysis.projection.contributed')}
                  />
                )}
                {Object.keys(config)
                  .filter((key) => !hidden.has(key))
                  .map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={`var(--color-${key})`}
                      // The reference scenario is the one to read; the others frame it.
                      strokeWidth={key === 'REFERENCE' ? 3 : 2}
                      dot={false}
                    />
                  ))}
                {showEndLabels && <ScenarioEndLabels ends={ends} />}
              </LineChart>
            </ChartContainer>

            {/* Rendered here rather than through Recharts' <Legend>, which sorts alphabetically
                and so scrambles a series whose whole meaning is its order. Each entry is also the
                control for its curve: four scenarios plus contributions is more than a 320px
                chart can separate, and comparing two of them means removing the other three. */}
            <ul className="mt-2 flex flex-wrap gap-x-4">
              {legend.map((entry) => {
                const shown = !hidden.has(entry.key)
                return (
                  <li key={entry.key}>
                    <button
                      type="button"
                      aria-pressed={shown}
                      onClick={() => toggle(entry.key)}
                      className={cn(
                        // The row is dense; the padding gives each toggle a finger-sized target.
                        '-mx-1 flex min-h-8 items-center gap-1.5 rounded-md px-1 text-xs font-medium transition-[color] hover:text-foreground',
                        shown ? 'text-foreground' : 'text-muted-foreground line-through',
                      )}
                    >
                      {/* A stroke swatch, since the series are lines. */}
                      <span
                        className={cn('h-0.5 w-3.5 shrink-0 rounded-full', !shown && 'opacity-40')}
                        style={{ backgroundColor: entry.color }}
                        aria-hidden="true"
                      />
                      {entry.label}
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('analysis.projection.blendNote')}
            </p>
              </>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              {t('analysis.projection.disclaimer')}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
