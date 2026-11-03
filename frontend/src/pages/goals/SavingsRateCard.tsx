import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FRENCH_HOUSEHOLD_SAVINGS_RATE } from '@/lib/constants'
import { formatPercent } from '@/lib/utils'
import { monthlyContributions } from './plan-math'
import type { GoalProgress } from '@/types/api'

interface SavingsRateCardProps {
  /** The member's recurring plans; the card decides for itself which are running. */
  plans: GoalProgress[]
  /**
   * Net monthly income from the settings profile — what actually lands in the account. Null
   * until both figures behind it are stated, which is when the card asks instead of computing.
   */
  monthlyNetIncome: number | null
  /** ISO date, passed in rather than read here so the component stays pure. */
  today: string
  onOpenSettings: () => void
}

/**
 * What share of their income the member is putting aside every month, against the national
 * average.
 *
 * The denominator is **net** income, because that is what INSEE's rate uses too: "revenu
 * disponible brut" is gross of capital consumption, not of tax — it is measured after
 * compulsory levies. Dividing by a gross salary would understate the rate by roughly a quarter
 * and put the two sides of the comparison on different bases.
 *
 * They are still not the same quantity — disposable income is not salary, and standing orders
 * are not all of saving — so the tooltip quotes the definition rather than presenting the
 * comparison as arithmetic. It answers "more or less than people around me", which is the
 * question being asked.
 */
export function SavingsRateCard({
  plans,
  monthlyNetIncome,
  today,
  onOpenSettings,
}: SavingsRateCardProps) {
  const { t } = useTranslation()

  const contributions = monthlyContributions(plans, today)
  if (contributions <= 0) return null

  // No income stated: show what is being put aside and say what is missing, rather than
  // inventing a denominator. Same principle as the allocation targets form, which never guesses
  // an expense on the member's behalf.
  const header = (
    <CardHeader>
      <CardTitle>{t('goals.savingsRate.title')}</CardTitle>
      <CardAction>
        {/* Wrapped locally like PriceFreshnessDot and AccountRow: providers.tsx already
            supplies one app-wide, but this keeps the card renderable on its own. */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t('goals.savingsRate.benchmarkLabel')}
                className="grid size-8 place-items-center rounded-md text-muted-foreground hover:text-foreground"
              >
                <Info className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {t('goals.savingsRate.benchmark', { rate: formatPercent(FRENCH_HOUSEHOLD_SAVINGS_RATE) })}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardAction>
    </CardHeader>
  )

  // No income stated: show what is being put aside and say what is missing, rather than
  // inventing a denominator. Same principle as the allocation targets form, which never guesses
  // an expense on the member's behalf.
  if (monthlyNetIncome == null || monthlyNetIncome <= 0) {
    return (
      <Card>
        {header}
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-sm text-pretty text-muted-foreground">{t('goals.savingsRate.needsIncome')}</p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('goals.savingsRate.goToSettings')}
          </button>
        </CardContent>
      </Card>
    )
  }

  const rate = (contributions / monthlyNetIncome) * 100

  return (
    <Card>
      {header}
      <CardContent className="flex flex-col gap-3">
        <div>
          {/* A ratio, so it stays legible in privacy mode -- the amounts beside it do not. */}
          <p className="text-[22px] leading-tight font-semibold tracking-tight tabular-nums">{formatPercent(rate)}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            <CurrencyDisplay value={contributions} className="font-semibold text-foreground" />
            {' / '}
            <CurrencyDisplay value={monthlyNetIncome} />
            {' '}
            {t('goals.savingsRate.perMonth')}
          </p>
        </div>
        <Progress value={Math.min(100, rate)} className="h-1.5" aria-label={t('goals.savingsRate.title')} />
      </CardContent>
    </Card>
  )
}
