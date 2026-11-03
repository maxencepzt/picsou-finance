import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ChevronRight, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CashflowSankey } from '@/components/shared/CashflowSankey'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Delta } from '@/components/shared/Delta'
import { ErrorState } from '@/components/shared/ErrorState'
import { useCashflowFlow, useSpendingByCategory } from '@/features/budget/hooks'
import { formatPercent } from '@/lib/utils'
import type { CashflowPeriod, CategorySpend } from '@/types/api'
import { FALLBACK_COLOR } from './budget-meta'
import { BudgetToolbar, PeriodToggle } from './budget-utils'
import { PeriodNavigator } from './PeriodNavigator'
import { useBudgetPeriod } from './BudgetPeriodContext'

/**
 * `/budget/spending` — where the money goes. A flow diagram (Sankey where the card is
 * wide enough, proportion bars otherwise) sits above a ranked, tappable breakdown. Each real
 * category drills into `/budget/spending/:categoryId`; the uncategorized bucket has no drill
 * target.
 */

/** A compact income · expense · net line — the diagram already shows the shape visually. */
function FlowSummary({ income, expense, net }: { income: number; expense: number; net: number }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
      <span>
        {t('budget.cashflow.income')}{' '}
        <CurrencyDisplay value={income} className="font-semibold text-foreground tabular-nums" />
      </span>
      <span>
        {t('budget.cashflow.expense')}{' '}
        <CurrencyDisplay value={expense} className="font-semibold text-foreground tabular-nums" />
      </span>
      <span className="inline-flex items-baseline gap-1">
        {t('budget.cashflow.net')} <Delta amount={net} />
      </span>
    </div>
  )
}

function BreakdownRow({ row, total }: { row: CategorySpend; total: number }) {
  const { t } = useTranslation()
  const color = row.color || FALLBACK_COLOR
  const name = row.name ?? t('budget.flow.node.uncategorized')
  const share = total > 0 ? row.amount / total : 0

  const content = (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="truncate text-[13px] font-semibold">{name}</span>
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {t('budget.flow.transactionsCount', { count: row.count })}
          </span>
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          <CurrencyDisplay value={row.amount} className="text-[13px] font-semibold tabular-nums text-foreground" />
          {/* A share, so it stays legible in privacy mode. */}
          <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
            {formatPercent(share * 100, { fractionDigits: 0 })}
          </span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(share * 100, 2)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )

  // The uncategorized bucket has no id, so it isn't drillable — render it static, keeping the
  // chevron's slot so its amount and bar line up with the rows above.
  if (row.categoryId == null) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
        {content}
        <span aria-hidden="true" className="size-4 shrink-0" />
      </div>
    )
  }

  return (
    <Link
      to={`/budget/spending/${row.categoryId}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60"
    >
      {content}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** A parent and the leaf rows that roll up into it, with the subtree's summed amount/count. */
interface ParentGroup {
  parentId: number
  parentName: string | null
  parentColor: string | null
  children: CategorySpend[]
  amount: number
  count: number
}

type DisplayItem =
  | { kind: 'leaf'; amount: number; row: CategorySpend }
  | { kind: 'group'; amount: number; group: ParentGroup }

/**
 * Fold the flat, leaf-scoped breakdown into a ranked list of display items: standalone leaves and
 * parent groups (each gathering its children). Groups rank at their rolled-up total, so the list
 * still reads biggest-spend-first while keeping a subtree visually together.
 */
function buildDisplay(categories: CategorySpend[]): DisplayItem[] {
  const standalone: CategorySpend[] = []
  const groups = new Map<number, ParentGroup>()
  for (const row of categories) {
    if (row.parentId == null) {
      standalone.push(row)
      continue
    }
    let g = groups.get(row.parentId)
    if (!g) {
      g = { parentId: row.parentId, parentName: row.parentName, parentColor: row.parentColor, children: [], amount: 0, count: 0 }
      groups.set(row.parentId, g)
    }
    g.children.push(row)
    g.amount = round2(g.amount + row.amount)
    g.count += row.count
  }
  return [
    ...standalone.map((row): DisplayItem => ({ kind: 'leaf', amount: row.amount, row })),
    ...[...groups.values()].map((group): DisplayItem => ({ kind: 'group', amount: group.amount, group })),
  ].sort((a, b) => b.amount - a.amount)
}

/** Render the parent as a (drillable) header row, then its children indented beneath a guide line. */
function ParentGroupRows({ group, total }: { group: ParentGroup; total: number }) {
  const header: CategorySpend = {
    categoryId: group.parentId,
    slug: null,
    name: group.parentName,
    color: group.parentColor,
    icon: null,
    amount: group.amount,
    count: group.count,
    share: total > 0 ? group.amount / total : 0,
    parentId: null,
    parentName: null,
    parentColor: null,
  }
  return (
    <div>
      <BreakdownRow row={header} total={total} />
      <div className="ml-4 border-l border-border/60 pl-1 sm:ml-6">
        {group.children.map((c) => (
          <BreakdownRow key={c.categoryId} row={c} total={total} />
        ))}
      </div>
    </div>
  )
}

export function SpendingPage() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<CashflowPeriod>('CYCLE')
  const { anchor, setAnchor } = useBudgetPeriod()
  const flow = useCashflowFlow(period, anchor)
  const breakdown = useSpendingByCategory(period, anchor)

  const hasFlow = (flow.data?.nodes.length ?? 0) > 0
  const isError = flow.isError || breakdown.isError
  const isLoading = flow.isLoading || breakdown.isLoading

  return (
    <div className="space-y-4">
      <BudgetToolbar
        lead={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {t('budget.flow.subtitle')}
            <Link
              to="/budget/transactions"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-primary transition-colors hover:text-foreground"
            >
              <Receipt className="size-3.5" aria-hidden="true" />
              {t('transactions.viewAll')}
            </Link>
          </span>
        }
      >
        <PeriodNavigator
          period={period}
          from={flow.data?.from}
          to={flow.data?.to}
          onAnchorChange={setAnchor}
        />
        <PeriodToggle value={period} onChange={(p) => { setPeriod(p); setAnchor(undefined) }} />
      </BudgetToolbar>

      {isError && (
        <ErrorState
          message={t('budget.flow.error')}
          onRetry={() => {
            flow.refetch()
            breakdown.refetch()
          }}
        />
      )}

      {isLoading && !isError && (
        <>
          <Skeleton className="h-[360px] w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </>
      )}

      {!isLoading && !isError && flow.data && (
        <Card>
          <CardHeader className="gap-1.5">
            <CardTitle>{t('budget.flow.diagram')}</CardTitle>
            <FlowSummary income={flow.data.income} expense={flow.data.expense} net={flow.data.net} />
          </CardHeader>
          <CardContent>
            {!hasFlow ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('budget.flow.empty')}</p>
            ) : (
              <CashflowSankey flow={flow.data} />
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && breakdown.data && breakdown.data.categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('budget.flow.breakdown')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            {buildDisplay(breakdown.data.categories).map((item) =>
              item.kind === 'leaf' ? (
                <BreakdownRow
                  key={item.row.categoryId ?? 'uncategorized'}
                  row={item.row}
                  total={breakdown.data.totalExpense}
                />
              ) : (
                <ParentGroupRows
                  key={`group-${item.group.parentId}`}
                  group={item.group}
                  total={breakdown.data.totalExpense}
                />
              ),
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
