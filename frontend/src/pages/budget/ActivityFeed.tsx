import { useTranslation } from 'react-i18next'
import { Check, Sparkles, TrendingUp, Undo2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MerchantAvatar } from '@/components/shared/MerchantAvatar'
import { useRecurringActivity, useUndoRecurring } from '@/features/budget/hooks'
import { cn, formatDate, getLocale } from '@/lib/utils'
import { useMoney } from '@/hooks/use-money'
import type { RecurringActivity } from '@/types/api'

/**
 * "What changed" feed — the safety net for silent auto-confirm. It only surfaces *recent*
 * events (auto-confirmed series + price steps); when nothing changed it renders nothing at
 * all, so it never becomes a permanent chore the way a review queue would. Each entry offers
 * a context-aware reversal: a price change is *acknowledged* (keep the new amount, dismiss the
 * alert), a silent auto-confirm is *rejected* (the series goes back to IGNORED). Both map to the
 * single backend `undo` endpoint, which decides the behaviour from the series' own state.
 */
function ActivityRow({ entry }: { entry: RecurringActivity }) {
  const money = useMoney()
  const { t } = useTranslation()
  const undo = useUndoRecurring()

  const isPriceChange = entry.type === 'PRICE_CHANGE'
  const description = isPriceChange && entry.previousAmount != null
    ? t('budget.recurring.activity.priceChangeDesc', {
        from: money.amount(Math.abs(entry.previousAmount)),
        to: money.amount(Math.abs(entry.expectedAmount)),
      })
    : t('budget.recurring.activity.autoConfirmedDesc')

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2 transition-colors hover:bg-muted/50">
      <MerchantAvatar label={entry.label} color={entry.categoryColor} size="md" />

      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-sm font-semibold">{entry.label}</p>
        <p className={cn('flex min-w-0 flex-wrap items-center gap-x-1 text-xs font-medium', isPriceChange ? 'text-warning' : 'text-muted-foreground')}>
          {/* Inline icon, so it wraps with the sentence instead of being left alone on a line. */}
          <span className="min-w-0">
            {isPriceChange
              ? <TrendingUp className="mr-1 inline size-3 align-[-2px]" aria-hidden="true" />
              : <Sparkles className="mr-1 inline size-3 align-[-2px]" aria-hidden="true" />}
            {description}
          </span>
          {entry.occurredOn && (
            <span className="shrink-0 text-muted-foreground tabular-nums">· {formatDate(entry.occurredOn, getLocale())}</span>
          )}
        </p>
      </div>

      <Button size="xs" variant="outline" className="ml-auto shrink-0" disabled={undo.isPending}
        onClick={() => undo.mutate(entry.seriesId)}>
        {isPriceChange ? <Check className="size-4" /> : <Undo2 className="size-4" />}
        {isPriceChange ? t('budget.recurring.activity.acknowledge') : t('budget.recurring.undo')}
      </Button>
    </li>
  )
}

/** The activity card. Renders nothing while loading or when the feed is empty. */
export function ActivityFeed() {
  const { t } = useTranslation()
  const { data: activity, isLoading } = useRecurringActivity()

  if (isLoading || !activity || activity.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('budget.recurring.activity.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="-mx-3 flex flex-col">
          {activity.map((entry) => (
            <ActivityRow key={`${entry.seriesId}-${entry.type}-${entry.occurredOn ?? ''}`} entry={entry} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
