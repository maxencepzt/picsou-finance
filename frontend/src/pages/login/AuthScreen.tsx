import type { ReactNode } from 'react'
import picsouLogo from '@/assets/horizontal-white-picsou.svg'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** A checkbox with its label and an optional caption (remember me, trust this device…). */
export function CheckboxRow({
  id,
  checked,
  onCheckedChange,
  label,
  description,
  invalid,
  describedBy,
}: {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  invalid?: boolean
  describedBy?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="mt-0.5"
      />
      <div className="grid gap-1">
        <Label htmlFor={id} className="cursor-pointer leading-5">{label}</Label>
        {description && <p className="text-[13px] leading-5 text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

interface AuthScreenProps {
  title: ReactNode
  description?: ReactNode
  /** A lucide icon shown in a small tile above the title. */
  icon?: ReactNode
  children?: ReactNode
  /** Links under the card (back to sign-in…). */
  footer?: ReactNode
  /** The consent screen lists scopes and needs more room than a sign-in form. */
  wide?: boolean
}

/**
 * The calm centred card every signed-out screen shares (sign-in, 2FA, activation, consent):
 * the Picsou logo, one card on the graphite canvas, then the footer links.
 */
export function AuthScreen({ title, description, icon, children, footer, wide }: AuthScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10 sm:py-16">
      <main className={cn('w-full', wide ? 'max-w-xl' : 'max-w-sm')}>
        <img src={picsouLogo} alt="Picsou" className="mx-auto mb-8 h-7 w-auto brightness-0 dark:invert" />
        <Card className="gap-6 px-6 py-7 sm:px-8">
          <header className="flex flex-col items-center gap-1.5 text-center">
            {icon && (
              <span className="mb-2 grid size-10 place-items-center rounded-xl bg-muted text-foreground [&_svg]:size-5" aria-hidden="true">
                {icon}
              </span>
            )}
            <h1 className="text-xl font-bold tracking-tight text-balance text-foreground">{title}</h1>
            {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
          </header>
          {children}
        </Card>
        {footer && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {footer}
          </div>
        )}
      </main>
    </div>
  )
}
