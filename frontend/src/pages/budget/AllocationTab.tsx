import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PiggyBank } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Breakdown } from '@/components/shared/Breakdown'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { useAllocation } from '@/features/budget/hooks'
import { formatPercent } from '@/lib/utils'
import type { CashflowPeriod } from '@/types/api'
import { BudgetToolbar, ColorDot, PeriodToggle } from './budget-utils'
import { PeriodNavigator } from './PeriodNavigator'
import { ASSET_CLASS_COLOR, ASSET_CLASS_LABEL_KEY } from './budget-meta'
import { useBudgetPeriod } from './BudgetPeriodContext'

/** Where the surplus sits (stock, by asset class) and where this period's savings went (flow, by account). */
export function AllocationTab() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<CashflowPeriod>('CYCLE')
  const { anchor, setAnchor } = useBudgetPeriod()
  const { data, isLoading, isError, refetch } = useAllocation(period, anchor)

  const stockItems = (data?.stock ?? [])
    .filter((s) => s.amount > 0)
    .map((s) => ({
      key: s.assetClass,
      label: t(ASSET_CLASS_LABEL_KEY[s.assetClass]),
      amount: s.amount,
      color: ASSET_CLASS_COLOR[s.assetClass],
    }))

  return (
    <div className="space-y-4">
      <BudgetToolbar lead={t('budget.allocation.subtitle')}>
        <PeriodNavigator
          period={period}
          from={data?.from}
          to={data?.to}
          onAnchorChange={setAnchor}
        />
        <PeriodToggle value={period} onChange={(p) => { setPeriod(p); setAnchor(undefined) }} />
      </BudgetToolbar>

      {isError && <ErrorState message={t('budget.allocation.error')} onRetry={() => refetch()} />}

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      )}

      {data && (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {/* Stock — a part-to-whole, drawn by the app's Breakdown (bar · donut · treemap + legend). */}
          <Card>
            <CardHeader>
              <CardTitle>{t('budget.allocation.stock')}</CardTitle>
            </CardHeader>
            <CardContent>
              {stockItems.length === 0 ? (
                <EmptyState className="py-8" icon={<PiggyBank className="size-8" />}
                  title={t('budget.allocation.noStock')} />
              ) : (
                <Breakdown
                  items={stockItems}
                  centerLabel={t('budget.overview.investable')}
                  ariaLabel={t('budget.allocation.stock')}
                />
              )}
            </CardContent>
          </Card>

          {/* Contributions (flow) */}
          <Card>
            <CardHeader>
              <CardTitle>{t('budget.allocation.contributions')}</CardTitle>
              {data.contributions.length > 0 && (
                <CardDescription>
                  {t('budget.allocation.totalContributed')}{' '}
                  <CurrencyDisplay value={data.totalContributions} className="font-semibold text-foreground" />
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {data.contributions.length === 0 ? (
                <EmptyState className="py-8" icon={<PiggyBank className="size-8" />}
                  title={t('budget.allocation.noContributions')}
                  description={t('budget.allocation.noContributionsHint')} />
              ) : (
                <ul className="flex flex-col gap-3.5">
                  {data.contributions.map((c) => {
                    const pct = data.totalContributions > 0
                      ? (c.amount / data.totalContributions) * 100 : 0
                    const color = c.color || ASSET_CLASS_COLOR[c.assetClass]
                    return (
                      <li key={c.accountId} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline gap-2 text-[13px]">
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <ColorDot color={color} />
                            <span className="truncate font-semibold">{c.accountName}</span>
                          </span>
                          <CurrencyDisplay value={c.amount} className="shrink-0 font-semibold tabular-nums text-foreground" />
                          {/* A share, so it stays legible in privacy mode. */}
                          <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                            {formatPercent(pct, { fractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
