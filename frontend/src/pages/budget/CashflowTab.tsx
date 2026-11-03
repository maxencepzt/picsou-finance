import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from '@/components/ui/chart'
import { MoneyChartTooltip } from '@/components/shared/MoneyChartTooltip'
import { useMoney } from '@/hooks/use-money'
import { MONEY_AXIS_WIDTH } from '@/lib/money'
import type { CashflowBucket } from '@/types/api'
import { AXIS_PROPS } from '@/lib/chart-axis'

/** Income against expenses, one pair of bars per pay cycle of the series. */
export function CashflowTab({ series }: { series: CashflowBucket[] }) {
  const { t } = useTranslation()
  const money = useMoney()
  const chartConfig = {
    income: { label: t('budget.cashflow.income'), color: 'var(--chart-1)' },
    expense: { label: t('budget.cashflow.expense'), color: 'var(--chart-5)' },
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('budget.overview.cashflowTitle')}</CardTitle>
        <CardDescription>{t('budget.cashflow.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        {series.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('budget.cashflow.empty')}</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <BarChart data={series} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" {...AXIS_PROPS} fontSize={12} />
              <YAxis {...AXIS_PROPS} width={MONEY_AXIS_WIDTH} fontSize={12} tickFormatter={money.tick} />
              <ChartTooltip content={<MoneyChartTooltip config={chartConfig} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="income" fill="var(--color-income)" radius={4} />
              <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
