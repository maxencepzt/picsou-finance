import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useMoney } from '@/hooks/use-money'
import { cn, formatPercent } from '@/lib/utils'
import { DEBT_TO_INCOME_THRESHOLD, debtToIncome } from './real-estate'

/** Monthly loan payments against declared net income, read against the lenders' 35 % cap. */
export function DebtToIncomeCard({ monthlyPayments, monthlyIncome }: { monthlyPayments: number; monthlyIncome: number | null | undefined }) {
  const { t } = useTranslation()
  const money = useMoney()
  const dti = debtToIncome(monthlyPayments, monthlyIncome)
  const threshold = formatPercent(DEBT_TO_INCOME_THRESHOLD, { fractionDigits: 0 })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('realEstatePage.dti.title')}</CardTitle>
        {dti && (
          <CardAction>
            <Badge variant="secondary" className={cn(dti.over && 'bg-warning/10 text-warning')}>
              {t(dti.over ? 'realEstatePage.dti.over' : 'realEstatePage.dti.under', { pct: threshold })}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!dti || monthlyIncome == null ? (
          <>
            <p className="text-sm text-muted-foreground">{t('realEstatePage.dti.needsIncome')}</p>
            <Link to="/settings" className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline">
              {t('goals.savingsRate.goToSettings')}
            </Link>
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl leading-none font-bold tabular-nums">{formatPercent(dti.percent)}</span>
              <span className="text-[13px] text-muted-foreground">{t('realEstatePage.dti.ofIncome')}</span>
            </div>
            <div className="relative py-1">
              <Progress
                value={dti.fill}
                aria-label={t('realEstatePage.dti.title')}
                className={cn('h-2.5', dti.over && '[&_[data-slot=progress-indicator]]:bg-warning')}
              />
              <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground" style={{ left: `${dti.mark}%` }} aria-hidden="true" />
            </div>
            <div className="relative h-4 text-xs text-muted-foreground">
              <span className="absolute left-0">{formatPercent(0, { fractionDigits: 0 })}</span>
              <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${dti.mark}%` }}>
                {t('realEstatePage.dti.threshold', { pct: threshold })}
              </span>
              <span className="absolute right-0">{formatPercent(dti.scale, { fractionDigits: 0 })}</span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              {t('realEstatePage.dti.detail', { payments: money.amount(monthlyPayments), income: money.amount(monthlyIncome) })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
