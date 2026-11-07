import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { TransactionsList } from '@/components/shared/TransactionsList'
import { useCategoryDetail, useCategories, useCategorize, useMerchantLogoUrl } from '@/features/budget/hooks'
import { formatPercent } from '@/lib/utils'
import type { CashflowPeriod, ChildSpend } from '@/types/api'
import { BudgetToolbar, ColorDot, PeriodToggle } from './budget-utils'
import { PeriodNavigator } from './PeriodNavigator'
import { useBudgetPeriod } from './BudgetPeriodContext'

/**
 * `/budget/spending/:categoryId` — one category's transactions over the period. Keyed by
 * id (not slug) because user-created categories have no slug. When the category is a parent,
 * `total`/`count`/`transactions` span its whole subtree and a per-sub-category rollup is shown
 * above the (subtree-wide) transaction list; each sub-category drills one level deeper.
 */

/** A tappable per-sub-category rollup row shown when drilling a parent category. */
function SubcategoryRow({ child, total }: { child: ChildSpend; total: number }) {
  const { t } = useTranslation()
  const share = total > 0 ? (Math.abs(child.total) / total) * 100 : 0
  return (
    <Link
      to={`/budget/spending/${child.categoryId}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60"
    >
      <ColorDot color={child.color} />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-semibold">{child.name}</span>
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {t('budget.flow.transactionsCount', { count: child.count })}
          </span>
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          <CurrencyDisplay value={child.total} className="text-[13px] font-semibold tabular-nums text-foreground" />
          {/* A share, so it stays legible in privacy mode. */}
          <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
            {formatPercent(share, { fractionDigits: 0 })}
          </span>
        </span>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
export function CategoryDetailPage() {
  const { t } = useTranslation()
  const { categoryId } = useParams()
  const [period, setPeriod] = useState<CashflowPeriod>('CYCLE')
  const { anchor, setAnchor } = useBudgetPeriod()
  const id = Number(categoryId)
  const { data, isLoading, isError, refetch } = useCategoryDetail(id, period, anchor)
  const logoUrlFor = useMerchantLogoUrl()
  const { data: categories } = useCategories()
  const categorizeMutation = useCategorize()
  const qc = useQueryClient()

  function handleCategorize(txId: number, categoryId: number) {
    categorizeMutation.mutate(
      { id: txId, data: { categoryId, createRule: false } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: ['budget'] }) },
    )
  }

  const backLink = (
    <Link
      to="/budget/spending"
      className="inline-flex h-8 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t('budget.detail.back')}
    </Link>
  )

  if (!Number.isFinite(id)) {
    return (
      <div className="space-y-4">
        {backLink}
        <ErrorState message={t('budget.detail.notFound')} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <BudgetToolbar lead={backLink}>
        <PeriodNavigator
          period={period}
          from={data?.from}
          to={data?.to}
          onAnchorChange={setAnchor}
        />
        <PeriodToggle value={period} onChange={(p) => { setPeriod(p); setAnchor(undefined) }} />
      </BudgetToolbar>

      {isError && (
        <ErrorState message={t('budget.detail.error')} onRetry={() => refetch()} />
      )}

      {isLoading && !isError && (
        <>
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </>
      )}

      {!isLoading && !isError && data && (
        <>
          {/* The category as a headline figure: name and count on the left, the period's total in ink. */}
          <Card>
            <CardContent className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="flex min-w-0 items-center gap-3">
                <ColorDot color={data.color} className="size-3 shrink-0 rounded-full" />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-lg leading-tight font-bold break-words">{data.name}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {t('budget.flow.transactionsCount', { count: data.count })}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:items-end">
                <span className="text-[13px] font-medium text-muted-foreground">{t('budget.detail.total')}</span>
                <CurrencyDisplay
                  value={data.total}
                  className="text-[22px] leading-tight font-semibold tracking-tight tabular-nums text-foreground"
                />
              </div>
            </CardContent>
          </Card>

          {data.children.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('budget.detail.subcategories')}</CardTitle>
              </CardHeader>
              <CardContent className="-mx-3 space-y-0.5">
                {data.children.map((child) => (
                  <SubcategoryRow key={child.categoryId} child={child} total={Math.abs(data.total)} />
                ))}
              </CardContent>
            </Card>
          )}

          {data.count === 0 ? (
            <Card>
              <CardContent>
                <EmptyState className="py-8" icon={<Receipt className="size-8" />} title={t('budget.detail.empty')} />
              </CardContent>
            </Card>
          ) : (
            <TransactionsList
              transactions={data.transactions}
              logoUrlFor={logoUrlFor}
              categories={categories}
              onCategorize={handleCategorize}
            />
          )}
        </>
      )}
    </div>
  )
}
