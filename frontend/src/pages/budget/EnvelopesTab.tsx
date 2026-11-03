import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/shared/NumericInput'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useBudgets,
  useCategories,
  useCreateBudget,
  useDeleteBudget,
  useUpdateBudget,
} from '@/features/budget/hooks'
import { cn, formatPercent, parseAmount } from '@/lib/utils'
import { useMoney } from '@/hooks/use-money'
import type { Budget } from '@/types/api'
import { ColorDot } from './budget-utils'

function EnvelopeForm({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Budget | null
}) {
  const { t } = useTranslation()
  const { data: categories } = useCategories()
  const { data: budgets } = useBudgets()
  const createBudget = useCreateBudget()
  const updateBudget = useUpdateBudget()

  // Lazy init keeps these correct on (re)open via the key-remount below.
  const [categoryId, setCategoryId] = useState<number | ''>(editing?.categoryId ?? '')
  const [limit, setLimit] = useState<string>(editing ? String(editing.monthlyLimit) : '')

  // Only expense categories can hold an envelope, and (when creating) only those
  // not already budgeted.
  const budgetedIds = new Set((budgets ?? []).map((b) => b.categoryId))
  const options = (categories ?? [])
    .filter((c) => c.kind === 'EXPENSE' && !c.archived)
    .filter((c) => editing != null ? c.id === editing.categoryId : !budgetedIds.has(c.id))

  const pending = createBudget.isPending || updateBudget.isPending

  function submit() {
    if (categoryId === '' || limit.trim() === '') return
    const payload = { categoryId: Number(categoryId), monthlyLimit: parseAmount(limit) }
    const onDone = { onSuccess: () => onOpenChange(false) }
    if (editing) updateBudget.mutate({ id: editing.id, data: payload }, onDone)
    else createBudget.mutate(payload, onDone)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? t('budget.envelope.edit') : t('budget.envelope.add')}
          </DialogTitle>
          <DialogDescription>{t('budget.envelope.formHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="env-cat">{t('budget.envelope.category')}</Label>
            <NativeSelect
              id="env-cat"
              value={categoryId}
              disabled={editing != null}
              onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">{t('budget.envelope.selectCategory')}</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="env-limit">{t('budget.envelope.monthlyLimit')}</Label>
            <NumericInput id="env-limit" value={limit}
              onChange={(e) => setLimit(e.target.value)} placeholder="400" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={pending || categoryId === '' || limit.trim() === ''}>
            {pending ? t('common.loading') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** One envelope: the overview's row (spent / limit, a bar amber from 80 %, loss past 100 %) plus edit and delete. */
function EnvelopeRow({ budget, onEdit, onDelete }: {
  budget: Budget
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const money = useMoney()
  const pct = Math.min(budget.percent, 100)
  const percent = formatPercent(budget.percent, { fractionDigits: 0 })
  const barTone = budget.overBudget
    ? 'bg-loss'
    : budget.percent >= 80 ? 'bg-warning' : 'bg-primary'

  return (
    <li className="group flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/50">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px]">
          <span className="flex min-w-0 items-center gap-2">
            <ColorDot color={budget.categoryColor} />
            <span className="truncate font-semibold">{budget.categoryName}</span>
            {budget.rollup && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {t('budget.envelope.includesSubcategories')}
              </span>
            )}
          </span>
          <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
            <CurrencyDisplay value={budget.spent} className="font-semibold text-foreground" />
            {' / '}
            <CurrencyDisplay value={budget.monthlyLimit} />
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar" aria-label={budget.categoryName}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
          aria-valuetext={percent}>
          <div className={cn('h-full rounded-full transition-[width]', barTone)}
            style={{ width: `${pct}%` }} />
        </div>
        <span className={cn('text-xs tabular-nums', budget.overBudget ? 'font-semibold text-loss' : 'text-muted-foreground')}>
          {t(budget.overBudget ? 'budget.envelope.overspent' : 'budget.envelope.remaining', {
            amount: money.amount(Math.abs(budget.remaining)),
            percent,
          })}
        </span>
      </div>
      <div className="flex shrink-0 items-center">
        <Button size="icon" variant="ghost" onClick={onEdit}
          className="text-muted-foreground hover:text-foreground"
          aria-label={t('budget.a11y.edit', { name: budget.categoryName })}>
          <Pencil className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
          aria-label={t('budget.a11y.delete', { name: budget.categoryName })}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  )
}

export function EnvelopesTab() {
  const { t } = useTranslation()
  const { data: budgets, isLoading, isError, refetch } = useBudgets()
  const deleteBudget = useDeleteBudget()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [deleting, setDeleting] = useState<Budget | null>(null)
  // Remount the form on each open/target change so its local state re-initialises.
  const [formKey, setFormKey] = useState(0)

  function openAdd() {
    setEditing(null)
    setFormKey((k) => k + 1)
    setFormOpen(true)
  }
  function openEdit(b: Budget) {
    setEditing(b)
    setFormKey((k) => k + 1)
    setFormOpen(true)
  }

  const totalSpent = (budgets ?? []).reduce((sum, b) => sum + b.spent, 0)
  const totalLimit = (budgets ?? []).reduce((sum, b) => sum + b.monthlyLimit, 0)
  const overCount = (budgets ?? []).filter((b) => b.overBudget).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('budget.tab.envelopes')}</CardTitle>
          <CardDescription>
            {budgets && budgets.length > 0 ? (
              <>
                <CurrencyDisplay value={totalSpent} className="text-foreground" /> / <CurrencyDisplay value={totalLimit} />
                {' · '}
                {overCount > 0
                  ? t('budget.overview.overBudget', { count: overCount })
                  : t('budget.overview.onTrack')}
              </>
            ) : t('budget.envelope.subtitle')}
          </CardDescription>
          <CardAction>
            {/* Icon-only on a phone, so the totals beside it keep their room. */}
            <Button size="xs" className="max-sm:w-9 max-sm:px-0" onClick={openAdd} aria-label={t('budget.envelope.add')}>
              <Plus className="size-4" aria-hidden="true" />
              <span className="max-sm:sr-only">{t('budget.envelope.add')}</span>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isError && <ErrorState messageOnly message={t('budget.envelope.error')} onRetry={() => refetch()} />}

          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          )}

          {budgets && budgets.length === 0 && (
            <EmptyState className="py-8" icon={<Wallet className="size-8" />}
              title={t('budget.envelope.empty')}
              description={t('budget.envelope.emptyHint')} />
          )}

          {budgets && budgets.length > 0 && (
            <ul className="-mx-3 flex flex-col">
              {budgets.map((b) => (
                <EnvelopeRow key={b.id} budget={b}
                  onEdit={() => openEdit(b)} onDelete={() => setDeleting(b)} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <EnvelopeForm key={formKey} open={formOpen} onOpenChange={setFormOpen} editing={editing} />

      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('budget.envelope.deleteTitle')}
        description={t('budget.envelope.deleteDescription', { name: deleting?.categoryName ?? '' })}
        loading={deleteBudget.isPending}
        onConfirm={() => {
          if (deleting) deleteBudget.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }}
      />
    </div>
  )
}
