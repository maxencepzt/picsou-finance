import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMoney } from '@/hooks/use-money'
import { Breakdown } from '@/components/shared/Breakdown'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Delta } from '@/components/shared/Delta'
import { ScrollStrip } from '@/components/shared/ScrollStrip'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { assetClassColor, assetClassOf } from '@/lib/asset-classes'
import { cn } from '@/lib/utils'
import { realizedInYear, type RealizedSource } from './investments'

interface RealizedGainsCardProps {
  sources: RealizedSource[]
  /** Years with a sale, oldest first; the card is not rendered without one. */
  years: number[]
  currentYear: number
  className?: string
}

/** Where the year's realised gains came from, by position; losses are listed apart, under the chart. */
export function RealizedGainsCard({ sources, years, currentYear, className }: RealizedGainsCardProps) {
  const { t } = useTranslation()
  const money = useMoney()
  // Unset until the reader picks one, so data arriving later still lands on the right default.
  const [picked, setPicked] = useState<number | null>(null)
  const year = picked != null && years.includes(picked) ? picked : years.includes(currentYear) ? currentYear : years[years.length - 1]
  const result = realizedInYear(sources, year)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t('realized.title')}</CardTitle>
        <CardDescription>{t('investments.realized.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {years.length > 1 && (
          <ScrollStrip activeKey={String(year)}>
            <SegmentedControl
              ariaLabel={t('investments.realized.year')}
              value={String(year)}
              onChange={(value) => setPicked(Number(value))}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
            />
          </ScrollStrip>
        )}
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-muted-foreground">{t('investments.realized.net', { year })}</span>
          <CurrencyDisplay
            value={result.net}
            showSign
            className={cn('text-[28px] leading-tight font-semibold tabular-nums', result.net > 0 ? 'text-gain' : result.net < 0 ? 'text-loss' : '')}
          />
          <span className="text-xs text-muted-foreground">
            {t('investments.realized.summary', {
              count: result.sales,
              gains: money.amount(result.gainTotal),
              losses: money.amount(-result.lossTotal),
            })}
          </span>
        </div>
        {result.gains.length > 0
          ? (
            <Breakdown
              key={year}
              defaultView="bar"
              centerLabel={t('investments.realized.gains')}
              ariaLabel={t('investments.realized.gains')}
              items={result.gains.map((p) => ({
                key: p.key,
                label: p.name,
                hint: p.accountName,
                amount: p.amount,
                color: assetClassColor(assetClassOf(p.accountType) ?? 'other'),
              }))}
            />
          )
          : <p className="text-sm text-muted-foreground">{t('investments.realized.noGains')}</p>}
        {result.losses.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <span className="text-[13px] font-medium text-muted-foreground">{t('investments.realized.losses')}</span>
            <ul className="flex flex-col gap-2">
              {result.losses.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {p.name}
                    <span className="text-muted-foreground"> · {p.accountName}</span>
                  </span>
                  <Delta amount={p.amount} className="text-sm" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
