import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Plus, RefreshCw, Repeat } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/shared/NumericInput'
import { DateInput } from '@/components/shared/DateInput'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useCategories,
  useCreateRecurring,
  useDetectRecurring,
  useRecurring,
  useRecurringCalendar,
} from '@/features/budget/hooks'
import { cn, formatNumber, getLocale, parseAmount } from '@/lib/utils'
import type { RecurringCadence } from '@/types/api'
import { BudgetToolbar, ColorDot } from './budget-utils'
import { CADENCE_LABEL_KEY } from './budget-meta'
import { SubscriptionCard } from './SubscriptionCard'
import { ActivityFeed } from './ActivityFeed'

const CADENCES: RecurringCadence[] = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']

function RecurringForm({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { data: categories } = useCategories()
  const createRecurring = useCreateRecurring()

  const [label, setLabel] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [amount, setAmount] = useState('')
  const [cadence, setCadence] = useState<RecurringCadence>('MONTHLY')
  const [nextDueDate, setNextDueDate] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')

  function submit() {
    if (label.trim() === '' || amount.trim() === '') return
    createRecurring.mutate({
      label: label.trim(),
      counterparty: counterparty.trim() || undefined,
      expectedAmount: parseAmount(amount),
      cadence,
      nextDueDate: nextDueDate || undefined,
      categoryId: categoryId === '' ? undefined : Number(categoryId),
    }, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('budget.recurring.addTitle')}</DialogTitle>
          <DialogDescription>{t('budget.recurring.formHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rec-label">{t('budget.recurring.label')}</Label>
            <Input id="rec-label" value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="Netflix" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rec-cp">{t('budget.recurring.counterparty')}</Label>
            <Input id="rec-cp" value={counterparty} onChange={(e) => setCounterparty(e.target.value)}
              placeholder="NETFLIX.COM" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rec-amount">{t('budget.recurring.amount')}</Label>
              <NumericInput id="rec-amount" value={amount}
                onChange={(e) => setAmount(e.target.value)} placeholder="-13.49" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-cadence">{t('budget.recurring.cadence')}</Label>
              <NativeSelect id="rec-cadence" value={cadence}
                onChange={(e) => setCadence(e.target.value as RecurringCadence)}>
                {CADENCES.map((c) => (
                  <option key={c} value={c}>{t(CADENCE_LABEL_KEY[c])}</option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rec-due">{t('budget.recurring.nextDue')}</Label>
              <DateInput id="rec-due" value={nextDueDate} onChange={setNextDueDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-cat">{t('budget.recurring.category')}</Label>
              <NativeSelect id="rec-cat" value={categoryId}
                onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">{t('budget.recurring.noCategory')}</option>
                {(categories ?? []).filter((c) => !c.archived).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </NativeSelect>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}
            disabled={createRecurring.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit}
            disabled={createRecurring.isPending || label.trim() === '' || amount.trim() === ''}>
            {createRecurring.isPending ? t('common.loading') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Group upcoming occurrences by `yyyy-MM` for a compact agenda. */
function useGroupedCalendar(horizonDays: number) {
  const { data, isLoading, isError, refetch } = useRecurringCalendar(horizonDays)
  const groups = new Map<string, typeof data>()
  for (const occ of data ?? []) {
    const ym = occ.dueDate.slice(0, 7)
    const arr = groups.get(ym) ?? []
    arr.push(occ)
    groups.set(ym, arr)
  }
  return { groups, isLoading, isError, refetch, total: data?.length ?? 0 }
}

export function RecurringTab() {
  const { t } = useTranslation()
  const { data: series, isLoading, isError: seriesError, refetch: refetchSeries } = useRecurring()
  const detect = useDetectRecurring()
  const { groups, isLoading: calLoading, isError: calError, refetch: refetchCal, total } = useGroupedCalendar(90)
  const [formOpen, setFormOpen] = useState(false)

  return (
    <div className="space-y-4">
      <BudgetToolbar lead={t('budget.recurring.subtitle')}>
        <Button size="xs" variant="outline" className="flex-1 sm:flex-none" onClick={() => detect.mutate()}
          disabled={detect.isPending}>
          <RefreshCw className={cn('size-4', detect.isPending && 'animate-spin')} />
          {t('budget.recurring.detect')}
        </Button>
        <Button size="xs" className="flex-1 sm:flex-none" onClick={() => setFormOpen(true)}>
          <Plus className="size-4" /> {t('budget.recurring.add')}
        </Button>
      </BudgetToolbar>

      {/* "What changed" — silent auto-confirms + price steps, with per-item undo. */}
      <ActivityFeed />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {/* Series management — the page's main list. */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>{t('budget.recurring.series')}</CardTitle>
            {(series?.length ?? 0) > 0 && (
              <CardDescription>{t('budget.recurring.seriesCount', { count: series!.length })}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {isLoading && <Skeleton className="h-40 w-full rounded-xl" />}
            {!isLoading && seriesError && (
              <ErrorState messageOnly message={t('budget.recurring.error')} onRetry={() => void refetchSeries()} />
            )}
            {!isLoading && !seriesError && (series?.length ?? 0) === 0 && (
              <EmptyState className="py-8" icon={<Repeat className="size-8" />}
                title={t('budget.recurring.noSeries')} />
            )}
            {!isLoading && !seriesError && (series?.length ?? 0) > 0 && (
              <ul className="-mx-3 flex flex-col">
                {series!.map((s) => <SubscriptionCard key={s.id} series={s} />)}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Upcoming agenda */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>{t('budget.recurring.upcoming')}</CardTitle>
          </CardHeader>
          <CardContent>
            {calLoading && <Skeleton className="h-40 w-full rounded-xl" />}
            {!calLoading && calError && (
              <ErrorState messageOnly message={t('budget.recurring.error')} onRetry={() => void refetchCal()} />
            )}
            {!calLoading && !calError && total === 0 && (
              <EmptyState className="py-8" icon={<CalendarClock className="size-8" />}
                title={t('budget.recurring.noUpcoming')}
                description={t('budget.recurring.noUpcomingHint')} />
            )}
            {!calLoading && !calError && total > 0 && (
              <div className="flex flex-col gap-4">
                {[...groups.entries()].map(([ym, occs]) => (
                  <section key={ym}>
                    <h3 className="mb-1.5 text-xs font-medium text-muted-foreground first-letter:uppercase">
                      {new Intl.DateTimeFormat(getLocale(), { month: 'long', year: 'numeric' })
                        .format(new Date(`${ym}-01T00:00:00`))}
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {(occs ?? []).map((occ) => {
                        const displayLabel = `${occ.label}${occ.creditCardPayment && occ.rewardPoints != null ? ` · ${formatNumber(occ.rewardPoints)} ${t('accounts.amex.miles')}` : ''}`
                        return (
                          <li key={`${occ.seriesId}-${occ.dueDate}`}
                            className="flex items-center gap-2.5 text-[13px]">
                            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                              {new Date(`${occ.dueDate}T00:00:00`).getDate()}
                            </span>
                            <ColorDot color={occ.categoryColor} />
                            <span className="min-w-0 flex-1 truncate font-medium" title={displayLabel} aria-label={displayLabel}>{displayLabel}</span>
                            <CurrencyDisplay value={occ.expectedAmount} showSign
                              className="shrink-0 font-semibold tabular-nums text-foreground" />
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RecurringForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
