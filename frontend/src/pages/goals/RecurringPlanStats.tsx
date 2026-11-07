import { useTranslation } from 'react-i18next'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Delta } from '@/components/shared/Delta'
import { Skeleton } from '@/components/ui/skeleton'
import { useRecurringStats } from '@/features/goals/hooks'
import { formatLocalDate } from '@/lib/utils'
import type { GoalProgress } from '@/types/api'
import { Stat } from './Stat'

/**
 * What a recurring plan actually bought over its last 12 calendar months (from the 1st of the
 * month 11 months back, cut to the plan's own dates): invested, months with a purchase, and what
 * those purchases are worth today.
 */
export function RecurringPlanStats({ goal }: { goal: GoalProgress }) {
  const { t } = useTranslation()
  const stats = useRecurringStats(goal.id)

  // Purchases are matched on the split's tickers, so an undetailed plan can never have any.
  if (goal.allocations.length === 0) {
    return <p className="text-[13px] text-muted-foreground">{t('goals.planStats.needsSplit')}</p>
  }
  if (stats.isLoading) return <Skeleton className="h-24 w-full" />
  if (stats.isError) {
    return (
      <p className="text-[13px] text-muted-foreground">
        {t('goals.planStats.error')}{' '}
        <button
          type="button"
          className="font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => void stats.refetch()}
        >
          {t('common.retry')}
        </button>
      </p>
    )
  }
  const s = stats.data
  // A plan that starts later or ended before the window has nothing to measure.
  if (s == null || s.monthsElapsed === 0) return null

  // Null when a bought ticker has no price; 0 without purchases, which is no valuation either.
  const value = s.purchases > 0 ? s.currentValueEur : null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-medium text-muted-foreground">
        {t('goals.planStats.title', { date: formatLocalDate(s.from) })}
      </p>
      <dl className="grid grid-cols-2 gap-2.5 text-[13px]">
        <Stat label={t('goals.planStats.invested')}>
          <CurrencyDisplay value={s.investedEur} />
        </Stat>
        <Stat label={t('goals.planStats.months')}>
          {s.monthsWithPurchase} / {s.monthsElapsed}
        </Stat>
        <Stat label={t('goals.planStats.value')}>
          {value != null ? <CurrencyDisplay value={value} /> : '—'}
        </Stat>
        <Stat label={t('goals.planStats.gain')}>
          {value != null && s.gainEur != null ? <Delta amount={s.gainEur} percent={s.gainPercent} /> : '—'}
        </Stat>
      </dl>
      {value == null && (
        <p className="text-xs text-muted-foreground">
          {s.purchases === 0 ? t('goals.planStats.noPurchase') : t('goals.planStats.noPrice')}
        </p>
      )}
    </div>
  )
}
