import { Fragment } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { BalanceHistoryChart } from '@/components/shared/BalanceHistoryChart'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { HoldingsTable } from '@/components/shared/HoldingsTable'
import { PositionsByProduct } from '@/components/shared/PositionsByProduct'
import { TransactionRow } from '@/components/shared/TransactionRow'
import { useAccountHistory, useAccountPositions, useAccountTransactions, useHoldingsWithLivePrices } from '@/features/accounts/hooks'
import { accountTypeLabelKey, HOLDING_ACCOUNT_TYPES } from '@/lib/constants'
import { formatLocalDate } from '@/lib/utils'
import type { Account } from '@/types/api'
import { signedBalance } from './account-groups'
import { AccountMark } from './AccountRow'

/** Positions of an investment account, as the detail page shows them (read-only here). */
function PanelHoldings({ accountId }: { accountId: number }) {
  const { data: holdings } = useHoldingsWithLivePrices(accountId)
  const { data: positions } = useAccountPositions(accountId)
  if (!holdings) return <Skeleton className="h-32 w-full rounded-xl" />
  if (positions && positions.length > 0) return <PositionsByProduct positions={positions} />
  return holdings.length > 0 ? <HoldingsTable holdings={holdings} /> : null
}

interface PanelActions {
  onEdit: (account: Account) => void
  /** Called for a top-level account only: a pocket goes away with its wallet. */
  onDelete: (account: Account) => void
}

function PanelBody({ account, onEdit, onDelete }: { account: Account } & PanelActions) {
  const { t } = useTranslation()
  const { data: history, isLoading: historyLoading } = useAccountHistory(account.id)
  const { data: transactions, isLoading: txLoading } = useAccountTransactions(account.id)
  const chartData = (history ?? []).map((s) => ({ date: s.date, balance: s.balance }))
  const latest = [...(transactions ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <CurrencyDisplay value={signedBalance(account)} className="text-3xl leading-tight font-semibold tracking-tight tabular-nums text-foreground" />

      {historyLoading ? (
        <Skeleton className="h-[200px] w-full rounded-xl" />
      ) : chartData.length > 1 && (
        <Card>
          <CardHeader><CardTitle>{t('accounts.history')}</CardTitle></CardHeader>
          <CardContent><BalanceHistoryChart data={chartData} /></CardContent>
        </Card>
      )}

      {HOLDING_ACCOUNT_TYPES.includes(account.type) && <PanelHoldings accountId={account.id} />}

      <Card>
        <CardHeader><CardTitle>{t('accounts.panel.latestTransactions')}</CardTitle></CardHeader>
        <CardContent>
          {txLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : latest.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('accounts.noTransactions')}</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {latest.map((tx, i) => (
                <Fragment key={tx.id}>
                  {latest[i - 1]?.date !== tx.date && (
                    <p className="px-1 pt-2 text-xs font-medium text-muted-foreground first:pt-0">{formatLocalDate(tx.date)}</p>
                  )}
                  <TransactionRow transaction={tx} />
                </Fragment>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit and delete live here too: below `sm` the rows leave them out for the name. */}
      <div className="flex flex-wrap gap-2">
        <Button asChild className="flex-1 px-4">
          <Link to={`/accounts/${account.id}`}>
            {t('accounts.panel.viewDetail')}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button variant="outline" className="px-4" onClick={() => onEdit(account)}>
          <Pencil className="size-4" />
          {t('common.edit')}
        </Button>
        {account.parentAccountId == null && (
          <Button
            variant="outline"
            size="icon"
            className="text-destructive hover:text-destructive"
            aria-label={t('common.delete')}
            title={t('common.delete')}
            onClick={() => onDelete(account)}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * A right-hand sheet over the accounts list: balance history, positions, latest transactions and
 * a link to the full detail page. Full width on a phone. Reads the detail page's own queries, so
 * opening the detail afterwards is served from the cache.
 */
export function AccountPanel({ account, onClose, ...actions }: { account: Account | null; onClose: () => void } & PanelActions) {
  const { t } = useTranslation()
  return (
    <Sheet open={account != null} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        side="right"
        className="overflow-y-auto text-sm data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        {account && (
          <>
            <SheetHeader className="flex-row items-center gap-3 p-4 pr-12">
              <AccountMark account={account} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <SheetTitle className="truncate text-base font-bold">{account.name}</SheetTitle>
                <SheetDescription className="truncate">
                  {t(accountTypeLabelKey(account.type))}{account.provider ? ` · ${account.provider}` : ''}
                </SheetDescription>
              </div>
            </SheetHeader>
            <PanelBody key={account.id} account={account} {...actions} />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
