import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from '@/features/goals/hooks'
import { useAccounts } from '@/features/accounts/hooks'
import { useMemberProfile } from '@/features/profile/hooks'
import { AllocationPicker } from './AllocationPicker'
import { allocatedTotal, isActiveThisMonth } from './plan-math'
import { SavingsRateCard } from './SavingsRateCard'
import { GoalsKpiRow } from './GoalsKpiRow'
import { GoalTrajectory } from './GoalTrajectory'
import { RecurringPlanStats } from './RecurringPlanStats'
import { Stat } from './Stat'
import { goalStatus } from './goal-stats'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { GoalDetailModal } from './GoalDetailModal'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/shared/NumericInput'
import { DateInput } from '@/components/shared/DateInput'
import { formatLocalDate, formatPercent, parseAmount } from '@/lib/utils'
import { useMoney } from '@/hooks/use-money'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  ChevronDown,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GoalProgress, GoalType } from '@/types/api'

const emptyForm = {
  name: '',
  type: 'SAVINGS_TARGET' as GoalType,
  targetAmount: '',
  deadline: '',
  monthlyAmount: '',
  expectedReturn: '',
  startDate: '',
  endDate: '',
  // Amounts stay strings while the user types, like every other field here; parseAmount runs
  // once at submit.
  allocations: [] as { ticker: string; amount: string }[],
  accountIds: [] as number[],
}

export function GoalsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: goals, isLoading } = useGoals()
  const { data: accounts } = useAccounts()
  const { data: profile } = useMemberProfile()
  const createGoal = useCreateGoal()
  const updateGoal = useUpdateGoal()
  const deleteGoal = useDeleteGoal()

  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<GoalProgress | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [detailGoalId, setDetailGoalId] = useState<number | null>(null)
  // Lazy initializer, not a bare `new Date()` in render: the React Compiler's `purity` rule
  // forbids reading the clock while rendering, and a date that changed every render would
  // re-evaluate which plans are running on every keystroke.
  const [today] = useState(() => new Date().toISOString().slice(0, 10))

  const openCreate = () => {
    setEditingGoal(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (goal: GoalProgress) => {
    setEditingGoal(goal)
    setForm({
      name: goal.name,
      type: goal.type,
      targetAmount: goal.targetAmount == null ? '' : String(goal.targetAmount),
      deadline: goal.deadline ?? '',
      monthlyAmount: goal.monthlyAmount == null ? '' : String(goal.monthlyAmount),
      expectedReturn: goal.expectedReturn == null ? '' : String(goal.expectedReturn),
      startDate: goal.startDate ?? '',
      endDate: goal.endDate ?? '',
      allocations: goal.allocations.map((a) => ({ ticker: a.ticker, amount: String(a.monthlyAmount) })),
      accountIds: goal.accounts.map((a) => a.id),
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingGoal(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // The two shapes send different halves; the backend defaults an omitted type, but being
    // explicit here keeps the payload readable in the network tab.
    const recurring = form.type === 'RECURRING_INVESTMENT'
    const data = {
      name: form.name,
      type: form.type,
      targetAmount: recurring ? null : parseAmount(form.targetAmount),
      deadline: recurring ? null : form.deadline,
      monthlyAmount: recurring ? parseAmount(form.monthlyAmount) : null,
      expectedReturn: recurring && form.expectedReturn ? parseAmount(form.expectedReturn) : null,
      startDate: recurring && form.startDate ? form.startDate : null,
      endDate: recurring && form.endDate ? form.endDate : null,
      allocations: recurring
        ? form.allocations
            .map((a) => ({ ticker: a.ticker, monthlyAmount: parseAmount(a.amount) }))
            // A ticked line with an empty amount is a line the user has not finished; sending
            // NaN would be a 422 on a field they cannot see.
            .filter((a) => Number.isFinite(a.monthlyAmount) && a.monthlyAmount > 0)
        : [],
      accountIds: form.accountIds,
    }
    if (editingGoal) {
      await updateGoal.mutateAsync({ id: editingGoal.id, data })
    } else {
      await createGoal.mutateAsync(data)
    }
    closeForm()
  }

  const toggleAccount = (id: number) => {
    setForm((f) => {
      // A recurring plan funds exactly one account — the backend refuses more, so the picker
      // behaves like a radio group rather than letting the user build an invalid request.
      if (f.type === 'RECURRING_INVESTMENT') {
        // The split names positions of the funded account, so changing that account invalidates
        // every line: keeping them would post tickers the new account does not hold, and the
        // backend answers 400.
        return { ...f, accountIds: f.accountIds.includes(id) ? [] : [id], allocations: [] }
      }
      return {
        ...f,
        accountIds: f.accountIds.includes(id)
          ? f.accountIds.filter((a) => a !== id)
          : [...f.accountIds, id],
      }
    })
  }

  // Derived once for the picker and the Save guard, so the two cannot disagree about whether
  // the split fits. The backend's 422 is still the authority; this is the earlier answer.
  const monthlyAmountValue = (() => {
    const parsed = parseAmount(form.monthlyAmount)
    return Number.isFinite(parsed) ? parsed : 0
  })()
  const overAllocated =
    form.type === 'RECURRING_INVESTMENT' &&
    allocatedTotal(form.allocations) - monthlyAmountValue > 0.005

  const handleConfirmDelete = () => {
    if (deleteId != null) {
      deleteGoal.mutate(deleteId)
      setDeleteId(null)
    }
  }

  if (isLoading) return <LoadingSkeleton />

  const goalList = goals ?? []
  // Two shapes, two sections: a savings target has a percentage and a deadline, a recurring plan
  // has neither, and one list would have to render an empty progress bar for half its rows.
  const savingsTargets = goalList.filter((g) => g.type !== 'RECURRING_INVESTMENT')
  const recurringPlans = goalList.filter((g) => g.type === 'RECURRING_INVESTMENT')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('goals.title')}
        actions={
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="size-4" />
            {t('goals.addGoal')}
          </Button>
        }
      />

      {goalList.length === 0 ? (
        <EmptyState
          className="min-h-[calc(100vh-14rem)]"
          icon={<Target className="size-12" />}
          title={t('goals.noGoals')}
          action={{ label: t('goals.addGoal'), onClick: openCreate }}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <GoalsKpiRow savings={savingsTargets} plans={recurringPlans} today={today} />

          {savingsTargets.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-sm text-muted-foreground">{t('goals.sections.savings')}</h2>
              <div className={CARD_GRID}>
              {savingsTargets.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  today={today}
                  onEdit={() => openEdit(goal)}
                  onDelete={() => setDeleteId(goal.id)}
                  onCalendar={() => navigate(`/goals/${goal.id}/calendar`)}
                  onOpenDetail={() => setDetailGoalId(goal.id)}
                />
              ))}
              </div>
            </section>
          )}

          {recurringPlans.length > 0 && (
            <section className="flex flex-col gap-4">
              <div>
                <h2 className="text-sm text-muted-foreground">{t('goals.sections.recurring')}</h2>
                <p className="text-xs text-muted-foreground">{t('goals.sections.recurringHint')}</p>
              </div>
              <SavingsRateCard
                plans={recurringPlans}
                monthlyNetIncome={profile?.monthlyNetIncome ?? null}
                today={today}
                onOpenSettings={() => navigate('/settings')}
              />
              <div className={CARD_GRID}>
              {recurringPlans.map((goal) => (
                <RecurringPlanCard
                  key={goal.id}
                  goal={goal}
                  today={today}
                  onEdit={() => openEdit(goal)}
                  onDelete={() => setDeleteId(goal.id)}
                />
              ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Goal detail modal */}
      <GoalDetailModal
        goalId={detailGoalId}
        onClose={() => setDetailGoalId(null)}
      />

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm() }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingGoal ? t('goals.editGoal') : t('goals.addGoal')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!editingGoal && (
              <div className="flex flex-col gap-1.5">
                <Label>{t('goals.goalType')}</Label>
                <div className="flex gap-2">
                  {(['SAVINGS_TARGET', 'RECURRING_INVESTMENT'] as GoalType[]).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={form.type === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, type, accountIds: [], allocations: [] }))}
                    >
                      {t(`goals.types.${type}`)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-name">{t('goals.title')}</Label>
              <Input
                id="goal-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('goals.namePlaceholder')}
              />
            </div>

            {form.type === 'SAVINGS_TARGET' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="goal-target">{t('goals.targetAmount')}</Label>
                  <NumericInput
                    id="goal-target"
                    required
                    value={form.targetAmount}
                    onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
                    placeholder="50000"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="goal-deadline">{t('goals.deadline')}</Label>
                  <DateInput
                    id="goal-deadline"
                    required
                    value={form.deadline}
                    onChange={(iso) => setForm((f) => ({ ...f, deadline: iso }))}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="goal-monthly">{t('goals.monthlyAmount')}</Label>
                    <NumericInput
                      id="goal-monthly"
                      required
                      value={form.monthlyAmount}
                      onChange={(e) => setForm((f) => ({ ...f, monthlyAmount: e.target.value }))}
                      placeholder="300"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="goal-return">{t('goals.expectedReturn')}</Label>
                    <NumericInput
                      id="goal-return"
                      value={form.expectedReturn}
                      onChange={(e) => setForm((f) => ({ ...f, expectedReturn: e.target.value }))}
                      placeholder="7.5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="goal-start">{t('goals.startDate')}</Label>
                    <DateInput
                      id="goal-start"
                      value={form.startDate}
                      onChange={(iso) => setForm((f) => ({ ...f, startDate: iso }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="goal-end">{t('goals.endDate')}</Label>
                    <DateInput
                      id="goal-end"
                      value={form.endDate}
                      onChange={(iso) => setForm((f) => ({ ...f, endDate: iso }))}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{t('goals.recurringHint')}</p>
              </>
            )}

            <div className="flex flex-col gap-2">
              <Label>{t('goals.includedAccounts')}</Label>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                {(accounts ?? []).map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2.5 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={form.accountIds.includes(a.id)}
                      onChange={() => toggleAccount(a.id)}
                      className="rounded accent-primary"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: a.color }}
                    />
                    <span className="text-sm flex-1">{a.name}</span>
                    <span className="text-xs text-muted-foreground">
                      <CurrencyDisplay value={a.currentBalanceEur} />
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {form.type === 'RECURRING_INVESTMENT' && (
              <AllocationPicker
                accountId={form.accountIds[0] ?? null}
                monthlyAmount={monthlyAmountValue}
                allocations={form.allocations}
                onChange={(allocations) => setForm((f) => ({ ...f, allocations }))}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={
                  createGoal.isPending ||
                  updateGoal.isPending ||
                  form.accountIds.length === 0 ||
                  overAllocated
                }
              >
                {(createGoal.isPending || updateGoal.isPending) && (
                  <Loader2
                    className="size-4 animate-spin mr-1"
                  />
                )}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        title={t('goals.deleteGoal')}
        description={t('goals.deleteGoal')}
        onConfirm={handleConfirmDelete}
        loading={deleteGoal.isPending}
        variant="destructive"
      />
    </div>
  )
}

const CARD_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-4'
const BADGE = 'h-[22px] px-2 text-xs font-semibold'

/** Edit / delete (and calendar) at the foot of a card; clicks stay off the card's own handler. */
function CardActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-auto flex justify-end gap-0.5 border-t border-border pt-2" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  )
}

/**
 * A recurring plan has no target, no deadline and no progress bar — showing an empty one would
 * be inventing a completion percentage for something with no end. It shows what goes in every
 * month, into which account, and what that account is worth today.
 */
function RecurringPlanCard({
  goal,
  today,
  onEdit,
  onDelete,
}: {
  goal: GoalProgress
  today: string
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const money = useMoney()
  const [open, setOpen] = useState(false)
  const account = goal.accounts[0]

  const monthlyAmount = goal.monthlyAmount ?? 0
  const detailed = goal.allocations.length > 0
  const allocated = goal.allocations.reduce((sum, a) => sum + a.monthlyAmount, 0)
  // Shown as its own row rather than left implicit: an incomplete split is a legitimate state,
  // and a breakdown that silently does not add up to the amount above it reads as a bug.
  const unallocated = monthlyAmount - allocated
  const share = (amount: number) => (monthlyAmount > 0 ? (amount / monthlyAmount) * 100 : 0)
  const color = (i: number) => `var(--slice-${(i % 10) + 1})`

  const state = isActiveThisMonth(goal, today)
    ? { label: t('goals.card.active'), className: 'bg-primary/12 text-foreground' }
    : goal.startDate != null && goal.startDate > today
      ? { label: t('goals.card.upcoming'), className: '' }
      : { label: t('common.done'), className: '' }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="line-clamp-2 break-words">{goal.name}</CardTitle>
        <CardAction>
          <Badge variant="secondary" className={cn(BADGE, state.className)}>{state.label}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t('goals.monthlyAmount')}</p>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[22px] font-semibold tracking-tight tabular-nums">
              {t('goals.card.perMonth', { value: money.amount(monthlyAmount, 'EUR', { maximumFractionDigits: 0 }) })}
            </span>
            {account && <span className="text-[13px] text-muted-foreground">{t('goals.card.into', { account: account.name })}</span>}
          </p>
        </div>

        {detailed && monthlyAmount > 0 && (
          <div
            role="img"
            aria-label={goal.allocations
              .map((line) => `${line.ticker} ${formatPercent(share(line.monthlyAmount), { fractionDigits: 0 })}`)
              .join(', ')}
            className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted"
          >
            {goal.allocations.map((line, i) => (
              <span key={line.ticker} style={{ width: `${share(line.monthlyAmount)}%`, backgroundColor: color(i) }} />
            ))}
          </div>
        )}

        {detailed && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-muted-foreground">{t('goals.allocation.title')}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={t('goals.allocation.toggle')}
            >
              <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
            </Button>
          </div>
        )}

        {detailed && open && (
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {goal.allocations.map((line, i) => (
              <li key={line.ticker} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color(i) }} aria-hidden="true" />
                  <span className="font-mono">{line.ticker}</span>
                  <span className="truncate text-muted-foreground">{line.name ?? line.ticker}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {/* A share, so it survives privacy mode; the amount beside it does not. */}
                  {monthlyAmount > 0 && (
                    <span className="text-muted-foreground tabular-nums">
                      {formatPercent(share(line.monthlyAmount), { fractionDigits: 0 })}
                    </span>
                  )}
                  <CurrencyDisplay value={line.monthlyAmount} className="font-semibold tabular-nums" />
                </span>
              </li>
            ))}
            {unallocated > 0.005 && (
              <li className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>{t('goals.allocation.unallocated')}</span>
                <CurrencyDisplay value={unallocated} className="tabular-nums" />
              </li>
            )}
          </ul>
        )}

        <dl className="grid grid-cols-2 gap-2.5 text-[13px]">
          <Stat label={t('goals.currentTotal')}>
            <CurrencyDisplay value={goal.currentTotal} />
          </Stat>
          {goal.endDate && (
            <Stat label={t('goals.endDate')}>{formatLocalDate(goal.endDate)}</Stat>
          )}
        </dl>

        <RecurringPlanStats goal={goal} />

        <CardActions>
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={t('common.edit')}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label={t('common.delete')}>
            <Trash2 className="size-4" />
          </Button>
        </CardActions>
      </CardContent>
    </Card>
  )
}

interface GoalCardProps {
  goal: GoalProgress
  today: string
  onEdit: () => void
  onDelete: () => void
  onCalendar: () => void
  onOpenDetail: () => void
}

function GoalCard({ goal, today, onEdit, onDelete, onCalendar, onOpenDetail }: GoalCardProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const perMonth = (value: number) =>
    t('goals.card.perMonth', { value: money.amount(value, 'EUR', { maximumFractionDigits: 0 }) })

  const verdict = goalStatus(goal)
  const behind = verdict === 'behind'
  const status = {
    achieved: { label: t('goals.achieved'), className: 'bg-gain/10 text-gain' },
    waiting: { label: t('goals.waiting'), className: '' },
    onTrack: { label: t('goals.onTrack'), className: 'bg-primary/12 text-foreground' },
    behind: { label: t('goals.behind'), className: 'text-warning' },
  }[verdict]

  return (
    <Card
      className="cursor-pointer transition-[background-color] hover:bg-muted/40"
      onClick={onOpenDetail}
    >
      <CardHeader>
        <CardTitle className="line-clamp-2 break-words">{goal.name}</CardTitle>
        <CardAction>
          <Badge variant="secondary" className={cn(BADGE, status.className)}>{status.label}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
            <CurrencyDisplay value={goal.currentTotal} className="text-[22px] font-semibold tracking-tight" />
            <span className="text-muted-foreground">
              / <CurrencyDisplay value={goal.targetAmount ?? 0} />
            </span>
          </span>
          {/* A ratio, so it stays legible in privacy mode. */}
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {formatPercent(goal.percentComplete ?? 0, { fractionDigits: 0 })}
          </span>
        </div>

        <Progress value={goal.percentComplete} className="h-1.5" aria-label={goal.name} />

        <GoalTrajectory goal={goal} today={today} />

        <dl className="grid grid-cols-2 gap-2.5 text-[13px]">
          <Stat label={t('goals.deadline')}>{formatLocalDate(goal.deadline)}</Stat>
          <Stat label={t('goals.card.required')} className={behind ? 'text-warning' : undefined}>
            {perMonth(Math.max(0, goal.monthlyNeeded ?? 0))}
          </Stat>
          <Stat label={t('goals.card.average')}>
            {goal.avgMonthlyContribution != null ? perMonth(goal.avgMonthlyContribution) : '\u2013'}
          </Stat>
          <Stat label={t('goals.card.accounts', { count: goal.accounts.length })}>
            {goal.accounts.length > 0 ? goal.accounts.map((a) => a.name).join(', ') : '\u2013'}
          </Stat>
        </dl>

        <CardActions>
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={t('common.edit')}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onCalendar} aria-label={t('goals.viewCalendar')}>
            <Calendar className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label={t('goals.deleteGoal')}
          >
            <Trash2 className="size-4" />
          </Button>
        </CardActions>
      </CardContent>
    </Card>
  )
}
