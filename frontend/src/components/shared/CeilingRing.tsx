import { useTranslation } from 'react-i18next'
import { Check, TriangleAlert } from 'lucide-react'
import { useMoney } from '@/hooks/use-money'
import { useCeilingLabel } from '@/hooks/use-ceiling-label'
import type { CeilingUsage } from '@/lib/ceiling'
import { cn, formatPercent, localeFromLanguage } from '@/lib/utils'

// A fill is not a movement: blue while there is room, amber from 80 %, ink once full.
const ARC_CLASS: Record<CeilingUsage['state'], string> = {
  ok: 'stroke-primary',
  warning: 'stroke-warning',
  full: 'stroke-foreground',
}

const SIZES = {
  sm: { px: 16, stroke: 5 },
  lg: { px: 64, stroke: 3.4 },
}

/**
 * A radial meter of how far an account is into its ceiling. `sm` is the discreet mark of an
 * account row, `lg` the hero gauge with the percentage in its centre.
 */
export function CeilingRing({ usage, size = 'sm', label, className }: {
  usage: CeilingUsage
  size?: keyof typeof SIZES
  label: string
  className?: string
}) {
  const { i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const { px, stroke } = SIZES[size]
  // r chosen so the circumference is 100: the dash length is the percentage itself.
  const r = 100 / (2 * Math.PI)
  const box = 2 * r + stroke
  const shown = Math.min(100, usage.pct)
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(shown)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: px, height: px }}
    >
      <svg viewBox={`0 0 ${box} ${box}`} width={px} height={px} className="-rotate-90" aria-hidden>
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" strokeWidth={stroke} className={size === 'sm' ? 'stroke-foreground/20' : 'stroke-foreground/12'} />
        {shown > 0 && (
          <circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            // A round cap on a 16 px ring reads as a loading spinner; the small ring keeps square ends.
            strokeLinecap={size === 'lg' && shown < 100 ? 'round' : 'butt'}
            strokeDasharray={`${shown} 100`}
            className={cn(ARC_CLASS[usage.state], 'transition-[stroke-dasharray] duration-500')}
          />
        )}
      </svg>
      {size === 'lg' && (
        <span className="absolute text-sm font-semibold tabular-nums text-foreground" aria-hidden>
          {formatPercent(usage.pct, { fractionDigits: 0 }, locale)}
        </span>
      )}
    </span>
  )
}

/** The hero gauge of an account page: the ring, what is used of what, and the room left. */
export function CeilingGauge({ usage }: { usage: CeilingUsage }) {
  const { t } = useTranslation()
  const money = useMoney()
  const label = useCeilingLabel(usage)
  return (
    <div className="col-span-2 flex min-w-0 flex-col gap-1.5">
      <dt className="text-[13px] font-medium text-muted-foreground">
        {t(usage.kind === 'deposits' ? 'accounts.ceiling.deposits' : 'accounts.detail.ceiling')}
      </dt>
      <dd className="flex min-w-0 items-center gap-3">
        <CeilingRing usage={usage} size="lg" label={label} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold tabular-nums text-foreground">
            {t('accounts.ceiling.usedOf', { used: money.amount(usage.used), ceiling: money.amount(usage.ceiling) })}
          </span>
          {usage.state === 'full' ? (
            <span className="flex items-center gap-1 text-xs font-medium text-foreground">
              <Check className="size-3.5 shrink-0" aria-hidden />
              {t('accounts.ceiling.reached')}
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              {usage.state === 'warning' && <TriangleAlert className="size-3.5 shrink-0 text-warning" aria-hidden />}
              {t('common.labelColon', { label: t('accounts.ceiling.remaining') })}
              <span className="font-medium tabular-nums text-foreground">{money.amount(usage.remaining)}</span>
            </span>
          )}
        </span>
      </dd>
    </div>
  )
}
