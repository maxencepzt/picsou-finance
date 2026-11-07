import { useTranslation } from 'react-i18next'
import type { PortfolioLine } from '@/features/accounts/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SLICE_PALETTE } from '@/lib/chart-palette'
import { formatPercent } from '@/lib/utils'
import { concentration, currencySplit } from './investments'

/** How much rests on the largest lines, and in which currencies the portfolio is quoted. */
export function ConcentrationCard({ lines }: { lines: PortfolioLine[] }) {
  const { t } = useTranslation()
  const top = concentration(lines)
  const currencies = currencySplit(lines)
  if (!top) return null
  const color = (i: number) => SLICE_PALETTE[i % SLICE_PALETTE.length]

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('investments.concentration.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 rounded-xl bg-muted p-3">
          <span className="text-[13px] font-medium text-muted-foreground">{t('investments.concentration.top', { count: top.topCount })}</span>
          <span className="text-[22px] leading-tight font-semibold tabular-nums">{formatPercent(top.topShare)}</span>
          <span className="text-xs text-muted-foreground">
            {t('investments.concentration.largest', {
              name: top.largest.nameKey ? t(top.largest.nameKey) : top.largest.name,
              share: formatPercent(top.largestShare),
            })}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted-foreground">{t('export.sheet.quoteCurrency')}</span>
          <div
            role="img"
            aria-label={currencies.map((c) => `${c.currency} ${formatPercent(c.share)}`).join(', ')}
            className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
          >
            {currencies.map((c, i) => <span key={c.currency} style={{ width: `${c.share}%`, backgroundColor: color(i) }} />)}
          </div>
          <ul className="flex flex-col gap-1.5">
            {currencies.map((c, i) => (
              <li key={c.currency} className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: color(i) }} aria-hidden="true" />
                  {c.currency}
                </span>
                <span className="font-semibold tabular-nums">{formatPercent(c.share)}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
