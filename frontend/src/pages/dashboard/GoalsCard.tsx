import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { GoalDetailModal } from '@/pages/goals/GoalDetailModal'
import { cn, formatPercent } from '@/lib/utils'
import type { DashboardData } from '@/types/api'

/** The three savings goals closest to done; the goals page holds the rest. */
export function GoalsCard({ goals }: { goals: DashboardData['goalSummaries'] }) {
  const { t } = useTranslation()
  const [detailGoalId, setDetailGoalId] = useState<number | null>(null)
  // Savings targets only: the backend already filters recurring plans out of goalSummaries.
  const shown = goals
    .filter((g) => g.percentComplete != null && g.targetAmount != null)
    .sort((a, b) => (b.percentComplete ?? 0) - (a.percentComplete ?? 0))
    .slice(0, 3)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('dashboard.goals')}</CardTitle>
        <CardAction>
          <Link to="/goals" className="text-sm font-medium text-primary hover:text-foreground">
            {goals.length > 3 ? t('dashboard.otherGoals', { count: goals.length - 3 }) : t('dashboard.viewAll')}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noGoals')}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {shown.map((goal) => (
              <li key={goal.id}>
                <button type="button" onClick={() => setDetailGoalId(goal.id)} className="group flex w-full flex-col gap-1.5 text-left">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold transition-[color] group-hover:text-primary">{goal.name}</span>
                    {/* Status as a dot and a word, like every status: no filled pill. */}
                    <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-xs font-medium', goal.isOnTrack === false ? 'text-warning' : 'text-muted-foreground')}>
                      <span className={cn('size-2 rounded-full', goal.isOnTrack === false ? 'bg-warning' : 'bg-gain')} aria-hidden="true" />
                      {t(goal.isOnTrack === false ? 'dashboard.goalBehind' : 'dashboard.goalOnTrack')}
                    </span>
                  </span>
                  <Progress value={goal.percentComplete ?? 0} aria-label={goal.name} />
                  <span className="flex justify-between gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      <CurrencyDisplay value={goal.currentTotal} /> / <CurrencyDisplay value={goal.targetAmount ?? 0} />
                    </span>
                    <span className="tabular-nums">{formatPercent(goal.percentComplete ?? 0, { fractionDigits: 0 })}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <GoalDetailModal goalId={detailGoalId} onClose={() => setDetailGoalId(null)} />
    </Card>
  )
}
