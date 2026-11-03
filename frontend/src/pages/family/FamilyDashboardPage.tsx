import { useTranslation } from 'react-i18next'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAccounts } from '@/features/accounts/hooks'
import { useFamilyDashboard } from '@/features/family/hooks'
import { accountTypeLabelKey } from '@/lib/constants'
import { logoKeyUrl, providerLogoUrl } from '@/lib/provider-logos'
import { cn, deriveMonogram, formatPercent } from '@/lib/utils'
import type { AccountType } from '@/types/api'

/** The household view: what members share, as one figure, a list of accounts and the goals they fund together. */
export function FamilyDashboardPage() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useFamilyDashboard()
  // The shared view carries no provider; the member's own accounts (same ids) lend theirs.
  const { data: ownAccounts = [] } = useAccounts()
  const logoOf = (id: number) => {
    const own = ownAccounts.find((a) => a.id === id)
    return own ? logoKeyUrl(own.logoKey) ?? own.logoUrl ?? providerLogoUrl(own.provider) : null
  }

  if (isLoading) return <LoadingSkeleton />

  const header = <PageHeader title={t('family.dashboard.title')} />
  if (isError || !data) {
    return (
      <div className="space-y-4">
        {header}
        <ErrorState onRetry={() => void refetch()} />
      </div>
    )
  }

  return (
    // space-y, not gap: the header keeps its own 24px margin instead of adding the gap to it.
    <div className="space-y-4">
      {header}

      <Card>
        <CardContent className="flex flex-col gap-1.5 py-2">
          <span className="text-sm font-medium text-muted-foreground">{t('family.dashboard.sharedNetWorth')}</span>
          <CurrencyDisplay
            value={data.totalSharedNetWorth}
            className="text-4xl leading-tight font-bold tracking-tight tabular-nums text-foreground sm:text-[44px]"
          />
          <span className="text-[13px] text-muted-foreground">
            {t('dashboard.kpi.accountCount', { count: data.sharedAccounts.length })}
          </span>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>{t('family.dashboard.sharedAccounts')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.sharedAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('family.dashboard.noSharedAccounts')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {data.sharedAccounts.map((account) => {
                  const logo = logoOf(account.id)
                  return (
                    <li key={`${account.ownerName}-${account.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <Avatar className={cn('size-9 rounded-md after:rounded-md', logo && 'bg-white')} aria-hidden="true">
                        {logo && <AvatarImage src={logo} alt="" className="rounded-md object-contain p-1" />}
                        <AvatarFallback className="rounded-md text-[11px] font-bold text-foreground">{deriveMonogram(account.name)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{account.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {t(accountTypeLabelKey(account.type as AccountType))} · {account.ownerName}
                        </span>
                      </span>
                      <span className="flex flex-col items-end">
                        <CurrencyDisplay value={account.balanceEur} className="text-sm font-semibold tabular-nums text-foreground" />
                        {account.currency !== 'EUR' && (
                          <CurrencyDisplay value={account.balance} currency={account.currency} className="text-xs tabular-nums text-muted-foreground" />
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>{t('family.dashboard.sharedGoals')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.sharedGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('family.dashboard.noSharedGoals')}</p>
            ) : (
              <ul className="flex flex-col gap-5">
                {data.sharedGoals.map((goal) => {
                  const progress = goal.targetAmount > 0 ? Math.min((goal.currentTotal / goal.targetAmount) * 100, 100) : 0
                  return (
                    <li key={`${goal.ownerName}-${goal.id}`} className="flex flex-col gap-1.5">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{goal.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{goal.ownerName}</span>
                      </span>
                      <Progress value={progress} aria-label={goal.name} />
                      <span className="flex justify-between gap-2 text-xs text-muted-foreground">
                        <span className="tabular-nums">
                          <CurrencyDisplay value={goal.currentTotal} /> / <CurrencyDisplay value={goal.targetAmount} />
                        </span>
                        <span className="tabular-nums">{formatPercent(progress, { fractionDigits: 0 })}</span>
                      </span>
                      {goal.contributions.length > 0 && (
                        <div className="mt-1 flex flex-col gap-1 rounded-xl bg-muted px-3 py-2.5 text-xs">
                          <span className="font-medium text-muted-foreground">{t('family.dashboard.contributions')}</span>
                          {goal.contributions.map((c) => (
                            <span key={c.memberName} className="flex justify-between gap-2">
                              <span className="truncate">{c.memberName}</span>
                              <CurrencyDisplay value={c.amount} className="font-semibold tabular-nums text-foreground" />
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
