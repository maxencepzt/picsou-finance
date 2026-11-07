import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** A flat settings card: small bold title, description, an optional header control, then rows. */
export function SettingsCard({
  title,
  description,
  action,
  children,
  footer,
}: {
  title: ReactNode
  description?: ReactNode
  /** Header right: a status or a single button. */
  action?: ReactNode
  children?: ReactNode
  /** Save row, separated by a hairline. */
  footer?: ReactNode
}) {
  return (
    <Card className="gap-0 py-0">
      {/* The action drops under the text on phones, so a long title never gets squeezed. */}
      <CardHeader className="flex flex-col gap-3 px-5 pt-5 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
      {children && <CardContent className="divide-y divide-border px-5 pb-1 *:first:pt-1">{children}</CardContent>}
      {footer && (
        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          {footer}
        </div>
      )}
    </Card>
  )
}

/**
 * One setting: label and description on the left, the control on the right. `stacked` puts a
 * wide control (a list, a text area) under its label instead; `toggle` keeps a switch or a
 * button at its own width, where a field takes a fixed column.
 */
export function SettingRow({
  label,
  htmlFor,
  description,
  children,
  stacked,
  toggle,
}: {
  label: ReactNode
  htmlFor?: string
  description?: ReactNode
  children?: ReactNode
  stacked?: boolean
  toggle?: boolean
}) {
  return (
    <div
      className={cn(
        'flex gap-3 py-4',
        toggle ? 'items-center justify-between gap-6' : 'flex-col',
        !stacked && !toggle && 'sm:flex-row sm:items-center sm:justify-between sm:gap-6',
      )}
    >
      <div className="min-w-0 space-y-1">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="leading-5">{label}</Label>
        ) : (
          <p className="text-sm leading-5 font-medium text-foreground">{label}</p>
        )}
        {description && <p className="text-[13px] leading-5 text-pretty text-muted-foreground">{description}</p>}
      </div>
      {children && <div className={cn('min-w-0', toggle ? 'shrink-0' : !stacked && 'sm:w-[22rem] sm:shrink-0')}>{children}</div>}
    </div>
  )
}

const TONES = {
  ok: { dot: 'bg-gain', text: 'text-gain' },
  warn: { dot: 'bg-warning', text: 'text-warning' },
  error: { dot: 'bg-destructive', text: 'text-destructive' },
  neutral: { dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
} as const

export type StatusTone = keyof typeof TONES

/** A status as a small dot and a word in the movement colour, never as a filled badge. */
export function StatusText({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap', TONES[tone].text, className)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', TONES[tone].dot)} aria-hidden="true" />
      {children}
    </span>
  )
}
