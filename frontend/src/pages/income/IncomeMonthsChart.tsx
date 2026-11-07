import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from '@/components/ui/chart'
import { MoneyChartTooltip } from '@/components/shared/MoneyChartTooltip'
import { useMoney } from '@/hooks/use-money'
import { AXIS_PROPS, yAxisWidth } from '@/lib/chart-axis'
import { localeFromLanguage } from '@/lib/utils'
import { INCOME_SOURCES, monthLabel, SOURCE_COLORS, type IncomeChartRow } from './income-view'

// Received first, then the forecast in the hero's source order (Recharts sorts alphabetically otherwise).
const LEGEND_ORDER = ['received', ...INCOME_SOURCES]

/**
 * Month by month on one money axis: dividends received as solid bars, the forecast stacked by
 * source as lighter outlined bars. Only the sides and sources that pay something get a bar and a
 * legend entry.
 */
export function IncomeMonthsChart({ rows, ariaLabel }: { rows: IncomeChartRow[]; ariaLabel: string }) {
  const { t, i18n } = useTranslation()
  const money = useMoney()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)

  const received = rows.some((r) => (r.received ?? 0) > 0)
  const forecast = INCOME_SOURCES.filter((s) => rows.some((r) => (r[s] ?? 0) > 0))
  if (!received && forecast.length === 0) return <p className="py-12 text-center text-sm text-muted-foreground">{t('income.months.empty')}</p>
  const config = {
    received: { label: t('income.months.received'), color: SOURCE_COLORS.dividends },
    ...Object.fromEntries(
      forecast.map((s) => [s, { label: t('income.months.forecastOf', { source: t(`income.source.${s}`) }), color: SOURCE_COLORS[s] }]),
    ),
  } satisfies ChartConfig
  const width = yAxisWidth(
    rows.map((r) => (r.received ?? 0) + (r.dividends ?? 0) + (r.scpi ?? 0) + (r.rent ?? 0) + (r.interest ?? 0)),
    money.tick,
  )

  return (
    // Grows with a card stretched by its neighbour instead of leaving a blank band under the legend.
    <ChartContainer config={config} className="aspect-auto min-h-[260px] w-full flex-1" role="img" aria-label={ariaLabel}>
      <BarChart data={rows} accessibilityLayer>
        <CartesianGrid vertical={false} />
        {/* Evenly spaced months (the default skips whichever label collides, leaving uneven gaps);
            the first one carries its year, since an even step may skip January. */}
        <XAxis
          dataKey="month"
          {...AXIS_PROPS}
          fontSize={12}
          interval="equidistantPreserveStart"
          tickFormatter={(m: string) => monthLabel(m, locale, false, m === rows[0]?.month)}
        />
        <YAxis {...AXIS_PROPS} width={width} fontSize={12} tickFormatter={money.tick} />
        <ChartTooltip content={<MoneyChartTooltip config={config} labelFormatter={(m) => monthLabel(String(m), locale, true)} />} />
        <ChartLegend
          content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-1" />}
          itemSorter={(item) => LEGEND_ORDER.indexOf(String(item.dataKey))}
        />
        {received && <Bar dataKey="received" stackId="income" fill="var(--color-received)" />}
        {forecast.map((s) => (
          <Bar
            key={s}
            dataKey={s}
            stackId="income"
            fill={`color-mix(in oklab, var(--color-${s}) 35%, transparent)`}
            stroke={`var(--color-${s})`}
            strokeWidth={1}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
