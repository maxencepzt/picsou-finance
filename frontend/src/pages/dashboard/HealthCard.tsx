import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useWealthPyramid } from '@/features/analysis/hooks'
import { formatPercent } from '@/lib/utils'

/** The composition score of the wealth pyramid and the safety net, in one glance. */
export function HealthCard() {
  const { t } = useTranslation()
  const { data } = useWealthPyramid()
  if (!data) return null
  const { score, safetyNet } = data
  const coverage = safetyNet.coverage == null ? null : Math.min(100, safetyNet.coverage * 100)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('dashboard.health.title')}</CardTitle>
        <CardAction>
          <Link to="/analysis" className="text-sm font-medium text-primary hover:text-foreground">{t('nav.analysis')}</Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {score.global == null ? (
          <p className="text-sm text-muted-foreground">{t('analysis.score.notRatedYet')}</p>
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl leading-none font-bold tabular-nums">{score.global}</span>
            <span className="text-sm font-medium text-muted-foreground">{t('dashboard.health.outOf')}</span>
          </div>
        )}
        <dl className="flex flex-col gap-2 text-[13px]">
          {score.allocation != null && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t('analysis.score.allocation')}</dt>
              <dd className="font-semibold tabular-nums">{score.allocation}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{t('dashboard.health.misplaced')}</dt>
            <dd className="font-semibold tabular-nums">{formatPercent(score.misplacedPercent)}</dd>
          </div>
          {score.loanToValue != null && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t('dashboard.health.loanToValue')}</dt>
              <dd className="font-semibold tabular-nums">{formatPercent(score.loanToValue * 100)}</dd>
            </div>
          )}
        </dl>
        <div className="flex flex-col gap-2 rounded-xl bg-muted p-3">
          <div className="flex justify-between gap-2 text-[13px]">
            <span className="font-semibold">{t('analysis.score.safetyNet')}</span>
            <CurrencyDisplay value={safetyNet.valueEur} className="font-semibold tabular-nums" />
          </div>
          {coverage == null ? (
            <span className="text-xs text-muted-foreground">{t('analysis.safetyNet.unknown')}</span>
          ) : (
            <>
              <Progress value={coverage} aria-label={t('analysis.score.safetyNet')} />
              <span className="text-xs text-muted-foreground">
                {safetyNet.excessEur > 0
                  ? <>{t('dashboard.health.excess')} <CurrencyDisplay value={safetyNet.excessEur} className="font-semibold text-foreground" /></>
                  : t('analysis.safetyNet.short', { value: formatPercent(coverage, { fractionDigits: 0 }) })}
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
