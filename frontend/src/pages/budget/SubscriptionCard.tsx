import { useTranslation } from 'react-i18next'
import { Check, Sparkles, Trash2, TrendingUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { MerchantAvatar } from '@/components/shared/MerchantAvatar'
import {
  useConfirmRecurring,
  useDeleteRecurring,
  useIgnoreRecurring,
} from '@/features/budget/hooks'
import { formatDate, formatPercent, getLocale } from '@/lib/utils'
import { useMoney } from '@/hooks/use-money'
import type { RecurringSeries } from '@/types/api'
import { CADENCE_LABEL_KEY, RUNTIME_STATUS_META, STATUS_LABEL_KEY, STATUS_TONE } from './budget-meta'
import { StatusDot } from './budget-utils'

/**
 * One detected/declared recurring series. Beyond the v1 row (avatar, label, cadence, status, amount)
 * it surfaces the v2 signals so the user can see *why* the detector decided what it did: a runtime
 * urgency chip (late / due soon), a "variable amount" tag, a silent-auto-confirm note with the
 * confidence, and a price-change line. The confirm / ignore / delete actions are unchanged.
 */
export function SubscriptionCard({ series }: { series: RecurringSeries }) {
  const money = useMoney()
  const { t } = useTranslation()
  const confirm = useConfirmRecurring()
  const ignore = useIgnoreRecurring()
  const remove = useDeleteRecurring()
  const busy = confirm.isPending || ignore.isPending || remove.isPending

  const runtime = series.runtimeStatus !== 'SCHEDULED' ? RUNTIME_STATUS_META[series.runtimeStatus] : null
  const confidencePct = series.confidence != null
    ? formatPercent(series.confidence * 100, { fractionDigits: 0 })
    : null
  const showPriceChange = series.priceChangedAt != null && series.previousAmount != null

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/50">
      <MerchantAvatar label={series.label} color={series.categoryColor} size="md" />

      <div className="min-w-0 flex-1 basis-40">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
          <p className="truncate text-sm font-semibold">{series.label}</p>
          <StatusDot tone={STATUS_TONE[series.status]}>{t(STATUS_LABEL_KEY[series.status])}</StatusDot>
        </div>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs font-medium text-muted-foreground">
          <span className="truncate">
            {t(CADENCE_LABEL_KEY[series.cadence])}
            {series.nextDueDate && ` · ${formatDate(series.nextDueDate, getLocale())}`}
            {series.variable && ` · ${t('budget.recurring.variable')}`}
          </span>
          {runtime && (
            <>
              <span aria-hidden="true">·</span>
              <StatusDot tone={runtime.tone}>{t(runtime.labelKey)}</StatusDot>
            </>
          )}
        </p>
        {(series.autoConfirmed || showPriceChange) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            {series.autoConfirmed && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Sparkles className="size-3 shrink-0" aria-hidden="true" />
                {confidencePct != null
                  ? t('budget.recurring.autoConfirmedConfident', { percent: confidencePct })
                  : t('budget.recurring.activity.autoConfirmed')}
              </span>
            )}
            {showPriceChange && (
              <span className="inline-flex items-center gap-1 font-medium text-warning">
                <TrendingUp className="size-3 shrink-0" aria-hidden="true" />
                {t('budget.recurring.priceFromTo', {
                  from: money.amount(Math.abs(series.previousAmount!)),
                  to: money.amount(Math.abs(series.expectedAmount)),
                })}
              </span>
            )}
          </div>
        )}
      </div>

      <CurrencyDisplay
        value={series.expectedAmount}
        showSign
        className="ml-auto shrink-0 text-right text-sm font-semibold tabular-nums text-foreground"
      />

      {/* Fixed width so the amounts of every row line up whatever actions a status offers. */}
      <div className="ml-auto flex w-30 shrink-0 items-center justify-end">
        {series.status !== 'CONFIRMED' && (
          <Button size="icon" variant="ghost" disabled={busy}
            aria-label={t('budget.a11y.confirm', { name: series.label })}
            onClick={() => confirm.mutate(series.id)}>
            <Check className="size-4 text-gain" />
          </Button>
        )}
        {series.status !== 'IGNORED' && (
          <Button size="icon" variant="ghost" disabled={busy}
            aria-label={t('budget.a11y.ignore', { name: series.label })}
            onClick={() => ignore.mutate(series.id)}>
            <X className="size-4 text-muted-foreground" />
          </Button>
        )}
        <Button size="icon" variant="ghost" disabled={busy}
          className="text-muted-foreground hover:text-destructive"
          aria-label={t('budget.a11y.delete', { name: series.label })}
          onClick={() => remove.mutate(series.id)}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  )
}
