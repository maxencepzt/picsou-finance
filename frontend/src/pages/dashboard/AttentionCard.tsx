import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AlertTriangle, CircleAlert, ListChecks, CheckCircle2, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePortfolio } from '@/features/accounts/hooks'
import { useBudgets, useUncategorized } from '@/features/budget/hooks'
import { useBankSyncStatus } from '@/features/sync/hooks'
import { cn } from '@/lib/utils'

interface Item {
  key: string
  icon: LucideIcon
  tone: string
  to: string
  text: ReactNode
}

/** What needs a decision from the member: connections, stale prices, budgets, transactions. */
export function AttentionCard() {
  const { t } = useTranslation()
  const { data: connections = [] } = useBankSyncStatus()
  const { data: portfolio = [] } = usePortfolio()
  const { data: budgets = [] } = useBudgets()
  const { data: uncategorized = [] } = useUncategorized()

  const failed = connections.filter((c) => c.status === 'FAILED')
  const stale = portfolio.filter((line) => line.priceStale)
  const over = budgets.filter((b) => b.overBudget)

  const items: Item[] = [
    ...(failed.length > 0 ? [{
      key: 'sync', icon: AlertTriangle, tone: 'text-warning', to: '/sync',
      text: t('dashboard.bankSyncFailed', { count: failed.length, institution: failed[0].institutionName }),
    }] : []),
    ...(over.length > 0 ? [{
      key: 'budget', icon: CircleAlert, tone: 'text-loss', to: '/budget/envelopes',
      text: t('dashboard.attention.overBudget', { count: over.length, name: over[0].categoryName }),
    }] : []),
    ...(uncategorized.length > 0 ? [{
      key: 'review', icon: ListChecks, tone: 'text-primary', to: '/budget/review',
      text: t('dashboard.attention.uncategorized', { count: uncategorized.length }),
    }] : []),
    ...(stale.length > 0 ? [{
      key: 'prices', icon: AlertTriangle, tone: 'text-warning', to: '/investments',
      text: t('dashboard.attention.stalePrices', { count: stale.length, name: stale[0].name }),
    }] : []),
  ]

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('dashboard.attention.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-gain" aria-hidden="true" />
            {t('dashboard.attention.none')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.key}>
                <Link to={item.to} className="flex items-start gap-2.5 rounded-xl bg-muted px-3 py-2.5 text-[13px] text-foreground transition-[background-color] hover:bg-muted/70">
                  <item.icon className={cn('mt-0.5 size-4 shrink-0', item.tone)} aria-hidden="true" />
                  <span>{item.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
