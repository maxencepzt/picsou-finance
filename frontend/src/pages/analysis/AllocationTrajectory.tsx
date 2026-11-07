import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useProjectionDateLabel } from '@/features/analysis/hooks'
import { formatPercent } from '@/lib/utils'
import type { AllocationPoint, WealthTier } from '@/types/api'
import { AXIS_PROPS, AXIS_PROPS_FLUSH } from '@/lib/chart-axis'
import { TIER_COLORS } from './tier-colors'

/** Bottom to top, heaviest first — the order the pyramid itself reads in. */
const TIER_ORDER: WealthTier[] = [
  'SAFETY_NET',
  'REAL_ESTATE',
  'EQUITY',
  'CRYPTO',
  'ALTERNATIVE',
]

/**
 * Where the recurring plans take the mix, against the member's own targets.
 *
 * <p>The wealth curve answers "how much"; the pyramid answers "in what, today". Neither could say
 * whether the plans close the gap or widen it, because one has no notion of time and the other
 * has no notion of allocation. This is the join.
 *
 * <p>Shares rather than euros: a stacked euro chart is dominated by whichever tier is already
 * largest, which is exactly the tier a member is trying to see past.
 */
export function AllocationTrajectory({ allocation }: { allocation: AllocationPoint[] }) {
  const { t } = useTranslation()
  // Above the early return: hooks must run unconditionally.
  const dateLabel = useProjectionDateLabel()
  if (allocation.length === 0) return null

  const config = Object.fromEntries(
    TIER_ORDER.map((tier) => [
      tier,
      { label: t(`analysis.tiers.${tier}`), color: TIER_COLORS[tier] },
    ]),
  ) as ChartConfig

  const rows = allocation.map((point) => {
    const row: Record<string, string | number> = { date: point.date }
    for (const share of point.tiers) row[share.tier] = share.percent
    return row
  })

  const last = allocation[allocation.length - 1]
  const first = allocation[0]

  return (
    <>
      <ChartContainer config={config} className="h-[300px] w-full">
        <AreaChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            {...AXIS_PROPS}
            tickFormatter={(value: string) => value.slice(0, 4)}
          />
          <YAxis
            {...AXIS_PROPS_FLUSH}
            width={44}
            domain={[0, 100]}
            tickFormatter={(value: number) => formatPercent(value, { fractionDigits: 0 })}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(value) => dateLabel(String(value))}
              />
            }
          />
          {TIER_ORDER.map((tier) => (
            <Area
              key={tier}
              type="monotone"
              dataKey={tier}
              stackId="mix"
              stroke={`var(--color-${tier})`}
              fill={`var(--color-${tier})`}
              fillOpacity={0.55}
              strokeWidth={1}
              dot={false}
            />
          ))}
        </AreaChart>
      </ChartContainer>

      {/* The numbers the chart is too coarse to read: where each tier lands, and how far that is
          from the target. A share on a stacked area is legible to within a few points at best. */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-[13px]">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="pb-2 text-left font-medium">{t('analysis.projection.tier')}</th>
              <th scope="col" className="pb-2 text-right font-medium">{t('analysis.projection.today')}</th>
              <th scope="col" className="pb-2 text-right font-medium">
                {t('analysis.projection.atHorizon', { count: allocation.length - 1 })}
              </th>
              <th scope="col" className="pb-2 text-right font-medium">{t('analysis.projection.target')}</th>
            </tr>
          </thead>
          <tbody>
            {TIER_ORDER.map((tier) => {
              const now = first.tiers.find((s) => s.tier === tier)
              const then = last.tiers.find((s) => s.tier === tier)
              if (!now || !then) return null
              return (
                <tr key={tier} className="border-t border-border">
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: TIER_COLORS[tier] }}
                        aria-hidden="true"
                      />
                      {t(`analysis.tiers.${tier}`)}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {formatPercent(now.percent)}
                  </td>
                  <td className="py-2 text-right tabular-nums font-semibold">
                    {formatPercent(then.percent)}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      <CurrencyDisplay value={then.valueEur} />
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {/* The cushion is measured in euros against an absolute target, not as a share,
                        so it has no percentage to compare against.

                        Loose equality, and it is not a style choice: the API omits null fields
                        entirely (spring.jackson default-property-inclusion: non_null), so this
                        arrives as undefined and `=== null` was false — .toFixed then threw and took
                        the whole tab down. Demo mode sends an explicit null, which is why the
                        fixtures were happy. */}
                    {then.targetPercent == null ? '—' : formatPercent(then.targetPercent, { fractionDigits: 0 })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
