import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, ArchiveRestore, ArrowRight, ListFilter, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ColorPicker } from '@/components/shared/ColorPicker'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { NativeSelect } from '@/components/shared/NativeSelect'
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
  useArchiveCategory,
  useBudgetSettings,
  useCategories,
  useCreateCategory,
  useCreateRule,
  useDeleteRule,
  useRules,
  useUnarchiveCategory,
  useUpdateBudgetSettings,
  useUpdateCategory,
} from '@/features/budget/hooks'
import { cn, formatDate, formatPercent, getLocale } from '@/lib/utils'
import type { AiCategorizationMode, Category, CategoryKind, RuleMatchType } from '@/types/api'
import { ColorDot } from './budget-utils'
import { KIND_META } from './budget-meta'

const KINDS: CategoryKind[] = ['INCOME', 'EXPENSE', 'TRANSFER']
const MATCH_TYPES: RuleMatchType[] = ['COUNTERPARTY', 'KEYWORD']
const AI_MODES: AiCategorizationMode[] = ['SUGGEST', 'AUTO_HIGH_CONFIDENCE', 'AUTO_ALL']

// ─── Payday cycle ──────────────────────────────────────────────────────────

function CycleSettingsCard() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useBudgetSettings()
  const update = useUpdateBudgetSettings()
  const [day, setDay] = useState<number | ''>('')

  // Sync local state from the loaded value once, during render (no effect).
  const [synced, setSynced] = useState(false)
  if (!synced && data) {
    setSynced(true)
    setDay(data.cycleStartDay)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('budget.settings.cycleTitle')}</CardTitle>
        <CardDescription>{t('budget.settings.cycleHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-9 w-full rounded-md" />}
        {!isLoading && isError && !data && (
          <ErrorState messageOnly message={t('budget.settings.error')} onRetry={() => void refetch()} />
        )}
        {data && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="cycle-day">{t('budget.settings.cycleStartDay')}</Label>
              <Input id="cycle-day" type="number" min={1} max={28} className="w-28"
                value={day}
                onChange={(e) => setDay(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <Button disabled={update.isPending || day === '' || day < 1 || day > 28}
              onClick={() => day !== '' && update.mutate({
                cycleStartDay: Number(day),
                logoFetchEnabled: data.logoFetchEnabled,
                aiCategorizationEnabled: data.aiCategorizationEnabled,
                aiMode: data.aiMode,
                aiConfidenceThreshold: data.aiConfidenceThreshold,
              })}>
              {update.isPending ? t('common.loading') : t('common.save')}
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              {t('budget.settings.currentCycle', {
                start: formatDate(data.currentCycleStart, getLocale()),
                end: formatDate(data.currentCycleEnd, getLocale()),
              })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Brand logos (opt-in) ────────────────────────────────────────────────────

function LogoSettingsCard() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useBudgetSettings()
  const update = useUpdateBudgetSettings()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('budget.settings.logoTitle')}</CardTitle>
        <CardDescription>{t('budget.settings.logoHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-9 w-full rounded-md" />}
        {!isLoading && isError && !data && (
          <ErrorState messageOnly message={t('budget.settings.error')} onRetry={() => void refetch()} />
        )}
        {data && (
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="logo-fetch" className="font-normal text-muted-foreground">
              {t('budget.settings.logoFetchLabel')}
            </Label>
            <Switch
              id="logo-fetch"
              className="dark:data-unchecked:bg-muted-foreground/50"
              checked={data.logoFetchEnabled}
              disabled={update.isPending}
              onCheckedChange={(checked) =>
                update.mutate({
                  cycleStartDay: data.cycleStartDay,
                  logoFetchEnabled: checked,
                  aiCategorizationEnabled: data.aiCategorizationEnabled,
                  aiMode: data.aiMode,
                  aiConfidenceThreshold: data.aiConfidenceThreshold,
                })
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── AI categorization (opt-in) ──────────────────────────────────────────────

function AiCategorizationCard() {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useBudgetSettings()
  const update = useUpdateBudgetSettings()

  // The threshold slider needs live local feedback while dragging; sync it from the loaded
  // value once (during render, no effect) like CycleSettingsCard does, then commit on release.
  const [threshold, setThreshold] = useState(75)
  const [synced, setSynced] = useState(false)
  if (!synced && data) {
    setSynced(true)
    setThreshold(data.aiConfidenceThreshold)
  }

  // Each control sends the whole settings object (the backend replaces it wholesale), so fold the
  // single changed field over the current values.
  function save(patch: {
    aiCategorizationEnabled?: boolean
    aiMode?: AiCategorizationMode
    aiConfidenceThreshold?: number
  }) {
    if (!data) return
    update.mutate({
      cycleStartDay: data.cycleStartDay,
      logoFetchEnabled: data.logoFetchEnabled,
      aiCategorizationEnabled: data.aiCategorizationEnabled,
      aiMode: data.aiMode,
      aiConfidenceThreshold: data.aiConfidenceThreshold,
      ...patch,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('budget.settings.aiTitle')}</CardTitle>
        <CardDescription>{t('budget.settings.aiHint')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Skeleton className="h-9 w-full rounded-md" />}
        {!isLoading && isError && !data && (
          <ErrorState messageOnly message={t('budget.settings.error')} onRetry={() => void refetch()} />
        )}
        {data && (
          <>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="ai-enabled" className="font-normal text-muted-foreground">
                {t('budget.settings.aiEnableLabel')}
              </Label>
              <Switch
                id="ai-enabled"
                checked={data.aiCategorizationEnabled}
                disabled={update.isPending}
                onCheckedChange={(checked) => save({ aiCategorizationEnabled: checked })}
              />
            </div>

            {data.aiCategorizationEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ai-mode">{t('budget.settings.aiModeLabel')}</Label>
                  <NativeSelect
                    id="ai-mode"
                    value={data.aiMode}
                    disabled={update.isPending}
                    onChange={(e) => save({ aiMode: e.target.value as AiCategorizationMode })}
                  >
                    {AI_MODES.map((m) => (
                      <option key={m} value={m}>{t(`budget.settings.aiModeOption.${m}`)}</option>
                    ))}
                  </NativeSelect>
                  <p className="text-xs text-muted-foreground">
                    {t(`budget.settings.aiModeHint.${data.aiMode}`)}
                  </p>
                </div>

                {data.aiMode === 'AUTO_HIGH_CONFIDENCE' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ai-threshold">{t('budget.settings.aiThresholdLabel')}</Label>
                      <span className="text-sm tabular-nums text-muted-foreground">{formatPercent(threshold, { fractionDigits: 0 })}</span>
                    </div>
                    <input
                      id="ai-threshold"
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={threshold}
                      disabled={update.isPending}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      onPointerUp={() => save({ aiConfidenceThreshold: threshold })}
                      onKeyUp={() => save({ aiConfidenceThreshold: threshold })}
                      onBlur={() => save({ aiConfidenceThreshold: threshold })}
                      className="range-input w-full"
                      style={{ '--range-fill': `${threshold}%` } as React.CSSProperties}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('budget.settings.aiThresholdHint')}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Category form ───────────────────────────────────────────────────────────

function CategoryForm({ open, onOpenChange, editing }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Category | null
}) {
  const { t } = useTranslation()
  const { data: categories } = useCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()

  const [name, setName] = useState(editing?.name ?? '')
  const [kind, setKind] = useState<CategoryKind>(editing?.kind ?? 'EXPENSE')
  const [color, setColor] = useState(editing?.color ?? '#6366f1')
  const [parentId, setParentId] = useState<number | ''>(editing?.parentId ?? '')
  const pending = createCategory.isPending || updateCategory.isPending

  // A category that already has sub-categories can't itself become one (the backend enforces a
  // single level of nesting), so its parent selector is locked. Eligible parents are top-level
  // categories of the same kind, not archived, and not the category being edited.
  const hasChildren = (categories ?? []).some((c) => c.parentId === editing?.id)
  const parentOptions = (categories ?? []).filter(
    (c) => c.parentId == null && c.kind === kind && !c.archived && c.id !== editing?.id,
  )

  function submit() {
    if (name.trim() === '') return
    const payload = { name: name.trim(), kind, color, parentId: parentId === '' ? null : Number(parentId) }
    const onDone = { onSuccess: () => onOpenChange(false) }
    if (editing) updateCategory.mutate({ id: editing.id, data: payload }, onDone)
    else createCategory.mutate(payload, onDone)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? t('budget.category.edit') : t('budget.category.add')}
          </DialogTitle>
          <DialogDescription>{t('budget.category.formHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">{t('budget.category.name')}</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t('budget.category.namePlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-kind">{t('budget.category.kind')}</Label>
            <NativeSelect id="cat-kind" value={kind} disabled={editing != null}
              onChange={(e) => {
                setKind(e.target.value as CategoryKind)
                setParentId('') // a parent must share the child's kind — drop a now-invalid choice
              }}>
              {KINDS.map((k) => (
                <option key={k} value={k}>{t(KIND_META[k].labelKey)}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-parent">{t('budget.category.parent')}</Label>
            <NativeSelect id="cat-parent" value={parentId} disabled={hasChildren}
              onChange={(e) => setParentId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">{t('budget.category.parentNone')}</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              {hasChildren ? t('budget.category.parentLocked') : t('budget.category.parentHint')}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t('budget.category.color')}</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={pending || name.trim() === ''}>
            {pending ? t('common.loading') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoriesCard() {
  const { t } = useTranslation()
  const { data: categories, isLoading, isError, refetch } = useCategories()
  const archive = useArchiveCategory()
  const unarchive = useUnarchiveCategory()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [formKey, setFormKey] = useState(0)

  function open(cat: Category | null) {
    setEditing(cat)
    setFormKey((k) => k + 1)
    setFormOpen(true)
  }

  // The backend hands back a flat list; we fold it into a one-level tree for display — roots in
  // their given order, each immediately followed by its (indented) sub-categories. A single level
  // of nesting is guaranteed server-side, so there is no deeper recursion to handle.
  const roots = (categories ?? []).filter((c) => c.parentId == null)
  const childrenOf = (parentId: number) => (categories ?? []).filter((c) => c.parentId === parentId)

  function row(c: Category, child: boolean) {
    return (
      <li key={c.id} className={cn('flex items-center gap-3 rounded-xl py-1 pr-1 pl-3 transition-colors hover:bg-muted/50', child && 'ml-5 sm:ml-7')}>
        <ColorDot color={c.color} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={cn('truncate text-sm font-semibold', c.archived && 'text-muted-foreground line-through')}>
            {c.name}
          </span>
          <span className="truncate text-xs font-medium text-muted-foreground">
            {[
              child ? t('budget.category.subcategory') : t(KIND_META[c.kind].labelKey),
              c.isDefault ? t('budget.category.default') : null,
            ].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="flex shrink-0 items-center">
          <Button size="icon" variant="ghost" onClick={() => open(c)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t('budget.a11y.edit', { name: c.name })}>
            <Pencil className="size-4" />
          </Button>
          {c.archived ? (
            <Button size="icon" variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              aria-label={t('budget.a11y.unarchive', { name: c.name })}
              disabled={unarchive.isPending} onClick={() => unarchive.mutate(c.id)}>
              <ArchiveRestore className="size-4" />
            </Button>
          ) : (
            <Button size="icon" variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              aria-label={t('budget.a11y.archive', { name: c.name })}
              disabled={archive.isPending} onClick={() => archive.mutate(c.id)}>
              <Archive className="size-4" />
            </Button>
          )}
        </div>
      </li>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('budget.category.title')}</CardTitle>
        <CardDescription>{t('budget.category.hint')}</CardDescription>
        <CardAction>
          <Button size="xs" onClick={() => open(null)}>
            <Plus className="size-4" /> {t('budget.category.add')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-40 w-full rounded-xl" />}
        {!isLoading && isError && !categories && (
          <ErrorState messageOnly message={t('budget.category.error')} onRetry={() => void refetch()} />
        )}
        {categories && (
          <ul className="-mx-3 flex flex-col">
            {roots.map((r) => [row(r, false), ...childrenOf(r.id).map((c) => row(c, true))])}
          </ul>
        )}
      </CardContent>
      <CategoryForm key={formKey} open={formOpen} onOpenChange={setFormOpen} editing={editing} />
    </Card>
  )
}

// ─── Rules ───────────────────────────────────────────────────────────────────

function RuleForm({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { data: categories } = useCategories()
  const createRule = useCreateRule()

  const [matchType, setMatchType] = useState<RuleMatchType>('COUNTERPARTY')
  const [pattern, setPattern] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')

  function submit() {
    if (pattern.trim() === '' || categoryId === '') return
    createRule.mutate(
      { matchType, pattern: pattern.trim(), categoryId: Number(categoryId) },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('budget.rule.add')}</DialogTitle>
          <DialogDescription>{t('budget.rule.formHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-match">{t('budget.rule.matchType')}</Label>
            <NativeSelect id="rule-match" value={matchType}
              onChange={(e) => setMatchType(e.target.value as RuleMatchType)}>
              {MATCH_TYPES.map((m) => (
                <option key={m} value={m}>{t(`budget.rule.match.${m.toLowerCase()}`)}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-pattern">{t('budget.rule.pattern')}</Label>
            <Input id="rule-pattern" value={pattern} onChange={(e) => setPattern(e.target.value)}
              placeholder="NETFLIX" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-cat">{t('budget.rule.category')}</Label>
            <NativeSelect id="rule-cat" value={categoryId}
              onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">{t('budget.categorize.selectCategory')}</option>
              {(categories ?? []).filter((c) => !c.archived).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createRule.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit}
            disabled={createRule.isPending || pattern.trim() === '' || categoryId === ''}>
            {createRule.isPending ? t('common.loading') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RulesCard() {
  const { t } = useTranslation()
  const { data: rules, isLoading, isError, refetch } = useRules()
  const { data: categories } = useCategories()
  const deleteRule = useDeleteRule()
  const [formOpen, setFormOpen] = useState(false)
  const colorOf = (id: number) => categories?.find((c) => c.id === id)?.color

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('budget.rule.title')}</CardTitle>
        <CardDescription>{t('budget.rule.hint')}</CardDescription>
        <CardAction>
          <Button size="xs" className="max-sm:w-9 max-sm:px-0" onClick={() => setFormOpen(true)} aria-label={t('budget.rule.add')}>
            <Plus className="size-4" aria-hidden="true" />
            <span className="max-sm:sr-only">{t('budget.rule.add')}</span>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-20 w-full rounded-xl" />}
        {!isLoading && isError && !rules && (
          <ErrorState messageOnly message={t('budget.rule.error')} onRetry={() => void refetch()} />
        )}
        {!isLoading && !isError && (rules?.length ?? 0) === 0 && (
          <EmptyState className="py-8" icon={<ListFilter className="size-8" />} title={t('budget.rule.empty')} />
        )}
        {rules && rules.length > 0 && (
          <ul className="-mx-3 flex flex-col">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl py-1 pr-1 pl-3 transition-colors hover:bg-muted/50">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <code className="truncate font-mono text-[13px] font-semibold">{r.pattern}</code>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <ColorDot color={colorOf(r.categoryId)} />
                    <span className="truncate">{r.categoryName}</span>
                  </span>
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {t(`budget.rule.match.${r.matchType.toLowerCase()}`)}
                    {r.source === 'AUTO' && ` · ${t('budget.rule.learned')}`}
                  </span>
                </div>
                <Button size="icon" variant="ghost" className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={t('budget.a11y.delete', { name: r.pattern })}
                  disabled={deleteRule.isPending} onClick={() => deleteRule.mutate(r.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <RuleForm open={formOpen} onOpenChange={setFormOpen} />
    </Card>
  )
}

export function ManageTab() {
  // The lists the member edits often on the left, the set-once switches on the right.
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        <CategoriesCard />
        <RulesCard />
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
        <CycleSettingsCard />
        <LogoSettingsCard />
        <AiCategorizationCard />
      </div>
    </div>
  )
}
