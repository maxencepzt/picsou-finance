import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { LIQUIDITY_COLOR, LIQUIDITY_ORDER, liquidityOf, sumBy } from '@/lib/asset-classes'
import { formatPercent } from '@/lib/utils'
import type { DashboardData } from '@/types/api'

/** How much of the gross assets is available now, on a market, locked in a wrapper, or illiquid. */
export function LiquidityCard({ distribution }: { distribution: DashboardData['distribution'] }) {
  const { t } = useTranslation()
  const buckets = sumBy(distribution.map((d) => ({ type: d.accountType, amount: d.balanceEur })), liquidityOf, LIQUIDITY_ORDER)
  const total = buckets.reduce((sum, b) => sum + b.amount, 0)
  if (total <= 0) return null
  const share = (amount: number) => (amount / total) * 100

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('dashboard.liquidity.title')}</CardTitle>
        <CardDescription>{t('dashboard.liquidity.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          role="img"
          aria-label={buckets.map((b) => `${t(`dashboard.liquidity.${b.key}`)} ${formatPercent(share(b.amount))}`).join(', ')}
          className="flex h-3.5 gap-0.5 overflow-hidden rounded-full"
        >
          {buckets.map((b) => (
            <span key={b.key} style={{ width: `${share(b.amount)}%`, backgroundColor: LIQUIDITY_COLOR[b.key] }} />
          ))}
        </div>
        <ul className="flex flex-col gap-2">
          {buckets.map((b) => (
            <li key={b.key} className="grid grid-cols-[10px_1fr_auto_3.5rem] items-center gap-2 text-sm">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: LIQUIDITY_COLOR[b.key] }} aria-hidden="true" />
              <span className="min-w-0 truncate">
                {t(`dashboard.liquidity.${b.key}`)}
                <span className="text-muted-foreground"> · {t(`dashboard.liquidity.${b.key}Hint`)}</span>
              </span>
              <CurrencyDisplay value={b.amount} className="font-semibold tabular-nums text-foreground" />
              <span className="text-right tabular-nums text-muted-foreground">{formatPercent(share(b.amount))}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
