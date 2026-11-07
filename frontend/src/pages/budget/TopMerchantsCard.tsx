import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { ErrorState } from '@/components/shared/ErrorState'
import { MerchantAvatar } from '@/components/shared/MerchantAvatar'
import { useSpendingByMerchant } from '@/features/budget/hooks'
import { formatPercent } from '@/lib/utils'

const SHOWN = 6

function ShareBar({ share, label }: { share: number; label: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} aria-valuetext={formatPercent(share, { fractionDigits: 0 })}>
      <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.min(share, 100)}%` }} />
    </div>
  )
}

/** The cycle's largest merchants by spend, the rest of the cycle's spend on one line. */
export function TopMerchantsCard({ anchor }: { anchor?: string }) {
  const { t } = useTranslation()
  const merchantsQ = useSpendingByMerchant('CYCLE', anchor, SHOWN)
  const data = merchantsQ.data
  // `total` covers every expense of the window, listed or not.
  const rest = data ? data.total - data.merchants.reduce((sum, m) => sum + m.amount, 0) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('budget.overview.merchants.title')}</CardTitle>
        {data && data.merchants.length > 0 && (
          <CardDescription>
            {t('common.labelColon', { label: t('budget.overview.merchants.total') })} <CurrencyDisplay value={data.total} />
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {merchantsQ.isLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : merchantsQ.isError ? (
          <ErrorState messageOnly message={t('budget.overview.merchants.error')} onRetry={() => void merchantsQ.refetch()} />
        ) : !data || data.merchants.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('budget.overview.merchants.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.merchants.map((m) => (
              <li key={m.key} className="flex items-center gap-3">
                <MerchantAvatar label={m.label} logoUrl={m.logoUrl} size="md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-baseline gap-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-semibold">{m.label}</span>
                      <span className="text-xs text-muted-foreground"> · {t('budget.overview.merchants.count', { count: m.count })}</span>
                    </span>
                    <CurrencyDisplay value={m.amount} className="shrink-0 font-semibold tabular-nums text-foreground" />
                  </div>
                  <div className="flex items-center gap-2">
                    <ShareBar share={m.share} label={m.label} />
                    <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                      {formatPercent(m.share, { fractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </li>
            ))}
            {rest > 0.005 && (
              <li className="flex items-center justify-between gap-3 border-t border-border pt-3 text-[13px]">
                <span className="text-muted-foreground">{t('budget.overview.merchants.others')}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <CurrencyDisplay value={rest} className="font-semibold tabular-nums text-foreground" />
                  <span className="text-xs text-muted-foreground tabular-nums">{formatPercent((rest / data.total) * 100, { fractionDigits: 0 })}</span>
                </span>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
