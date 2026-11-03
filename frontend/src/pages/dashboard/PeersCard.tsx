import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { ErrorState } from '@/components/shared/ErrorState'
import { useMemberProfile } from '@/features/profile/hooks'
import { useMoney } from '@/hooks/use-money'
import { AMOUNT_MASK } from '@/lib/money'
import { formatDecimal } from '@/lib/utils'
import { INSEE_WEALTH_SOURCE_URL, MEDIAN_GROSS_WEALTH, ageBracket } from './peers'

/**
 * The gross worth of this view against the INSEE median gross wealth of households whose
 * reference person is the member's age (Insee Focus n° 371, figure 3a, early 2024; see `peers.ts`).
 * A ratio and a gap only: with medians alone, a percentile would be invented.
 */
export function PeersCard({ grossWorth }: { grossWorth: number }) {
  const { t } = useTranslation()
  const money = useMoney()
  const { data: profile, isLoading, isError, refetch } = useMemberProfile()
  // `age` is derived server-side from the birth date; the API omits it when no birth date is set.
  const bracket = ageBracket(profile?.age)
  const median = MEDIAN_GROSS_WEALTH[bracket]

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('dashboard.peers.title')}</CardTitle>
        {!isLoading && !isError && <CardDescription>{t(`dashboard.peers.bracket.${bracket}`)}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : isError ? (
          <ErrorState messageOnly message={t('dashboard.peers.error')} onRetry={() => void refetch()} />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              {/* Masked with the amounts: the median is public, so the ratio would give the worth away. */}
              <span className="text-4xl leading-none font-bold tabular-nums">
                {money.hidden ? AMOUNT_MASK : `${formatDecimal(grossWorth / median, 1)} ×`}
              </span>
              <span className="text-sm font-medium text-muted-foreground">{t('dashboard.peers.ofMedian')}</span>
            </div>
            <dl className="flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('dashboard.peers.yours')}</dt>
                <dd><CurrencyDisplay value={grossWorth} className="font-semibold tabular-nums text-foreground" /></dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('dashboard.peers.median')}</dt>
                <dd><CurrencyDisplay value={median} className="font-semibold tabular-nums text-foreground" /></dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('dashboard.peers.gap')}</dt>
                <dd><CurrencyDisplay value={grossWorth - median} showSign className="font-semibold tabular-nums text-foreground" /></dd>
              </div>
            </dl>
            {bracket === 'all' && (
              <p className="text-xs text-muted-foreground">
                {t('dashboard.peers.noAge')}{' '}
                <Link to="/settings" className="font-medium text-primary hover:text-foreground">{t('dashboard.peers.fillProfile')}</Link>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {t('dashboard.peers.caveat')}{' '}
              {t('common.labelColon', { label: t('dashboard.peers.sourceLabel') })}{' '}
              <a href={INSEE_WEALTH_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:text-foreground">
                {t('dashboard.peers.source')}
              </a>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
