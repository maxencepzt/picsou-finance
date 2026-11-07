import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, TrendingUp, TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { cn, formatDecimal, formatPercent } from '@/lib/utils'
import { useMoney } from '@/hooks/use-money'
import type { SafetyNetLine, WealthAlert, WealthPyramid, WealthTierLine } from '@/types/api'
import { TIER_COLORS } from './tier-colors'

/** Gap in points beyond which a tier is worth flagging rather than merely reporting. */
const NOTABLE_GAP = 5

/** Top to bottom: the riskiest tier crowns the pyramid, the safety net is its base. */
const RISK_ORDER: WealthTierLine['tier'][] = ['CRYPTO', 'ALTERNATIVE', 'EQUITY', 'REAL_ESTATE']

const BADGE = 'h-[22px] px-2 text-xs font-semibold'

function Dot({ color }: { color: string }) {
  return <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
}

function ScoreRing({ score }: { score: number }) {
  const { t } = useTranslation()
  const circumference = 2 * Math.PI * 46
  return (
    <div role="img" aria-label={`${score} ${t('dashboard.health.outOf')}`} className="relative grid size-28 shrink-0 place-items-center">
      <svg viewBox="0 0 112 112" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="56" cy="56" r="46" fill="none" strokeWidth="10" className="stroke-muted" />
        <circle
          cx="56" cy="56" r="46" fill="none" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(Math.min(100, score) / 100) * circumference} ${circumference}`}
          className="stroke-primary"
        />
      </svg>
      <div className="flex flex-col items-center leading-none">
        <span className="text-[26px] font-bold tabular-nums">{score}</span>
        <span className="mt-1 text-[11px] font-medium text-muted-foreground">{t('dashboard.health.outOf')}</span>
      </div>
    </div>
  )
}

function TierRow({ line }: { line: WealthTierLine }) {
  const { t } = useTranslation()
  const money = useMoney()
  const eur = (value: number) => money.amount(value, 'EUR', { maximumFractionDigits: 0 })
  const notable = Math.abs(line.gapPercent) >= NOTABLE_GAP
  const color = TIER_COLORS[line.tier]

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 text-[13px] sm:grid-cols-[12rem_minmax(0,1fr)_13rem]">
      <div className="col-start-1 row-start-1 flex min-w-0 flex-col">
        <span className="flex items-center gap-2 font-semibold">
          <Dot color={color} />
          {t(`analysis.tiers.${line.tier}`)}
        </span>
        {/* The target in euros beside the share: "-6.4 pts" is not something you can act on,
            "the target here is 71 000 €" is. */}
        <span className="pl-4.5 text-xs text-muted-foreground tabular-nums">
          {eur(line.valueEur)} · {t('analysis.targetAmount')} {eur(line.targetEur)}
        </span>
      </div>

      {/* Target sits as a marker on the actual bar rather than as a second bar: the question is
          "how far off am I", and two bars make the reader compute the difference themselves. */}
      <div className="relative col-span-2 row-start-2 h-3.5 rounded-full bg-muted sm:col-span-1 sm:col-start-2 sm:row-start-1">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width]"
          style={{ width: `${Math.min(100, line.actualPercent)}%`, backgroundColor: color }}
        />
        {line.targetPercent > 0 && (
          <div
            className="absolute -inset-y-1 w-0.5 bg-foreground"
            style={{ left: `${Math.min(100, line.targetPercent)}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="col-start-2 row-start-1 text-right tabular-nums sm:col-start-3">
        <span className="font-semibold">{formatPercent(line.actualPercent)}</span>{' '}
        <span className="text-muted-foreground">
          · {t('analysis.targetShort', { value: formatPercent(line.targetPercent, { fractionDigits: 0 }) })}
        </span>
        {notable && (
          // Over target is the exposure to watch; under target is room to fill, in ink. Blue stays for controls.
          <span className={cn('font-semibold', line.gapPercent > 0 ? 'text-warning' : 'text-foreground')}>
            {' · '}{line.gapPercent > 0 ? '+' : ''}{formatDecimal(line.gapPercent, 1)} {t('analysis.points')}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Observations the score cannot make.
 *
 * The score measures distance to targets the member chose, so a portfolio whose targets were set
 * to match it scores full marks however it is shaped. These come from the portfolio alone and
 * cannot be silenced by editing a target — which is the whole point of showing them beside the
 * number rather than folding them into it.
 */
function Alerts({ alerts }: { alerts: WealthAlert[] }) {
  const { t } = useTranslation()
  const money = useMoney()
  if (alerts.length === 0) return null

  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((alert) => (
        <li key={`${alert.code}-${alert.label ?? ''}`} className="flex gap-2.5 rounded-xl bg-muted px-3 py-2.5 text-[13px]">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            {t(`analysis.alerts.${alert.code}`, {
              label: alert.label ? t(`analysis.tiers.${alert.label}`, alert.label) : '',
              percent: formatPercent(alert.percent, { fractionDigits: 0 }),
              // The amount sits mid-sentence in the translation, so the mask has to be applied
              // to the interpolated value -- there is no element to intercept.
              value: money.amount(alert.valueEur),
            })}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** The base of the pyramid: measured in euros against an absolute target, not as a share. */
function SafetyNetBase({ safetyNet }: { safetyNet: SafetyNetLine }) {
  const { t } = useTranslation()
  // Coverage is capped for the bar only — the figure beside it still tells the truth.
  // Loose: an absent coverage arrives as undefined, and undefined * 100 is NaN.
  const coveragePercent = safetyNet.coverage == null ? 0 : Math.min(100, safetyNet.coverage * 100)

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted p-3 text-[13px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 font-semibold">
          <Dot color={TIER_COLORS.SAFETY_NET} />
          {t('analysis.score.safetyNet')}
        </span>
        <span className="tabular-nums">
          <CurrencyDisplay value={safetyNet.valueEur} className="font-semibold" />
          {safetyNet.known && (
            <span className="text-muted-foreground">
              {' '}{t('analysis.safetyNet.ofTarget')} <CurrencyDisplay value={safetyNet.targetEur ?? 0} />
            </span>
          )}
        </span>
      </div>

      {safetyNet.known ? (
        <>
          <Progress value={coveragePercent} className="h-1.5 bg-card" aria-label={t('analysis.score.safetyNet')} />
          <div className="flex flex-wrap items-center gap-2">
            {safetyNet.coverage != null && safetyNet.coverage < 1 && (
              <Badge variant="secondary" className={cn(BADGE, 'bg-card text-warning')}>
                {t('analysis.safetyNet.short', {
                  value: formatPercent(safetyNet.coverage * 100, { fractionDigits: 0 }),
                })}
              </Badge>
            )}
            {safetyNet.excessEur > 0 && (
              <Badge variant="secondary" className={cn(BADGE, 'bg-card text-foreground')}>
                <TrendingUp className="size-3" aria-hidden="true" />
                {t('analysis.safetyNet.excess')}
              </Badge>
            )}
            {safetyNet.coverage != null && safetyNet.coverage >= 1 && safetyNet.excessEur === 0 && (
              <Badge variant="secondary" className={cn(BADGE, 'bg-gain/10 text-gain')}>
                <Check className="size-3" aria-hidden="true" />
                {t('analysis.safetyNet.covered')}
              </Badge>
            )}
          </div>
          {safetyNet.excessEur > 0 && (
            <p className="text-muted-foreground">{t('analysis.safetyNet.excessHint')}</p>
          )}
        </>
      ) : (
        <p className="text-muted-foreground">{t('analysis.safetyNet.unknown')}</p>
      )}

      {safetyNet.dailyCashEur > 0 && (
        <p className="text-muted-foreground">
          {t('analysis.safetyNet.dailyCash')}{' '}
          <CurrencyDisplay value={safetyNet.dailyCashEur} className="text-foreground" />
          {', '}
          {t('analysis.safetyNet.dailyCashHint')}
        </p>
      )}
    </div>
  )
}

export function PyramidSection({ pyramid }: { pyramid: WealthPyramid }) {
  const { t } = useTranslation()
  const { safetyNet, score, alerts } = pyramid
  const tiers = [...pyramid.tiers].sort((a, b) => RISK_ORDER.indexOf(a.tier) - RISK_ORDER.indexOf(b.tier))

  return (
    <div className="flex flex-wrap gap-4">
      <Card className="min-w-0 flex-[4_1_18rem]">
        <CardHeader>
          <CardTitle>{t('analysis.score.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* No score rather than a flattering one: with nothing to allocate and no stated
              expenses there is nothing to judge, and the old fallback returned 100. */}
          {score.global == null && (
            <p className="text-sm text-muted-foreground">{t('analysis.score.notRatedYet')}</p>
          )}
          <div className="flex flex-wrap items-center gap-5">
            {score.global != null && <ScoreRing score={score.global} />}
            <dl className="flex min-w-40 flex-1 flex-col gap-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t('analysis.score.allocation')}</dt>
                <dd className="font-semibold tabular-nums">
                  {score.allocation == null ? t('analysis.score.notRated') : score.allocation}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t('analysis.score.safetyNet')}</dt>
                <dd className="font-semibold tabular-nums">
                  {safetyNet.known && safetyNet.score != null ? safetyNet.score : t('analysis.score.notRated')}
                </dd>
              </div>
              {score.cryptoPenalty > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t('analysis.score.cryptoPenalty')}</dt>
                  <dd className="font-semibold tabular-nums text-warning">−{formatDecimal(score.cryptoPenalty, 1)}</dd>
                </div>
              )}
              {score.leverageBonus > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t('analysis.score.leverageBonus')}</dt>
                  <dd className="font-semibold tabular-nums text-gain">+{formatDecimal(score.leverageBonus, 1)}</dd>
                </div>
              )}
              {score.allocation != null && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t('dashboard.health.misplaced')}</dt>
                  <dd className="font-semibold tabular-nums">{formatPercent(score.misplacedPercent)}</dd>
                </div>
              )}
            </dl>
          </div>

          <Alerts alerts={alerts} />

          {!safetyNet.known && (
            <p className="flex gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
              <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden="true" />
              {t('analysis.score.safetyNetUnknownHint')}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 flex-[8_1_32rem]">
        <CardHeader>
          <CardTitle>{t('analysis.pyramid.title')}</CardTitle>
          <CardDescription>{t('analysis.pyramid.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3.5">
            {tiers.map((line) => (
              <TierRow key={line.tier} line={line} />
            ))}
          </div>
          <SafetyNetBase safetyNet={safetyNet} />
        </CardContent>
      </Card>
    </div>
  )
}
