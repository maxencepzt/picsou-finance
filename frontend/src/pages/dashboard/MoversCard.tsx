import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Delta } from '@/components/shared/Delta'
import { ErrorState } from '@/components/shared/ErrorState'
import { HoldingLogo } from '@/components/shared/HoldingLogo'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { useMovers } from '@/features/dashboard/hooks'
import { formatShortDate, localeFromLanguage } from '@/lib/utils'

type Side = 'gainers' | 'losers'

/** The biggest day-over-day moves among held securities, from their two latest price days. */
export function MoversCard() {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const { data, isLoading, isError, refetch } = useMovers(5)
  const [picked, setPicked] = useState<Side | null>(null)

  const hasMoves = !!data?.previousDate && (data.gainers.length > 0 || data.losers.length > 0)
  // Until the user picks a side, open on the one that has something to show.
  const side: Side = picked ?? (data && data.gainers.length === 0 ? 'losers' : 'gainers')
  const rows = data?.[side] ?? []

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('dashboard.movers.title')}</CardTitle>
        {hasMoves && (
          <>
            {/* Narrow card: the switch stays beside the title and the description takes the full width under them. */}
            <CardDescription className="col-span-2 @md/card-header:col-span-1">
              {t('dashboard.movers.versus', { date: formatShortDate(data.date, locale), previous: formatShortDate(data.previousDate, locale) })}
            </CardDescription>
            <CardAction className="row-end-2 @md/card-header:row-end-3">
              <SegmentedControl
                ariaLabel={t('dashboard.movers.side')}
                value={side}
                onChange={setPicked}
                options={[
                  { value: 'gainers', label: t('dashboard.movers.gainers') },
                  { value: 'losers', label: t('dashboard.movers.losers') },
                ]}
              />
            </CardAction>
          </>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : isError ? (
          <ErrorState messageOnly message={t('dashboard.movers.error')} onRetry={() => void refetch()} />
        ) : !hasMoves ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.movers.empty')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(`dashboard.movers.none.${side}`)}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {rows.map((m) => (
              <li key={m.ticker} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2">
                <HoldingLogo logoUrl={m.logoUrl} ticker={m.ticker} name={m.name} className="size-8" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{m.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{m.ticker}</span>
                </span>
                <span className="flex flex-col items-end gap-0.5">
                  <Delta percent={m.changePercent} />
                  <CurrencyDisplay value={m.valueChangeEur} showSign className="text-xs tabular-nums text-foreground" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
