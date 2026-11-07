import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Line, LineChart, XAxis, YAxis } from 'recharts'
import { CalendarCheck, CalendarClock, CalendarX } from 'lucide-react'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useGoalHistory } from '@/features/goals/hooks'
import { useMoney } from '@/hooks/use-money'
import type { GoalProgress } from '@/types/api'
import { formatMonthYear, projectReach, trajectoryRows } from './goal-stats'

const SAVED_COLOR = 'var(--chart-1)'
const IDEAL_COLOR = 'var(--chart-5)'

/**
 * A savings goal's small trajectory chart and its forecast sentence: what the linked accounts held
 * against the straight line to the target, then when the average pace gets there. The full chart
 * with tooltips stays in `GoalDetailModal`, one click away.
 */
export function GoalTrajectory({ goal, today }: { goal: GoalProgress; today: string }) {
  const { t } = useTranslation()
  const money = useMoney()
  const history = useGoalHistory(goal.id)
  const rows = useMemo(() => (history.data ? trajectoryRows(history.data, goal) : null), [history.data, goal])
  const config = useMemo<ChartConfig>(() => ({
    saved: { label: t('goals.trajectory.saved'), color: SAVED_COLOR },
    ideal: { label: t('goals.trajectory.ideal'), color: IDEAL_COLOR },
  }), [t])

  return (
    <div className="flex flex-col gap-2">
      {history.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : history.isError ? (
        <p className="text-[13px] text-muted-foreground">
          {t('goals.trajectory.error')}{' '}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            // The card opens the detail on click; a retry must not.
            onClick={(e) => { e.stopPropagation(); void history.refetch() }}
          >
            {t('common.retry')}
          </button>
        </p>
      ) : rows == null ? (
        <p className="text-[13px] text-muted-foreground">{t('goals.trajectory.empty')}</p>
      ) : (
        <div>
          <ChartContainer
            config={config}
            className="aspect-auto h-16 w-full"
            role="img"
            aria-label={t('goals.trajectory.chartLabel', {
              target: money.amount(goal.targetAmount ?? 0, 'EUR', { maximumFractionDigits: 0 }),
            })}
          >
            <LineChart data={rows} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} hide />
              {/* Hidden; zoomed between the lowest balance and the target so the gap to the line shows. */}
              <YAxis hide domain={['dataMin', 'dataMax']} tickFormatter={money.tick} />
              <Line
                dataKey="ideal"
                stroke={IDEAL_COLOR}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line dataKey="saved" stroke={SAVED_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ChartContainer>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {(['saved', 'ideal'] as const).map((key) => (
              <li key={key} className="flex items-center gap-1.5">
                <span
                  className="h-0.5 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: key === 'saved' ? SAVED_COLOR : IDEAL_COLOR }}
                  aria-hidden="true"
                />
                {t(`goals.trajectory.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ReachLine goal={goal} today={today} />
    </div>
  )
}

function ReachLine({ goal, today }: { goal: GoalProgress; today: string }) {
  const { t } = useTranslation()
  const money = useMoney()
  const reach = projectReach(goal, today)
  if (reach == null) return null
  const average = goal.avgMonthlyContribution ?? 0
  const pace = t('goals.card.perMonth', {
    value: money.amount(Math.abs(average), 'EUR', { maximumFractionDigits: 0 }),
  })

  if (reach.kind === 'onTime') {
    return (
      <p className="flex items-start gap-1.5 text-[13px] text-muted-foreground">
        <CalendarCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span className="text-pretty">{t('goals.trajectory.onTime', { month: formatMonthYear(reach.month), pace })}</span>
      </p>
    )
  }
  const Icon = reach.kind === 'late' ? CalendarClock : CalendarX
  return (
    <p className="flex items-start gap-1.5 text-[13px] text-warning">
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span className="text-pretty">
        {reach.kind === 'late'
          ? t('goals.trajectory.late', { count: reach.monthsLate, month: formatMonthYear(reach.month), pace })
          // A falling balance has no pace to reach anything at: say it falls, not "a pace of -3 €".
          : average < 0
            ? t('goals.trajectory.shrinking', { pace })
            : t('goals.trajectory.never', { pace })}
      </span>
    </p>
  )
}
