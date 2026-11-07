import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { cn, formatPercent, localeFromLanguage } from '@/lib/utils'
import type { RealEstatePropertyLine } from '@/types/api'

interface PropertyFinancingCardProps {
  line: RealEstatePropertyLine
}

/**
 * The mortgages attached to a property, and the equity left once they are paid.
 *
 * <p>Each loan is weighted by the member's share of <em>that loan</em>, which need not match
 * their share of the property — one partner can own more of the house while the mortgage is
 * split evenly.
 */
export function PropertyFinancingCard({ line }: PropertyFinancingCardProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)

  if (line.loans.length === 0) return null

  const ltv = line.grossValue > 0 ? (line.outstandingDebt / line.grossValue) * 100 : 0
  const equityPct = Math.max(0, Math.min(100, 100 - ltv))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('property.financing.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Stat label={t('property.financing.gross')} value={<CurrencyDisplay value={line.grossValue} />} />
          <Stat label={t('property.financing.debt')} value={<CurrencyDisplay value={line.outstandingDebt} />} />
          <Stat
            label={t('property.financing.net')}
            value={<CurrencyDisplay value={line.netValue} />}
            className={line.netValue < 0 ? 'text-loss' : ''}
          />
        </dl>

        <div className="space-y-2">
          {/* The owned share of the property. */}
          <div
            role="progressbar"
            aria-valuenow={Math.round(equityPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('property.financing.net')}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-chart-1" style={{ width: `${equityPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('property.financing.equityShare', { pct: formatPercent(equityPct, { fractionDigits: 0 }, locale) })}
          </p>
        </div>

        <ul className="-mx-2 space-y-1 border-t pt-3">
          {line.loans.map(loan => (
            <li key={loan.accountId}>
              <button
                type="button"
                onClick={() => navigate(`/accounts/${loan.accountId}`)}
                className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{loan.name}</span>
                  {loan.lenderName && (
                    <span className="block truncate text-xs text-muted-foreground">{loan.lenderName}</span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <CurrencyDisplay value={loan.outstandingBalance} className="text-sm font-semibold tabular-nums" />
                  {loan.endDate && (
                    <span className="block text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' })
                        .format(new Date(loan.endDate))}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, className = '' }: {
  label: string; value: React.ReactNode; className?: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[13px] font-medium text-muted-foreground">{label}</dt>
      <dd className={cn('truncate text-sm font-semibold tabular-nums text-foreground', className)}>{value}</dd>
    </div>
  )
}
