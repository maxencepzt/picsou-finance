import { useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useMoney } from '@/hooks/use-money'
import { cn, formatPercent } from '@/lib/utils'
import {
  DEFAULT_RETURN,
  DEFAULT_WITHDRAWAL,
  MAX_YEARS,
  capitalAfter,
  fiTarget,
  snap,
  yearsToTarget,
  type FiBaseline,
} from './fi-math'

const BADGE = 'h-[22px] px-2 text-xs font-semibold'

/** [min, max, step] of each hypothesis. */
const BOUNDS = {
  savings: [0, 3000, 50],
  rate: [0, 10, 0.5],
  expenses: [1000, 5000, 50],
  withdrawal: [2.5, 5, 0.25],
} as const

type Hypotheses = Record<keyof typeof BOUNDS, number>

/**
 * `.range-input` (index.css) paints the filled track from `--range-fill`; these utilities give it
 * the design system's heavier 6px track and 20px ink thumb.
 */
const SLIDER = cn(
  'range-input h-6 w-full',
  '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:size-5',
  '[&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_var(--card)]',
  '[&::-moz-range-track]:h-1.5 [&::-moz-range-progress]:h-1.5 [&::-moz-range-thumb]:size-5',
  '[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:shadow-[0_0_0_4px_var(--card)]',
)

/** "At 61", or "In 27 years" without a birth date; the two ends say so in words. */
function When({ years, age }: { years: number | null; age: number | null }) {
  const { t } = useTranslation()
  if (years === 0) return t('analysis.fi.reached')
  if (years == null) {
    return age == null
      ? t('analysis.fi.beyondYears', { count: MAX_YEARS })
      : t('analysis.fi.beyondAge', { age: age + MAX_YEARS })
  }
  return age == null ? t('analysis.fi.inYears', { count: years }) : t('analysis.projection.atAge', { age: age + years })
}

function Meta({ children }: { children: ReactNode }) {
  return <div className="text-[13px] font-medium text-muted-foreground">{children}</div>
}

/** Where the member stands today against the capital that would cover their essential expenses. */
export function FinancialIndependenceCard({ baseline, className }: { baseline: FiBaseline; className?: string }) {
  const { t } = useTranslation()
  const money = useMoney()
  const [thisYear] = useState(() => new Date().getFullYear())
  const eur = (value: number) => money.amount(value, 'EUR', { maximumFractionDigits: 0 })

  const { start, pace, expenses, age, retirementAge } = baseline
  const rate = formatPercent(DEFAULT_WITHDRAWAL, { fractionDigits: 0 })
  const target = fiTarget(expenses, DEFAULT_WITHDRAWAL)
  const years = yearsToTarget(start, pace, DEFAULT_RETURN, target)
  const progress = Math.min(100, (start / target) * 100)

  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader>
        <CardTitle>{t('analysis.fi.title')}</CardTitle>
        <CardAction>
          <Badge variant="secondary" className={cn(BADGE, 'bg-primary/12 text-foreground')}>
            {t('analysis.fi.rule', { value: rate })}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <Meta>{t('analysis.fi.target')}</Meta>
          <div className="text-3xl font-bold tracking-tight tabular-nums">{eur(target)}</div>
          <p className="text-xs text-muted-foreground">
            {t('analysis.fi.formula', { expenses: eur(expenses), rate })}
          </p>
          {!baseline.expensesStated && (
            <p className="mt-1 text-xs text-muted-foreground">{t('analysis.fi.expensesDefault')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-2 text-[13px]">
            <span className="font-semibold">{t('analysis.fi.assets')}</span>
            <span className="tabular-nums">{eur(start)}</span>
          </div>
          <Progress value={progress} className="h-1.5" aria-label={t('analysis.fi.assets')} />
          <span className="text-xs text-muted-foreground">
            {t('analysis.fi.progress', { value: formatPercent(progress) })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted p-3">
          <div className="min-w-0">
            <Meta>{t(age == null ? 'analysis.fi.estimatedWhen' : 'analysis.fi.estimatedAge')}</Meta>
            <div className="text-xl font-semibold tabular-nums"><When years={years} age={age} /></div>
            <div className="text-xs text-muted-foreground">
              {years != null && years > 0
                ? t('analysis.fi.paceYear', { year: thisYear + years })
                : t('analysis.fi.pace')}
            </div>
          </div>
          <div className="min-w-0">
            <Meta>{t('analysis.fi.retirement')}</Meta>
            <div className="text-xl font-semibold tabular-nums">
              {retirementAge == null ? '—' : t('analysis.projection.atAge', { age: retirementAge })}
            </div>
            {retirementAge == null && <div className="text-xs text-muted-foreground">{t('analysis.fi.notSet')}</div>}
          </div>
        </div>

        {age == null && (
          <p className="text-xs text-muted-foreground">
            {t('analysis.fi.fillProfile')}{' '}
            <Link to="/settings" className="font-medium text-primary hover:text-foreground">
              {t('analysis.fi.goToProfile')}
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface HypothesisProps {
  id: string
  label: string
  hint: string
  /** The value, written large beside the label. */
  display: string
  value: number
  bounds: readonly [number, number, number]
  /** Formats the two bounds under the track. */
  format: (value: number) => string
  onChange: (value: number) => void
  children?: ReactNode
}

function Hypothesis({ id, label, hint, display, value, bounds: [min, max, step], format, onChange, children }: HypothesisProps) {
  const fill = ((value - min) / (max - min)) * 100
  return (
    <div className="flex flex-col gap-2 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="flex min-w-0 flex-col">
          <span className="font-semibold">{label}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </label>
        <span className="shrink-0 text-xl font-semibold tracking-tight tabular-nums">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={display}
        className={SLIDER}
        style={{ '--range-fill': `${fill}%` } as CSSProperties}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
      {children}
    </div>
  )
}

function ComparisonBar({ label, value, width, marker, strong }: {
  label: string
  value: ReactNode
  width: number
  marker: number | null
  strong?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2 text-[13px]">
        <span className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
        <span className={cn('shrink-0 tabular-nums', strong ? 'font-bold' : 'font-semibold text-muted-foreground')}>{value}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-card" aria-hidden="true">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-[width]', strong ? 'bg-primary' : 'bg-muted-foreground')}
          style={{ width: `${width}%` }}
        />
        {marker != null && <div className="absolute -inset-y-1 w-0.5 bg-foreground" style={{ left: `${marker}%` }} />}
      </div>
    </div>
  )
}

/** Moves one hypothesis at a time and recomputes the age of financial independence on the spot. */
export function FinancialIndependenceSimulator({ baseline }: { baseline: FiBaseline }) {
  const { t } = useTranslation()
  const money = useMoney()
  const [thisYear] = useState(() => new Date().getFullYear())
  // Overrides on top of the baseline rather than a copy of it: the profile and budget arrive
  // asynchronously, and the untouched hypotheses must follow them.
  const [overrides, setOverrides] = useState<Partial<Hypotheses>>({})
  const eur = (value: number) => money.amount(value, 'EUR', { maximumFractionDigits: 0 })
  const perMonth = (value: number) => t('analysis.fi.sim.perMonth', { value: eur(value) })
  const percent = (value: number) => formatPercent(value, { fractionDigits: Number.isInteger(value * 2) ? 1 : 2 })

  const { start, pace, age, retirementAge: retire } = baseline
  const defaults: Hypotheses = {
    savings: snap(pace, ...BOUNDS.savings),
    rate: DEFAULT_RETURN,
    expenses: snap(baseline.expenses, ...BOUNDS.expenses),
    withdrawal: DEFAULT_WITHDRAWAL,
  }
  const h = { ...defaults, ...overrides }
  const set = (key: keyof Hypotheses) => (value: number) => setOverrides((o) => ({ ...o, [key]: value }))

  const target = fiTarget(h.expenses, h.withdrawal)
  const simYears = yearsToTarget(start, h.savings, h.rate, target)
  const baseYears = yearsToTarget(start, pace, h.rate, target)
  const delta = simYears != null && baseYears != null ? baseYears - simYears : null

  // The bars share one time axis, in years from today, long enough to show the retirement marker.
  const span = Math.max(10, age == null ? 40 : Math.max(70, (retire ?? 0) + 5) - age)
  const width = (years: number | null) => (years == null ? 100 : Math.min(100, (years / span) * 100))
  const retireYears = age != null && retire != null && retire > age ? retire - age : null
  const marker = retireYears == null ? null : Math.min(100, (retireYears / span) * 100)

  const presets = [...new Set([defaults.savings, 500, 1000, 1500, 2000])].sort((a, b) => a - b)
  const extra = h.savings - pace
  const extraLabel = `${extra > 0 ? '+' : extra < 0 ? '-' : ''}${eur(Math.abs(extra))}`

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t('analysis.fi.sim.title')}</CardTitle>
        <CardDescription>{t('analysis.fi.sim.description')}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" className="px-4" onClick={() => setOverrides({})} disabled={Object.keys(overrides).length === 0}>
            {t('analysis.fi.sim.reset')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-x-10 gap-y-6">
        <div className="flex min-w-0 flex-[3_1_26rem] flex-col">
          <Hypothesis
            id="fi-savings"
            label={t('analysis.fi.sim.savings')}
            hint={t('analysis.fi.sim.savingsHint', { value: eur(pace) })}
            display={perMonth(h.savings)}
            value={h.savings}
            bounds={BOUNDS.savings}
            format={eur}
            onChange={set('savings')}
          >
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('analysis.fi.sim.presets')}>
              {presets.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={value === h.savings}
                  onClick={() => set('savings')(value)}
                  className="h-8 rounded-md px-3 text-xs font-semibold tabular-nums text-muted-foreground ring-1 ring-border transition-[background-color,color] hover:text-foreground aria-pressed:bg-primary/12 aria-pressed:text-foreground aria-pressed:ring-primary"
                >
                  {value === defaults.savings ? t('analysis.fi.sim.todayPreset', { value: eur(value) }) : eur(value)}
                </button>
              ))}
            </div>
          </Hypothesis>
          <Hypothesis
            id="fi-rate"
            label={t('analysis.fi.sim.return')}
            hint={t('analysis.fi.sim.returnHint')}
            display={percent(h.rate)}
            value={h.rate}
            bounds={BOUNDS.rate}
            format={(value) => formatPercent(value, { fractionDigits: 0 })}
            onChange={set('rate')}
          />
          <Hypothesis
            id="fi-expenses"
            label={t('analysis.fi.sim.expenses')}
            hint={baseline.expensesStated
              ? t('analysis.fi.sim.expensesHint', { value: eur(baseline.expenses) })
              : t('analysis.fi.sim.expensesDefault')}
            display={perMonth(h.expenses)}
            value={h.expenses}
            bounds={BOUNDS.expenses}
            format={eur}
            onChange={set('expenses')}
          />
          <Hypothesis
            id="fi-withdrawal"
            label={t('analysis.fi.sim.withdrawal')}
            hint={t('analysis.fi.sim.withdrawalHint')}
            display={percent(h.withdrawal)}
            value={h.withdrawal}
            bounds={BOUNDS.withdrawal}
            format={percent}
            onChange={set('withdrawal')}
          />
        </div>

        <div className="flex min-w-0 flex-[2_1_20rem] flex-col gap-5 rounded-2xl bg-muted p-5" aria-live="polite">
          <div className="flex flex-col gap-1.5">
            <Meta>{t('analysis.fi.title')}</Meta>
            <div className="flex flex-wrap items-baseline gap-x-2.5">
              <span className="text-4xl font-bold tracking-tight tabular-nums"><When years={simYears} age={age} /></span>
              {simYears != null && simYears > 0 && (
                <span className="text-[15px] text-muted-foreground">{t('analysis.fi.inYear', { year: thisYear + simYears })}</span>
              )}
            </div>
            {delta != null && (
              <Badge
                variant="secondary"
                className={cn(BADGE, delta > 0 && 'bg-gain/10 text-gain', delta < 0 && 'bg-loss/10 text-loss', delta === 0 && 'bg-card')}
              >
                {delta > 0
                  ? t('analysis.fi.sim.earlier', { count: delta })
                  : delta < 0
                    ? t('analysis.fi.sim.later', { count: -delta })
                    : t('analysis.fi.sim.same')}
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <ComparisonBar
              strong
              label={t('analysis.fi.sim.withHypotheses')}
              value={<When years={simYears} age={age} />}
              width={width(simYears)}
              marker={marker}
            />
            <ComparisonBar
              label={t('analysis.fi.sim.currentPace', { value: eur(pace) })}
              value={<When years={baseYears} age={age} />}
              width={width(baseYears)}
              marker={marker}
            />
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {age == null ? t('common.today') : `${t('common.today')} · ${t('analysis.projection.atAge', { age })}`}
              </span>
              {retireYears != null && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-0.5 bg-foreground" aria-hidden="true" />
                  {`${t('analysis.fi.retirement')} · ${t('analysis.projection.atAge', { age: retire })}`}
                </span>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-3 border-t border-border pt-4">
            <div>
              <dt><Meta>{t('analysis.fi.target')}</Meta></dt>
              <dd className="font-bold tabular-nums">{eur(target)}</dd>
            </div>
            {retireYears != null && (
              <div>
                <dt><Meta>{t('analysis.fi.sim.capitalAt', { age: retire })}</Meta></dt>
                <dd className="font-bold tabular-nums">{eur(capitalAfter(start, h.savings, h.rate, retireYears))}</dd>
              </div>
            )}
            <div>
              <dt><Meta>{t('analysis.fi.sim.extraEffort')}</Meta></dt>
              <dd className="font-bold tabular-nums">{t('analysis.fi.sim.perMonth', { value: extraLabel })}</dd>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  )
}
