import { useTranslation } from 'react-i18next'
import { formatPercent, localeFromLanguage } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import type { LoanSummary } from '@/types/api'

interface LoanProgressCardProps {
  summary: LoanSummary
  className?: string
}

/** How far the loan is repaid, then what one monthly payment is made of. */
export function LoanProgressCard({ summary, className }: LoanProgressCardProps) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)

  const pct = Math.max(0, Math.min(100, summary.capitalRepaidPct))
  // Ordered parts of one payment, drawn on the chart ramp (data, not chrome).
  const parts = [
    { label: t('debt.capital'), value: summary.monthlyCapital, color: 'bg-chart-1' },
    { label: t('debt.interest'), value: summary.monthlyInterest, color: 'bg-chart-4' },
    { label: t('debt.insurance'), value: summary.monthlyInsurance, color: 'bg-chart-5' },
  ]
  const partsTotal = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t('debt.loanProgress')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('debt.repaid')}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-chart-1" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('debt.capitalRepaidPct', { pct: formatPercent(pct, { fractionDigits: 0 }, locale) })}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-0.5">
            <dt className="text-[13px] font-medium text-muted-foreground">{t('debt.paidInstallments')}</dt>
            <dd className="text-lg font-semibold tabular-nums">{summary.paidInstallments}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[13px] font-medium text-muted-foreground">{t('debt.remainingInstallments')}</dt>
            <dd className="text-lg font-semibold tabular-nums">{summary.remainingInstallments}</dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-col gap-3 border-t pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium text-muted-foreground">{t('debt.monthlyBreakdown')}</span>
            <CurrencyDisplay value={summary.monthlyPayment} className="text-sm font-semibold tabular-nums" />
          </div>
          {partsTotal > 0 && (
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {parts.filter((part) => part.value > 0).map((part) => (
                <span key={part.label} className={part.color} style={{ width: `${(part.value / partsTotal) * 100}%` }} />
              ))}
            </div>
          )}
          <ul className="flex flex-col gap-1.5">
            {parts.map((part) => (
              <li key={part.label} className="flex items-center gap-2 text-[13px]">
                <span className={`size-2 shrink-0 rounded-full ${part.color}`} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{part.label}</span>
                <CurrencyDisplay value={part.value} className="font-medium tabular-nums" />
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
