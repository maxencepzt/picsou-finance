import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useGoal } from '@/features/goals/hooks'
import { useHistory } from '@/features/history/hooks'
import { NetWorthChart } from '@/components/shared/NetWorthChart'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { type TimeRange } from '@/components/shared/TimeRangeSelector'
import { formatPercent } from '@/lib/utils'
import { goalStatus } from './goal-stats'
import { Stat, StatusDot } from './Stat'

interface GoalDetailModalProps {
  goalId: number | null
  onClose: () => void
}

export function GoalDetailModal({ goalId, onClose }: GoalDetailModalProps) {
  const { t } = useTranslation()
  const [range, setRange] = useState<TimeRange>('ALL')

  const { data: goal, isLoading: goalLoading } = useGoal(goalId ?? 0)
  const accountIds = useMemo(() => goal?.accounts.map(a => a.id) ?? [], [goal])
  const { data: history, isLoading: historyLoading } = useHistory(accountIds, 12)

  const open = goalId != null
  const isLoading = goalLoading || historyLoading

  // Baseline = balance at goal creation. We need this so the ideal trajectory
  // is drawn in the same reference frame as the live area (which starts from
  // the linked accounts' pre-goal balance, not from zero). Without it, the
  // dashed target line floats far below the data and the chart looks rosy
  // even when the "behind" badge fires.
  const baseline = useMemo(() => {
    if (!goal || !history?.length) return 0
    const createdMs = new Date(goal.createdAt).getTime()
    if (!Number.isFinite(createdMs)) return 0
    // First snapshot at or after createdAt is the closest proxy for "balance
    // at creation". History is sorted ascending by the backend.
    const firstKept = history.find(p => new Date(p.date).getTime() >= createdMs)
    return firstKept?.total ?? history[0]?.total ?? 0
  }, [goal, history])

  // Captured once at mount -- the "today" marker doesn't need to drift live as
  // the user interacts with the modal. Shared by the projection start and the
  // chart's vertical guide so they always line up.
  const [todayMs] = useState(() => Date.now())

  // "At current pace" forecast: where the user lands at deadline if they keep
  // contributing at the trailing 3-month average. Null when we lack the data
  // to draw it honestly.
  const projection = useMemo(() => {
    // Both overlays are drawn towards a deadline. A recurring plan has none, so there is nothing
    // honest to draw — the four-scenario projection on the Analysis page is its equivalent.
    if (!goal || goal.avgMonthlyContribution == null || goal.deadline == null) return undefined
    const endValue = goal.currentTotal + goal.avgMonthlyContribution * Math.max(goal.monthsLeft, 0)
    return {
      startDate: new Date(todayMs).toISOString(),
      startValue: goal.currentTotal,
      endDate: goal.deadline,
      endValue,
      label: t('goals.atCurrentPace'),
    }
  }, [goal, t, todayMs])

  // The same verdict as the goal's card, so the two never disagree.
  const status = goal
    ? ({
        achieved: { label: t('goals.achieved'), tone: 'gain' },
        waiting: { label: t('goals.waiting'), tone: 'muted' },
        onTrack: { label: t('goals.onTrack'), tone: 'gain' },
        behind: { label: t('goals.behind'), tone: 'warning' },
      } as const)[goalStatus(goal)]
    : null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        {isLoading || !goal ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pr-8">
                <DialogTitle className="text-lg">{goal.name}</DialogTitle>
                {status && <StatusDot tone={status.tone}>{status.label}</StatusDot>}
              </div>
            </DialogHeader>

            <div className="space-y-6 mt-2">
              {/* Progress summary */}
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div>
                  <p className="mb-1 text-[13px] font-medium text-muted-foreground">{t('goals.currentTotal')}</p>
                  <CurrencyDisplay value={goal.currentTotal} className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl" />
                </div>
                <div className="sm:text-right">
                  <p className="mb-1 text-[13px] font-medium text-muted-foreground">
                    {goal.targetAmount == null ? t('goals.monthlyAmount') : t('goals.targetAmount')}
                  </p>
                  <CurrencyDisplay
                    value={goal.targetAmount ?? goal.monthlyAmount ?? 0}
                    className="text-xl font-semibold tabular-nums text-foreground"
                  />
                </div>
              </div>

              {/* Chart */}
              {history && history.length > 0 && (
                <NetWorthChart
                  data={history}
                  range={range}
                  onRangeChange={setRange}
                  showInvested={false}
                  target={
                    goal.deadline != null && goal.targetAmount != null
                      ? {
                          startDate: goal.createdAt,
                          startValue: baseline,
                          endDate: goal.deadline,
                          endValue: goal.targetAmount,
                          label: t('goals.targetAmount'),
                        }
                      : undefined
                  }
                  projection={projection}
                  todayMs={todayMs}
                  todayLabel={t('common.today')}
                />
              )}

              {/* Stats grid */}
              <dl className="grid grid-cols-2 gap-4 border-t pt-4 text-sm sm:grid-cols-4">
                <Stat label={t('goals.progress')}>{formatPercent(goal.percentComplete ?? 0, { fractionDigits: 0 })}</Stat>
                <Stat label={t('goals.monthsLeft')}>{goal.monthsLeft}</Stat>
                <Stat label={t('goals.monthlyNeeded')}><CurrencyDisplay value={goal.monthlyNeeded ?? 0} /></Stat>
                <Stat label={t('goals.avgContribution')}>
                  {goal.avgMonthlyContribution != null ? <CurrencyDisplay value={goal.avgMonthlyContribution} /> : '\u2013'}
                </Stat>
              </dl>

              {/* Linked accounts */}
              {goal.accounts.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="mb-2 text-sm font-semibold">
                    {t('goals.linkedAccounts')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {goal.accounts.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5"
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: a.color }}
                          aria-hidden="true"
                        />
                        <span className="text-sm">{a.name}</span>
                        <CurrencyDisplay value={a.currentBalanceEur} className="text-[13px] font-semibold tabular-nums text-foreground" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
