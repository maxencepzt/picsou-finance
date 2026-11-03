import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleAlert, Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SetupCardProps {
  /** A lucide icon or an `IntegrationMark`, shown in a tile above the title. */
  icon?: ReactNode
  eyebrow?: ReactNode
  title: string
  description?: ReactNode
  /** Main steps title the page (h1); the Enable Banking sub-steps keep an h2. */
  headingLevel?: 1 | 2
  /** Above the header, e.g. the sub-step progress. */
  top?: ReactNode
  children?: ReactNode
  /** Navigation row. Order children secondary first, primary last: the primary goes right on
   *  desktop and on top on phones. Give a back/skip button `sm:mr-auto` to push it left. */
  footer?: ReactNode
}

/** One wizard step: a flat card with its header, body and a navigation footer. */
export function SetupCard({ icon, eyebrow, title, description, headingLevel = 1, top, children, footer }: SetupCardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h1'
  return (
    <Card className="gap-0 py-0">
      {top && <div className="px-5 pt-5 sm:px-8 sm:pt-6">{top}</div>}
      <div className={cn('px-5 pt-6 sm:px-8 sm:pt-8', top && 'pt-4 sm:pt-5', !children && 'pb-6 sm:pb-8')}>
        <div className="min-w-0">
          {icon && (
            <span className="mb-4 grid size-10 place-items-center rounded-xl bg-muted text-foreground [&>svg]:size-5" aria-hidden="true">
              {icon}
            </span>
          )}
          {eyebrow && <div className="mb-1 text-[13px] font-medium text-muted-foreground">{eyebrow}</div>}
          <Heading className="text-xl leading-tight font-bold tracking-tight text-balance text-foreground sm:text-2xl">{title}</Heading>
          {description && <p className="mt-2 text-sm text-pretty text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children && <div className="space-y-5 px-5 py-6 sm:px-8 sm:pb-8">{children}</div>}
      {footer && (
        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
          {footer}
        </div>
      )}
    </Card>
  )
}

const NOTE_TONES = {
  info: { icon: Info, iconClass: 'text-muted-foreground', box: 'bg-muted' },
  warning: { icon: AlertTriangle, iconClass: 'text-warning', box: 'bg-warning/10' },
  success: { icon: CheckCircle2, iconClass: 'text-gain', box: 'bg-muted' },
  error: { icon: CircleAlert, iconClass: 'text-destructive', box: 'bg-destructive/10' },
} as const

/**
 * A tip, warning or result inside a step: an icon carries the tone, the text stays in ink so it
 * reads in both themes. With a title the body turns secondary.
 */
export function SetupNote({
  tone = 'info',
  title,
  children,
  role,
  className,
}: {
  tone?: keyof typeof NOTE_TONES
  title?: ReactNode
  children?: ReactNode
  role?: 'alert' | 'status' | 'note'
  className?: string
}) {
  const { icon: Icon, iconClass, box } = NOTE_TONES[tone]
  return (
    <div role={role} className={cn('flex items-start gap-3 rounded-xl px-4 py-3 text-sm', box, className)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-medium text-foreground">{title}</p>}
        {children && <div className={title ? 'text-[13px] leading-5 text-muted-foreground' : 'text-foreground'}>{children}</div>}
      </div>
    </div>
  )
}
