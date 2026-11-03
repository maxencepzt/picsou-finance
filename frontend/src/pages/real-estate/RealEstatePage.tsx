import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Building2, Landmark, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Delta } from '@/components/shared/Delta'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { KpiTile } from '@/components/shared/KpiTile'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { AddPropertyModal } from '@/components/property/AddPropertyModal'
import { useAccounts, useRealEstateSummary } from '@/features/accounts/hooks'
import { useDashboard } from '@/features/dashboard/hooks'
import { useMemberProfile } from '@/features/profile/hooks'
import { useMoney } from '@/hooks/use-money'
import { formatLocalDate, formatPercent } from '@/lib/utils'
import type { Account, DashboardLiability, ScpiPaperLine } from '@/types/api'
import { DebtToIncomeCard } from './DebtToIncomeCard'
import { Figure } from './Figure'
import { LoanCard } from './LoanCard'
import { PropertyCard } from './PropertyCard'

export function RealEstatePage() {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const summary = useRealEstateSummary()
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts()
  const { data: dashboard } = useDashboard()
  const profile = useMemberProfile()

  if (summary.isLoading || accountsLoading) return <LoadingSkeleton />
  if (summary.isError || !summary.data) return <ErrorState onRetry={() => void summary.refetch()} />

  const re = summary.data
  const { properties, paper } = re
  const accountsById = new Map(accounts.map((a) => [a.id, a]))
  const loans = accounts.filter((a) => a.type === 'LOAN' && !a.hidden)
  const cards = (dashboard?.liabilities ?? []).filter(
    (l) => l.accountType === 'CREDIT_CARD' && (l.paymentDueAmountEur != null || l.paymentDueDate),
  )
  const hasAssets = properties.length + paper.length > 0

  // Bricks and SCPI shares together: the backend keeps them apart, the page reads them as one.
  const gross = re.grossValue + re.paperGross
  const debt = re.outstandingDebt + re.paperDebt
  const net = re.netValue + re.paperNet
  const linkedLoans = new Set([...properties, ...paper].flatMap((p) => p.loans.map((l) => l.accountId))).size
  const netWorth = dashboard?.totalNetWorth ?? 0
  const monthlyPayments = dashboard?.totalMonthlyPayment
  const showDti = loans.length > 0 && monthlyPayments != null && !profile.isLoading

  const addButton = (
    <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
      <Plus aria-hidden="true" />
      {t('property.add.action')}
    </Button>
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('nav.realEstate')} actions={addButton} />

      {hasAssets && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiTile
            label={t('realEstatePage.kpi.gross')}
            value={<CurrencyDisplay value={gross} />}
            footer={[
              t('realEstatePage.kpi.propertyCount', { count: properties.length }),
              paper.length > 0 ? t('realEstatePage.kpi.scpiCount', { count: paper.length }) : null,
            ].filter(Boolean).join(' · ')}
          />
          <KpiTile
            label={t('realEstatePage.kpi.debt')}
            value={<CurrencyDisplay value={debt} />}
            footer={t('realEstatePage.kpi.loanCount', { count: linkedLoans })}
          />
          <KpiTile
            label={t('realEstatePage.kpi.net')}
            value={<CurrencyDisplay value={net} />}
            footer={netWorth > 0
              ? t('realEstatePage.kpi.netWorthShare', { pct: formatPercent((net / netWorth) * 100, { fractionDigits: 0 }) })
              : undefined}
          />
          <KpiTile
            label={t('realEstatePage.kpi.gain')}
            value={<CurrencyDisplay value={re.unrealizedGain} showSign />}
            footer={re.unrealizedGainPercent != null
              ? <Delta percent={re.unrealizedGainPercent}>{t('realEstatePage.kpi.sincePurchase')}</Delta>
              : undefined}
          />
          <KpiTile
            label={t('realEstatePage.kpi.loanToValue')}
            value={gross > 0 ? formatPercent((debt / gross) * 100) : '—'}
            footer={t('realEstatePage.kpi.loanToValueHint')}
          />
          <KpiTile
            label={t('realEstatePage.kpi.rent')}
            value={<CurrencyDisplay value={re.monthlyRentalIncome} />}
            footer={t('realEstatePage.kpi.rentHint')}
          />
        </div>
      )}

      {hasAssets ? (
        <div className="flex flex-wrap gap-4">
          {properties.length > 0 && (
            <div className="flex min-w-0 flex-[7_1_520px] flex-col gap-4">
              {properties.map((line) => (
                <PropertyCard key={line.accountId} line={line} account={accountsById.get(line.accountId)} />
              ))}
            </div>
          )}
          {paper.length > 0 && (
            <div className="min-w-0 flex-[5_1_340px]">
              <ScpiCard paper={paper} accountsById={accountsById} />
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent>
            <EmptyState
              className="py-8"
              icon={<Building2 className="size-12" />}
              title={t('realEstatePage.empty.properties')}
              description={t('realEstatePage.empty.propertiesHint')}
              action={{ label: t('property.add.action'), onClick: () => setAdding(true) }}
            />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-0 flex-[7_1_520px] flex-col gap-4">
          {loans.length > 0 ? (
            loans.map((account) => <LoanCard key={account.id} account={account} />)
          ) : (
            <Card>
              <CardContent>
                <EmptyState
                  className="py-8"
                  icon={<Landmark className="size-12" />}
                  title={t('dashboard.kpi.noLoan')}
                  description={t('realEstatePage.empty.loansHint')}
                />
              </CardContent>
            </Card>
          )}
        </div>
        {(showDti || cards.length > 0) && (
          <div className="flex min-w-0 flex-[5_1_340px] flex-col gap-4">
            {/* The bank's definition: payments over net pay before income tax, not after withholding. */}
            {showDti && (
              <DebtToIncomeCard monthlyPayments={monthlyPayments} monthlyIncome={profile.data?.monthlyNetBeforeTax} />
            )}
            {cards.length > 0 && <CardStatementsCard cards={cards} />}
          </div>
        )}
      </div>

      {adding && <AddPropertyModal open onOpenChange={setAdding} />}
    </div>
  )
}

/** SCPI shares: how many, what they cost at subscription, what they would fetch, what they pay. */
function ScpiCard({ paper, accountsById }: { paper: ScpiPaperLine[]; accountsById: Map<number, Account> }) {
  const { t } = useTranslation()
  const money = useMoney()

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('scpi.summary.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {paper.map((line) => {
          // Money figures weighted by the member's share, like the withdrawal value beside them.
          const share = line.sharePercent / 100
          const position = accountsById.get(line.accountId)?.scpi
          const perShare = position?.annualDistributionPerShareEur
          const frequency = position?.distributionFrequency
          return (
            <div key={line.accountId} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <Link to={`/accounts/${line.accountId}`} className="text-sm font-semibold hover:text-primary">{line.name}</Link>
                {line.managementCompany && <p className="text-[13px] text-muted-foreground">{line.managementCompany}</p>}
              </div>
              <dl className="grid grid-cols-2 gap-4">
                {line.shareCount != null && (
                  <Figure label={t('scpi.shareCount')}>{money.quantity(line.shareCount)}</Figure>
                )}
                {line.shareCount != null && line.subscriptionPriceEur != null && (
                  <Figure label={t('realEstatePage.scpi.subscriptionValue')}>
                    <CurrencyDisplay value={line.shareCount * line.subscriptionPriceEur * share} />
                  </Figure>
                )}
                <Figure label={t('scpi.withdrawalValue')} strong>
                  <CurrencyDisplay value={line.grossValue} />
                </Figure>
                <Figure label={t('realEstatePage.scpi.distribution')}>
                  {perShare != null && line.shareCount != null ? (
                    <>
                      <CurrencyDisplay value={perShare * line.shareCount * share} />
                      {t('realEstatePage.perYearSuffix')}
                      {frequency && (
                        <span className="block text-[13px] font-normal text-muted-foreground">
                          {t(frequency === 'MONTHLY' ? 'scpi.frequencyMonthly' : 'scpi.frequencyQuarterly')}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">{t('scpi.frequencyNone')}</span>
                  )}
                </Figure>
              </dl>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

/** Deferred-debit cards with a known statement: how much, and when it leaves the account. */
function CardStatementsCard({ cards }: { cards: DashboardLiability[] }) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('realEstatePage.cards.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {cards.map((card) => (
          <div key={card.accountId} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{card.name}</p>
              {card.paymentDueDate && (
                <p className="text-[13px] text-muted-foreground">
                  {t('dashboard.dueOn', { date: formatLocalDate(card.paymentDueDate) })}
                </p>
              )}
            </div>
            {card.paymentDueAmountEur != null && (
              <CurrencyDisplay value={card.paymentDueAmountEur} className="shrink-0 text-sm font-semibold tabular-nums" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
