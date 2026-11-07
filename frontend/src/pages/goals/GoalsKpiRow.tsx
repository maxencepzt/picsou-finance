import { useTranslation } from 'react-i18next'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { KpiTile } from '@/components/shared/KpiTile'
import { useMoney } from '@/hooks/use-money'
import { formatPercent } from '@/lib/utils'
import type { GoalProgress } from '@/types/api'
import { summarizeSavings } from './goal-stats'
import { isActiveThisMonth, monthlyContributions } from './plan-math'

interface GoalsKpiRowProps {
  savings: GoalProgress[]
  plans: GoalProgress[]
  today: string
}

/** The Goals page's indicators, from the goal list alone. A section with no goal has no tiles. */
export function GoalsKpiRow({ savings, plans, today }: GoalsKpiRowProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const summary = summarizeSavings(savings)

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {savings.length > 0 && (
        <>
          <KpiTile
            label={t('goals.kpi.saved')}
            value={<CurrencyDisplay value={summary.saved} />}
            footer={t('goals.kpi.ofTarget', {
              target: money.amount(summary.target, 'EUR', { maximumFractionDigits: 0 }),
              // A ratio, so it stays legible in privacy mode.
              percent: formatPercent(summary.target > 0 ? (summary.saved / summary.target) * 100 : 0, { fractionDigits: 0 }),
            })}
          />
          <KpiTile
            label={t('goals.kpi.onTrack')}
            value={`${summary.onTrack} / ${summary.count}`}
            footer={summary.behind > 0 ? t('goals.kpi.behind', { count: summary.behind }) : t('goals.kpi.noneBehind')}
          />
          <KpiTile
            label={t('goals.kpi.required')}
            value={<CurrencyDisplay value={summary.required} />}
            footer={summary.averaged != null
              // The tile is already per month; "/ mois" again would not fit a phone's tile.
              ? t('goals.kpi.averaged', { value: money.amount(summary.averaged, 'EUR', { maximumFractionDigits: 0 }) })
              : t('goals.kpi.noAverage')}
          />
        </>
      )}
      {plans.length > 0 && (
        <KpiTile
          label={t('goals.kpi.plans')}
          value={<CurrencyDisplay value={monthlyContributions(plans, today)} />}
          footer={t('goals.kpi.running', { count: plans.filter((p) => isActiveThisMonth(p, today)).length })}
        />
      )}
    </div>
  )
}
