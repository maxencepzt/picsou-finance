import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { AXIS_PROPS } from '@/lib/chart-axis'
import { formatPercent } from '@/lib/utils'
import type { CashflowBucket } from '@/types/api'
import { savingsRateTrend } from './savings-rate'

/** The savings rate of each cycle of the series, with its average dashed. */
export function SavingsRateCard({ series }: { series: CashflowBucket[] }) {
  const { t } = useTranslation()
  const { points, average } = savingsRateTrend(series)
  const chartConfig = { rate: { label: t('dashboard.kpi.savingsRate'), color: 'var(--chart-1)' } } satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.kpi.savingsRate')}</CardTitle>
        <CardDescription>{t('budget.overview.savingsRateHint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {points.every((p) => p.rate == null) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('budget.cashflow.empty')}</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <LineChart data={points} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" {...AXIS_PROPS} fontSize={12} />
              {/* No YAxis: money-guard requires money.tick on every one; the tooltip and the
                  caption carry the figures, the 0 % line keeps a negative cycle readable. */}
              <ReferenceLine y={0} stroke="var(--border)" />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <>
                        <span className="text-muted-foreground">{t('dashboard.kpi.savingsRate')}</span>
                        <span className="ml-auto font-medium tabular-nums text-foreground">
                          {formatPercent(Number(value))}
                        </span>
                      </>
                    )}
                  />
                }
              />
              {average != null && (
                <ReferenceLine y={average} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
              )}
              <Line dataKey="rate" type="monotone" stroke="var(--color-rate)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>
        )}
        {average != null && (
          <span className="text-xs text-muted-foreground">
            {t('budget.overview.savingsRateAverage', { rate: formatPercent(average) })}
          </span>
        )}
      </CardContent>
    </Card>
  )
}
