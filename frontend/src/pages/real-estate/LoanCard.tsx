import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { LoanAmortizationChart } from '@/components/loan/LoanAmortizationChart'
import { useLoanSummary } from '@/features/accounts/hooks'
import { formatPercent, localeFromLanguage } from '@/lib/utils'
import type { Account } from '@/types/api'
import { EMBEDDED_CARD, loanInterest, monthYear } from './real-estate'
import { Figure } from './Figure'

/** One loan: what is left to repay, at what monthly cost, and the interest still ahead. */
export function LoanCard({ account }: { account: Account }) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const debt = account.debt
  // Without its terms a loan has no schedule: the endpoint answers 404, so do not ask.
  const { data, isLoading } = useLoanSummary(account.id, debt != null)

  const meta = [
    debt?.lenderName ?? account.provider,
    debt?.interestRate != null ? formatPercent(debt.interestRate * 100, { fractionDigits: 2 }) : null,
    debt?.startDate && debt.endDate ? `${monthYear(debt.startDate, locale)} → ${monthYear(debt.endDate, locale)}` : null,
  ].filter(Boolean).join(' · ')

  const interest = data ? loanInterest(data.schedule, data.summary.paidInstallments) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link to={`/accounts/${account.id}`} className="hover:text-primary">{account.name}</Link>
        </CardTitle>
        {meta && <CardDescription>{meta}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : data && interest ? (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Figure label={t('debt.remainingBalance')} strong><CurrencyDisplay value={data.summary.remainingBalance} /></Figure>
              <Figure label={t('debt.monthlyPayment')}><CurrencyDisplay value={data.summary.monthlyPayment} /></Figure>
              <Figure label={t('debt.repaid')}>
                {formatPercent(data.summary.capitalRepaidPct)}
                <span className="text-[13px] font-normal text-muted-foreground">
                  {' · '}{data.summary.paidInstallments} / {data.summary.totalInstallments}
                </span>
              </Figure>
              <Figure label={t('realEstatePage.loan.totalInterest')}><CurrencyDisplay value={interest.total} /></Figure>
              <Figure label={t('realEstatePage.loan.remainingInterest')}><CurrencyDisplay value={interest.remaining} /></Figure>
            </dl>
            <div className={EMBEDDED_CARD}>
              <LoanAmortizationChart schedule={data.schedule} />
            </div>
          </>
        ) : (
          <>
            <dl>
              <Figure label={t('debt.remainingBalance')} strong><CurrencyDisplay value={Math.abs(account.currentBalanceEur)} /></Figure>
            </dl>
            <p className="text-[13px] text-muted-foreground">{t('dashboard.loanParamsUnconfigured')}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
