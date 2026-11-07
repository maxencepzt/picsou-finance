import type { ReactNode } from 'react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Compact action button of a setting row: 32px, 40px on touch screens. */
export const ROW_BUTTON = 'h-8 px-3 pointer-coarse:h-10'

/** A flat settings card: optional small-bold title, then rows split by hairlines. */
export function SettingsCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={className}>
      {(title || action) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className="@container divide-y divide-border">{children}</CardContent>
    </Card>
  )
}

/**
 * One setting: label and a one-line description on the left, the control on the right.
 * When the card is narrow (phones) the control drops under the label.
 */
export function SettingRow({
  label,
  description,
  htmlFor,
  className,
  children,
}: {
  label: ReactNode
  description?: ReactNode
  /** Id of the control, so the label names it. */
  htmlFor?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 py-3 first:pt-0 last:pb-0 @md:flex-row @md:items-center @md:justify-between @md:gap-6',
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-sm font-medium">{label}</Label>
        ) : (
          <div className="text-sm font-medium text-foreground">{label}</div>
        )}
        {description && <p className="text-[13px] text-pretty text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex min-w-0 flex-wrap items-center gap-2 @md:shrink-0 @md:justify-end">{children}</div>}
    </div>
  )
}

/** A status word with its dot: gain when on, warning when it needs a look, slate otherwise. */
export function StatusDot({ tone, children }: { tone: 'on' | 'warn' | 'off' | 'bad'; children: ReactNode }) {
  const dot = { on: 'bg-gain', warn: 'bg-warning', off: 'bg-muted-foreground', bad: 'bg-loss' }[tone]
  const text = { on: 'text-gain', warn: 'text-warning', off: 'text-muted-foreground', bad: 'text-loss' }[tone]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', text)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', dot)} aria-hidden="true" />
      {children}
    </span>
  )
}
