import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Inbox, RefreshCw, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { MerchantAvatar } from '@/components/shared/MerchantAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { RuleWordPicker } from '@/components/budget/RuleWordPicker'
import {
  useBudgetSettings,
  useCategories,
  useCategorize,
  useCategorizeAiStatus,
  useMerchantLogoUrl,
  useRecategorize,
  useStartCategorizeAi,
  useUncategorized,
} from '@/features/budget/hooks'
import { cn, formatDate, formatPercent, getLocale } from '@/lib/utils'
import type { Category, RuleMatchType, UncategorizedTransaction } from '@/types/api'
import { BudgetToolbar } from './budget-utils'

type RulePayload = {
  pattern: string
  matchType: RuleMatchType
  applyToIds: number[]
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )
  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isMobile
}

function InboxRow({ tx, categories }: {
  tx: UncategorizedTransaction
  categories: Category[]
}) {
  const { t } = useTranslation()
  const categorize = useCategorize()
  const qc = useQueryClient()
  const logoUrlFor = useMerchantLogoUrl()
  const isMobile = useIsMobile()

  // Preselect the AI suggestion (if any) so accepting it is a single click on "Assign".
  const [categoryId, setCategoryId] = useState<number | ''>(tx.aiSuggestedCategoryId ?? '')
  const [rulePickerOpen, setRulePickerOpen] = useState(false)
  const [rulePayload, setRulePayload] = useState<RulePayload | null>(null)

  const txLabel = tx.merchantLabel || tx.counterparty || tx.description

  const suggested =
    tx.aiSuggestedCategoryId != null
      ? categories.find((c) => c.id === tx.aiSuggestedCategoryId) ?? null
      : null

  function assign() {
    if (categoryId === '') return
    categorize.mutate(
      {
        id: tx.id,
        data: {
          categoryId: Number(categoryId),
          createRule: rulePayload != null,
          rulePattern: rulePayload?.pattern,
          ruleMatchType: rulePayload?.matchType,
          applyToTransactionIds: rulePayload?.applyToIds,
        },
      },
      {
        onSuccess: () => {
          setRulePickerOpen(false)
          setRulePayload(null)
          void qc.invalidateQueries({ queryKey: ['budget', 'rules'] })
        },
      }
    )
  }

  function handlePickerConfirm(payload: RulePayload) {
    setRulePayload(payload)
    setRulePickerOpen(false)
  }

  const pickerContent = (
    <RuleWordPicker
      label={txLabel}
      onConfirm={handlePickerConfirm}
      onClose={() => setRulePickerOpen(false)}
    />
  )

  return (
    <li className="flex flex-col gap-2.5 py-3 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <MerchantAvatar
          label={txLabel}
          logoUrl={logoUrlFor(tx.merchantBrandId)}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{txLabel}</p>
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs font-medium text-muted-foreground">
            <span className="tabular-nums">{formatDate(tx.date, getLocale())}</span>
            {suggested && (
              <>
                <span className="inline-flex min-w-0 items-center gap-1 text-foreground">
                  <span className="text-muted-foreground" aria-hidden="true">·</span>
                  <Sparkles className="size-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {t('budget.categorize.aiSuggested', {
                      name: suggested.name,
                      confidence: formatPercent(tx.aiConfidence ?? 0, { fractionDigits: 0 }),
                    })}
                  </span>
                </span>
              </>
            )}
          </p>
          {rulePayload != null && (
            <p className="truncate text-xs text-muted-foreground">
              {t('budget.rule.ruleActive', { pattern: rulePayload.pattern })}
              {rulePayload.applyToIds.length > 0 && <> · {rulePayload.applyToIds.length}</>}
            </p>
          )}
        </div>
        <CurrencyDisplay
          value={tx.amount}
          showSign
          className={cn('shrink-0 text-right text-sm font-semibold tabular-nums lg:w-28', tx.amount >= 0 ? 'text-gain' : 'text-foreground')}
        />
      </div>

      {/* Category, rule, assign: one compact row on a desktop, the select over the two buttons on a phone. */}
      <div className="grid grid-cols-2 gap-2 lg:flex lg:shrink-0 lg:items-center">
        <NativeSelect
          aria-label={t('common.category')}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
          className="col-span-2 h-9 lg:w-48"
        >
          <option value="">{t('budget.categorize.selectCategory')}</option>
          {categories.filter((c) => !c.archived).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </NativeSelect>
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="px-4"
          onClick={() => setRulePickerOpen(true)}
        >
          {rulePayload != null
            ? t('budget.categorize.editRule')
            : t('budget.categorize.createRule')}
        </Button>
        <Button
          size="xs"
          className="px-4"
          onClick={assign}
          disabled={categoryId === '' || categorize.isPending}
        >
          {t('budget.categorize.assign')}
        </Button>
      </div>

      {/* Rule picker — Sheet (bottom) on mobile, Dialog on desktop */}
      {isMobile ? (
        <Sheet open={rulePickerOpen} onOpenChange={setRulePickerOpen}>
          <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto px-4 pt-4 pb-6">
            <SheetHeader className="mb-4 p-0">
              <SheetTitle>{t('budget.categorize.createRule')}</SheetTitle>
              <SheetDescription className="truncate">{txLabel}</SheetDescription>
            </SheetHeader>
            {pickerContent}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={rulePickerOpen} onOpenChange={setRulePickerOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('budget.categorize.createRule')}</DialogTitle>
              <DialogDescription className="truncate">{txLabel}</DialogDescription>
            </DialogHeader>
            {pickerContent}
          </DialogContent>
        </Dialog>
      )}
    </li>
  )
}

export function CategorizeTab() {
  const { t } = useTranslation()
  const { data: txs, isLoading, isError, refetch } = useUncategorized()
  const { data: categories } = useCategories()
  const { data: settings } = useBudgetSettings()
  const recategorize = useRecategorize()
  const aiEnabled = !!settings?.aiCategorizationEnabled
  const aiStatus = useCategorizeAiStatus(aiEnabled)
  const startAi = useStartCategorizeAi()
  const qc = useQueryClient()

  // Track the previous running value so we can detect the running → done transition.
  const prevRunningRef = useRef<boolean | undefined>(undefined)
  const [doneInfo, setDoneInfo] = useState<{ applied: number; suggested: number } | null>(null)

  useEffect(() => {
    const running = aiStatus.data?.running
    if (prevRunningRef.current === true && running === false) {
      void qc.invalidateQueries({ queryKey: ['budget'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      if (aiStatus.data) {
        // Reacting to the running → done transition detected above, not deriving render state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDoneInfo({ applied: aiStatus.data.applied, suggested: aiStatus.data.suggested })
      }
    }
    prevRunningRef.current = running
  // qc is stable (QueryClient never changes); aiStatus.data is captured via the running dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiStatus.data?.running])

  const count = txs?.length ?? 0

  return (
    <div className="space-y-4">
      <BudgetToolbar lead={t('budget.categorize.subtitle')}>
        {doneInfo && (
          <span className="w-full text-xs text-muted-foreground sm:w-auto">
            {t('budget.categorize.aiDone', {
              applied: doneInfo.applied,
              suggested: doneInfo.suggested,
            })}
          </span>
        )}
        {aiEnabled && (
          <Button
            size="xs"
            className="flex-1 sm:flex-none"
            onClick={() => { setDoneInfo(null); startAi.mutate() }}
            disabled={aiStatus.data?.running || startAi.isPending}
          >
            <Sparkles className="size-4" />
            {aiStatus.data?.running
              ? t('budget.categorize.aiProgress', {
                  processed: aiStatus.data.processed,
                  total: aiStatus.data.total,
                })
              : t('budget.categorize.categorizeAi')}
          </Button>
        )}
        <Button size="xs" variant="outline" className="flex-1 sm:flex-none" onClick={() => recategorize.mutate()}
          disabled={recategorize.isPending}>
          <RefreshCw className={cn('size-4', recategorize.isPending && 'animate-spin')} /> {t('budget.categorize.recategorize')}
        </Button>
      </BudgetToolbar>

      <Card>
        <CardHeader>
          <CardTitle>{t('budget.tab.categorize')}</CardTitle>
          {count > 0 && (
            <CardDescription>{t('budget.overview.toCategorize', { count })}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          )}

          {!isLoading && isError && (
            <ErrorState messageOnly message={t('budget.categorize.error')} onRetry={() => void refetch()} />
          )}

          {!isLoading && !isError && count === 0 && (
            <EmptyState className="py-8" icon={<Inbox className="size-8" />}
              title={t('budget.categorize.empty')}
              description={t('budget.categorize.emptyHint')} />
          )}

          {!isLoading && !isError && count > 0 && (
            <ul className="flex flex-col divide-y divide-border">
              {txs!.map((tx) => (
                <InboxRow key={tx.id} tx={tx} categories={categories ?? []} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
