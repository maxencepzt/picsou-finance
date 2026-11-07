import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useRecurringCalendar } from '@/features/budget/hooks'
import { useUpcomingDividends } from '@/features/dividends/hooks'
import { cn, formatShortDate, localeFromLanguage } from '@/lib/utils'
import type { DashboardData } from '@/types/api'

interface UpcomingEvent {
  id: string
  date: string
  label: string
  hint: string
  amount: number
}

const HORIZON_DAYS = 30
const MAX_ROWS = 6

/** The next thirty days: dividends and distributions, recurring debits and credits, card statements. */
export function UpcomingCard({ liabilities }: { liabilities: DashboardData['liabilities'] }) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const { data: dividends = [] } = useUpcomingDividends(HORIZON_DAYS)
  const { data: calendar = [] } = useRecurringCalendar(HORIZON_DAYS)

  const events: UpcomingEvent[] = [
    ...dividends.map((d) => ({
      id: `div:${d.id}`,
      date: d.paymentDate ?? d.expectedDate,
      label: d.name,
      hint: t(d.source === 'SCPI' ? 'dashboard.upcoming.scpi' : 'dashboard.upcoming.dividend'),
      amount: d.amountEur,
    })),
    ...calendar.map((o) => ({
      id: `rec:${o.seriesId}:${o.dueDate}`,
      date: o.dueDate,
      label: o.label,
      hint: o.categoryName ?? t('dashboard.upcoming.recurring'),
      amount: o.expectedAmount,
    })),
    ...liabilities
      .filter((l) => l.paymentDueDate && l.paymentDueAmountEur)
      .map((l) => ({
        id: `card:${l.accountId}`,
        date: l.paymentDueDate!,
        label: l.name,
        hint: t('dashboard.upcoming.cardStatement'),
        amount: -Math.abs(l.paymentDueAmountEur!),
      })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, MAX_ROWS)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('dashboard.upcoming.title')}</CardTitle>
        <CardAction>
          <Link to="/budget/subscriptions" className="text-sm font-medium text-primary hover:text-foreground">
            {t('dashboard.upcoming.calendar')}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.upcoming.empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {events.map((event) => (
              <li key={event.id} className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-3 py-2">
                <span className="text-center text-xs leading-tight font-semibold text-muted-foreground">
                  {formatShortDate(event.date, locale)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{event.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{event.hint}</span>
                </span>
                <CurrencyDisplay
                  value={event.amount}
                  showSign
                  className={cn('text-sm font-semibold tabular-nums', event.amount > 0 ? 'text-gain' : 'text-foreground')}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
