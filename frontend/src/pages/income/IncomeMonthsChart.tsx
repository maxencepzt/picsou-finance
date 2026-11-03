import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from '@/components/ui/chart'
import { MoneyChartTooltip } from '@/components/shared/MoneyChartTooltip'
import { useMoney } from '@/hooks/use-money'
import { AXIS_PROPS, yAxisWidth } from '@/lib/chart-axis'
import { localeFromLanguage } from '@/lib/utils'
import type { IncomeMonth, IncomeSource } from '@/features/income/passive-income'
import { monthLabel, SOURCE_COLORS } from './income-view'

/** The twelve months stacked by source; only the sources that pay something get a bar and a legend entry. */
export function IncomeMonthsChart({ months, sources }: { months: IncomeMonth[]; sources: IncomeSource[] }) {
  const { t, i18n } = useTranslation()
  const money = useMoney()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)

  const config = Object.fromEntries(
    sources.map((s) => [s, { label: t(`income.source.${s}`), color: SOURCE_COLORS[s] }]),
  ) satisfies ChartConfig
  const data = months.map((m) => ({ ...m, label: monthLabel(m.month, locale) }))
  const width = yAxisWidth(months.map((m) => m.dividends + m.scpi + m.rent + m.interest), money.tick)

  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} fontSize={12} />
        <YAxis {...AXIS_PROPS} width={width} fontSize={12} tickFormatter={money.tick} />
        <ChartTooltip content={<MoneyChartTooltip config={config} />} />
        <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-1" />} />
        {sources.map((s) => (
          <Bar key={s} dataKey={s} stackId="income" fill={`var(--color-${s})`} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
