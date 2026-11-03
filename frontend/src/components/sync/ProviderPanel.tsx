import { Children, Fragment, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { AlertTriangle, FileCheck2, Loader2, LogOut, Upload, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { cn } from '@/lib/utils'
import { PANEL_ACTION } from './panel-styles'

/**
 * The building blocks every provider body is made of, so the Sync page, the add-account modal
 * and the setup wizard show one family: status, intro, error, form or step, actions.
 */

export type PanelTone = 'ok' | 'idle' | 'busy' | 'warning' | 'error'

const DOT_CLASS: Record<Exclude<PanelTone, 'busy'>, string> = {
  ok: 'bg-gain',
  idle: 'bg-muted-foreground/50',
  warning: 'bg-warning',
  error: 'bg-loss',
}

const TEXT_CLASS: Record<PanelTone, string> = {
  ok: 'text-gain',
  idle: 'text-muted-foreground',
  busy: 'text-muted-foreground',
  warning: 'text-warning',
  error: 'text-loss',
}

/** A dot (a spinner while busy) in a fixed 14px box, so the label never shifts. */
function StatusMark({ tone }: { tone: PanelTone }) {
  return (
    <span className="grid size-3.5 shrink-0 place-items-center" aria-hidden>
      {tone === 'busy' ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      ) : (
        <span className={cn('size-2 rounded-full', DOT_CLASS[tone])} />
      )}
    </span>
  )
}

/** A row's state in words with its dot: "Connected", "Expired"… never a filled badge. */
export function ConnectionState({ tone, children }: { tone: PanelTone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-xs font-medium', TEXT_CLASS[tone])}>
      <StatusMark tone={tone} />
      {children}
    </span>
  )
}

interface PanelStatusProps {
  tone: PanelTone
  label: string
  /** Facts under the label (last sync, masked token…), separated by middots. */
  meta?: ReactNode[]
  /** Secondary first, primary last: the primary ends up on the right, on top on a phone. */
  actions?: ReactNode
  /** Lines under the status: the outcome of the last sync, contracts left out. */
  children?: ReactNode
}

/** The connection state. A bare line while there is nothing to act on, a card once there is. */
export function PanelStatus({ tone, label, meta, actions, children }: PanelStatusProps) {
  const facts = (meta ?? []).filter(Boolean)
  const head = (
    <div className="min-w-0 flex-1 space-y-1">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <StatusMark tone={tone} />
        {label}
      </p>
      {facts.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-5.5 text-xs text-muted-foreground">
          {facts.map((fact, index) => (
            <Fragment key={index}>
              {index > 0 && <span aria-hidden>·</span>}
              <span>{fact}</span>
            </Fragment>
          ))}
        </p>
      )}
    </div>
  )
  // `{cond && <p/>}` children leave `false` entries: count what actually renders.
  const hasChildren = Children.toArray(children).length > 0
  if (!actions && !hasChildren) return <div className="px-1">{head}</div>
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {head}
          {actions && <div className="flex flex-col-reverse gap-2 sm:shrink-0 sm:flex-row">{actions}</div>}
        </div>
        {hasChildren && <div className="space-y-2 border-t border-border/60 pt-3 pl-5.5 text-sm">{children}</div>}
      </CardContent>
    </Card>
  )
}

/** One or two muted lines on what the provider syncs. */
export function PanelIntro({ children }: { children: ReactNode }) {
  return <p className="px-1 text-sm text-pretty text-muted-foreground">{children}</p>
}

/** A failure, worded for the user, with the way out next to it. */
export function PanelError({
  children,
  onRetry,
  retryLabel,
}: {
  children: ReactNode
  onRetry?: () => void
  retryLabel?: string
}) {
  const { t } = useTranslation()
  return (
    <AlertBanner
      variant="roomy"
      role="alert"
      className="items-start rounded-xl"
      icon={<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />}
      action={
        onRetry && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="-my-1.5 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRetry}
          >
            {retryLabel ?? t('common.retry')}
          </Button>
        )
      }
    >
      {children}
    </AlertBanner>
  )
}

interface PanelStepHeaderProps {
  icon: LucideIcon
  title: ReactNode
  hint?: ReactNode
  /** A spinner on the right: the step is waiting on something outside the page. */
  busy?: boolean
}

/** The heading of a step: an icon tile, what to do, and how. */
function PanelStepHeader({ icon: Icon, title, hint, busy }: PanelStepHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
        <p className="text-sm font-semibold text-pretty text-foreground">{title}</p>
        {hint && <p className="text-xs text-pretty text-muted-foreground">{hint}</p>}
      </div>
      {busy && <Loader2 className="mt-2.5 size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
    </div>
  )
}

/** Secondary first, primary last: right-aligned on a wide screen, stacked full width on a phone. */
export function PanelActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}>{children}</div>
}

interface PanelFormProps {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  /** A heading for a step form (second factor, confirmation code). */
  step?: PanelStepHeaderProps
  children: ReactNode
  actions: ReactNode
  className?: string
  /** No card: the form already sits in one (a dialog, a wizard step). */
  bare?: boolean
}

/** A form in a card: labelled fields, then the actions. */
export function PanelForm({ onSubmit, step, children, actions, className, bare = false }: PanelFormProps) {
  const body = (
    <>
      {step && <PanelStepHeader {...step} />}
      {children}
      <PanelActions>{actions}</PanelActions>
    </>
  )
  if (bare) return <form onSubmit={onSubmit} className={cn('space-y-4', className)}>{body}</form>
  return (
    <form onSubmit={onSubmit} className={className}>
      <Card size="sm">
        <CardContent className="space-y-4">{body}</CardContent>
      </Card>
    </form>
  )
}

/** A step with nothing to type: the user acts on their phone, the page waits. */
export function PanelWaiting({ children, ...header }: Omit<PanelStepHeaderProps, 'busy'> & { children?: ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-3" aria-live="polite">
        <PanelStepHeader {...header} busy />
        {children && <div className="pl-12 text-xs text-muted-foreground">{children}</div>}
      </CardContent>
    </Card>
  )
}

interface PanelFieldProps {
  id: string
  label: ReactNode
  icon?: LucideIcon
  /** Helper text under the control. */
  hint?: ReactNode
  children: ReactNode
  className?: string
}

/** A visible label, the control, then its helper text. */
export function PanelField({ id, label, icon: Icon, hint, children, className }: PanelFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>
        {Icon && <Icon className="size-3.5 text-muted-foreground" aria-hidden />}
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-pretty text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function PanelLoading() {
  const { t } = useTranslation()
  return (
    <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {t('common.loading')}
    </p>
  )
}

interface PanelDisconnectProps {
  /** The trigger's label, also the confirm button's unless `confirmLabel` is given. */
  label: string
  /** Provider name for the dialog title. */
  provider: string
  description?: string
  confirmLabel?: string
  pending?: boolean
  disabled?: boolean
  onConfirm: () => void
}

/** Disconnect behind a confirmation: losing a session costs a new login and second factor. */
export function PanelDisconnect({
  label,
  provider,
  description,
  confirmLabel,
  pending = false,
  disabled = false,
  onConfirm,
}: PanelDisconnectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="xs"
        className={PANEL_ACTION}
        disabled={pending || disabled}
        onClick={() => setOpen(true)}
      >
        <LogOut />
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('sync.panel.disconnectTitle', { name: provider })}
        description={description ?? t('sync.panel.disconnectDescription')}
        confirmLabel={confirmLabel ?? label}
        loading={pending}
        onConfirm={() => {
          // The panel reports the outcome (error banner, form back); the dialog's job is done.
          setOpen(false)
          onConfirm()
        }}
      />
    </>
  )
}

interface FileDropZoneProps {
  title: string
  hint: string
  buttonLabel: string
  accept: string
  /** Accessible name of the file input, which uploads and tests go through. */
  inputLabel?: string
  /** The chosen file, shown in the zone once picked. */
  fileName?: string | null
  disabled?: boolean
  onFile: (file: File) => void
  compact?: boolean
}

/** The one drop zone of the file imports (Finary, Actual Budget, HomeBank). */
export function FileDropZone({
  title,
  hint,
  buttonLabel,
  accept,
  inputLabel,
  fileName,
  disabled = false,
  onFile,
  compact = false,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function take(file: File | undefined) {
    if (file && !disabled) onFile(file)
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed text-center transition-[border-color,background-color]',
        compact ? 'px-4 py-6' : 'px-6 py-8',
        dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30',
      )}
      onDragOver={(event) => {
        event.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragOver(false)
        take(event.dataTransfer.files?.[0])
      }}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-muted text-foreground">
        <Upload className="size-4" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-pretty text-muted-foreground">{hint}</p>
      </div>
      {fileName && (
        <p className="flex max-w-full items-center gap-1.5 text-sm font-medium text-foreground">
          <FileCheck2 className="size-4 shrink-0 text-gain" aria-hidden />
          <span className="truncate">{fileName}</span>
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="pointer-coarse:h-10"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        <Upload />
        {buttonLabel}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        aria-label={inputLabel}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          take(event.target.files?.[0])
          // Cleared so picking the same file again still fires a change.
          event.target.value = ''
        }}
      />
    </div>
  )
}

/** A titled card of rows (preview of an import): the section title, then rows split by hairlines. */
export function PanelSection({
  title,
  aside,
  children,
}: {
  title: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-1">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {aside != null && <div className="shrink-0 text-xs text-muted-foreground tabular-nums">{aside}</div>}
        </div>
        <div className="divide-y divide-border/60">{children}</div>
      </CardContent>
    </Card>
  )
}

/** A figure of an import's outcome. */
export function PanelStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/60 px-4 py-3">
      <p className="text-xl font-semibold text-foreground tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
