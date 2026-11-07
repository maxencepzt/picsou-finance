import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { ErrorState } from '@/components/shared/ErrorState'
import { MerchantAvatar } from '@/components/shared/MerchantAvatar'
import { useRecurring } from '@/features/budget/hooks'
import { formatDate } from '@/lib/utils'
import { subscriptionsSummary } from './subscriptions'

/** Confirmed recurring debits at a glance: their monthly-equivalent and yearly cost, the next ones due. */
export function SubscriptionsSummaryCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // The same query as the recurring tab, filtered here: one cache entry for both.
  const recurringQ = useRecurring()
  const summary = subscriptionsSummary(recurringQ.data ?? [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('budget.overview.subscriptions.title')}</CardTitle>
        {summary.count > 0 && (
          <CardDescription>{t('budget.overview.subscriptions.count', { count: summary.count })}</CardDescription>
        )}
        <CardAction>
          <button type="button" className="text-sm font-medium text-primary transition-colors hover:text-foreground" onClick={() => navigate('subscriptions')}>{t('dashboard.viewAll')}</button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {recurringQ.isLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : recurringQ.isError ? (
          <ErrorState messageOnly message={t('budget.recurring.error')} onRetry={() => void recurringQ.refetch()} />
        ) : summary.count === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('budget.overview.subscriptions.empty')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="flex flex-wrap items-baseline gap-x-1.5">
                <CurrencyDisplay value={summary.monthly} className="text-2xl font-bold tabular-nums text-foreground" />
                <span className="text-sm text-muted-foreground">{t('budget.overview.subscriptions.perMonth')}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('common.labelColon', { label: t('budget.overview.subscriptions.perYear') })}{' '}
                <CurrencyDisplay value={summary.annual} className="font-semibold text-foreground" />
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('budget.overview.subscriptions.nextDue')}</p>
              <ul className="flex flex-col gap-2">
                {summary.upcoming.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <MerchantAvatar label={s.label} color={s.categoryColor} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{formatDate(s.nextDueDate)}</span>
                    <CurrencyDisplay value={s.expectedAmount} showSign className="shrink-0 tabular-nums text-foreground" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
