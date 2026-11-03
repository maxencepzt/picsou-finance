import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useFees } from '@/features/analysis/hooks'
import { useMoney } from '@/hooks/use-money'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { formatApiError } from '@/lib/errors'
import { cn, formatPercent } from '@/lib/utils'
import { costliestLines, feeCoverage } from './performance'

const Meta = ({ children }: { children: ReactNode }) => <span className="text-[13px] font-medium text-muted-foreground">{children}</span>

/** What the held funds charge a year, how much of the value that covers, and the broker fees paid over 12 months. */
export function FeesCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const money = useMoney()
  const fees = useFees(12)
  const data = fees.data

  let body
  if (fees.isLoading) {
    body = <Skeleton className="h-[260px] rounded-xl" />
  } else if (fees.isError) {
    body = <ErrorState messageOnly message={formatApiError(fees.error, t)} onRetry={() => void fees.refetch()} />
  } else if (!data?.lines || (data.lines.length === 0 && data.brokerFeesCount === 0)) {
    body = <EmptyState className="py-8" title={t('investments.fees.empty')} />
  } else {
    const coverage = feeCoverage(data)
    const ranking = costliestLines(data.lines)
    body = (
      <>
        <div className="flex flex-col gap-1 rounded-xl bg-muted p-3">
          <Meta>{t('investments.fees.ter')}</Meta>
          {data.weightedTerPercent == null || data.annualCostEur == null
            ? <p className="text-sm text-foreground">{t('investments.fees.unknown')}</p>
            : (
              <>
                <span className="text-[22px] leading-tight font-semibold tabular-nums">
                  {t('investments.fees.perYear', { value: formatPercent(data.weightedTerPercent, { fractionDigits: 2 }) })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('investments.fees.annualCost', { amount: money.amount(data.annualCostEur) })}
                </span>
              </>
            )}
        </div>

        {coverage != null && data.coveredValueEur > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px]">{t('investments.fees.coverage', { share: formatPercent(coverage, { fractionDigits: 0 }) })}</span>
            <Progress value={coverage} className="h-1.5" aria-label={t('investments.fees.coverage', { share: formatPercent(coverage, { fractionDigits: 0 }) })} />
          </div>
        )}

        {ranking.top.length > 0 && (
          <div className="flex flex-col gap-2">
            <Meta>{t('investments.fees.costliest')}</Meta>
            <ul className="flex flex-col gap-2">
              {ranking.top.map((line, i) => (
                <li key={`${line.ticker}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{line.name ?? line.ticker}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t('investments.fees.lineTer', { value: formatPercent(line.terPercent, { fractionDigits: 2 }) })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-semibold tabular-nums">
                    {t('investments.fees.costPerYear', { amount: money.amount(line.costEur) })}
                  </span>
                </li>
              ))}
            </ul>
            {ranking.rest && (
              <p className="text-xs text-muted-foreground">
                {t('investments.fees.rest', { count: ranking.rest.count, amount: money.amount(ranking.rest.costEur) })}
              </p>
            )}
          </div>
        )}

        <div className="flex items-end justify-between gap-3 border-t pt-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Meta>{t('investments.fees.broker')}</Meta>
            <span className="text-xs text-muted-foreground">{t('investments.fees.brokerCount', { count: data.brokerFeesCount })}</span>
          </div>
          <CurrencyDisplay value={data.brokerFeesEur} className="shrink-0 text-lg font-semibold tabular-nums" />
        </div>
      </>
    )
  }

  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader>
        <CardTitle>{t('investments.fees.title')}</CardTitle>
        <CardDescription>{t('investments.fees.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{body}</CardContent>
    </Card>
  )
}
