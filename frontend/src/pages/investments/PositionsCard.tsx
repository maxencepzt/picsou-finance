import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PortfolioLine } from '@/features/accounts/hooks'
import { useMoney } from '@/hooks/use-money'
import { useTableSort, type SortColumns } from '@/hooks/use-table-sort'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { Delta } from '@/components/shared/Delta'
import { HoldingDetailModal } from '@/components/shared/HoldingDetailModal'
import { HoldingLogo } from '@/components/shared/HoldingLogo'
import { PriceFreshnessDot } from '@/components/shared/PriceFreshnessDot'
import { ScrollStrip } from '@/components/shared/ScrollStrip'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { SortableTableHead } from '@/components/shared/SortableTableHead'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { accountTypeLabelKey } from '@/lib/constants'
import { formatLocalDate, formatPercent } from '@/lib/utils'
import { WRAPPERS, wrapperOf, type Wrapper } from './investments'

type Filter = 'all' | Wrapper
type SortKey = 'name' | 'quantity' | 'avgBuyIn' | 'price' | 'value' | 'pnl'

/** A line's unit price in euros, read back from its value: the portfolio line carries no quote. */
const unitPrice = (l: PortfolioLine) => (l.quantity > 0 && !l.isCash ? l.valueEur / l.quantity : null)

const COLUMNS: SortColumns<PortfolioLine, SortKey> = {
  name: { kind: 'text', value: (l) => l.name },
  quantity: { kind: 'number', value: (l) => (l.isCash ? null : l.quantity) },
  avgBuyIn: { kind: 'number', value: (l) => l.averageBuyIn },
  price: { kind: 'number', value: unitPrice },
  value: { kind: 'number', value: (l) => l.valueEur },
  pnl: { kind: 'number', value: (l) => l.pnlEur },
}

const WRAPPER_LABEL: Record<Wrapper, string> = {
  PEA: 'accountTypes.pea',
  COMPTE_TITRES: 'accountTypes.compteTitres',
  CRYPTO: 'accountTypes.crypto',
  other: 'investments.positions.other',
}

/** Every investment line, filterable by wrapper, with its weight in what is shown. */
export function PositionsCard({ lines }: { lines: PortfolioLine[] }) {
  const { t } = useTranslation()
  const money = useMoney()
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<PortfolioLine | null>(null)

  const present = WRAPPERS.filter((w) => lines.some((l) => wrapperOf(l.accountType) === w))
  const shown = filter === 'all' ? lines : lines.filter((l) => wrapperOf(l.accountType) === filter)
  const { rows, sort, toggle } = useTableSort(shown, COLUMNS, { key: 'value', direction: 'desc' })
  const total = shown.reduce((sum, l) => sum + l.valueEur, 0)
  const optional = 'hidden md:table-cell'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('investments.positions.title')}</CardTitle>
        <CardDescription>{t('investments.positions.count', { count: shown.length })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {present.length > 1 && (
          <ScrollStrip activeKey={filter}>
            <SegmentedControl
              ariaLabel={t('investments.positions.filter')}
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('portfolio.all') },
                ...present.map((w) => ({ value: w, label: t(WRAPPER_LABEL[w]) })),
              ]}
            />
          </ScrollStrip>
        )}
        <TooltipProvider>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="name" sort={sort} onSort={toggle}>{t('investments.positions.position')}</SortableTableHead>
                <TableHead>{t('investments.positions.wrapper')}</TableHead>
                <SortableTableHead sortKey="quantity" sort={sort} onSort={toggle} align="right" className={optional}>{t('holdings.quantity')}</SortableTableHead>
                <SortableTableHead sortKey="avgBuyIn" sort={sort} onSort={toggle} align="right" className={optional}>{t('investments.positions.avgCost')}</SortableTableHead>
                <SortableTableHead sortKey="price" sort={sort} onSort={toggle} align="right" className={optional}>{t('investments.positions.price')}</SortableTableHead>
                <SortableTableHead sortKey="value" sort={sort} onSort={toggle} align="right">{t('portfolio.value')}</SortableTableHead>
                <SortableTableHead sortKey="pnl" sort={sort} onSort={toggle} align="right">{t('investments.positions.pnl')}</SortableTableHead>
                <TableHead className="text-right">{t('investments.positions.weight')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => {
                const name = l.nameKey ? t(l.nameKey) : l.name
                const price = unitPrice(l)
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <HoldingLogo logoUrl={l.logoUrl} logoUrlDark={l.logoUrlDark} ticker={l.ticker ?? ''} name={name} />
                        <div className="min-w-0">
                          {l.isCash
                            ? <div className="font-semibold">{name}</div>
                            : (
                              <button type="button" onClick={() => setSelected(l)} className="text-left font-semibold hover:text-primary">
                                {name}
                              </button>
                            )}
                          <div className="text-xs text-muted-foreground">{[l.isCash ? null : l.ticker, l.accountName].filter(Boolean).join(' · ')}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{t(accountTypeLabelKey(l.accountType))}</Badge></TableCell>
                    <TableCell className={`text-right tabular-nums ${optional}`}>{l.isCash ? '—' : money.quantity(l.quantity)}</TableCell>
                    <TableCell className={`text-right ${optional}`}>
                      {l.averageBuyIn != null ? <CurrencyDisplay value={l.averageBuyIn} publicQuote className="tabular-nums" /> : '—'}
                    </TableCell>
                    <TableCell className={`text-right ${optional}`}>
                      {price != null ? <CurrencyDisplay value={price} publicQuote className="tabular-nums" /> : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <PriceFreshnessDot priceUpdatedAt={l.priceUpdatedAt} staleAsOf={l.priceStale ? l.priceAsOf : null} />
                        <CurrencyDisplay value={l.valueEur} className="font-semibold tabular-nums" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {l.pnlEur != null ? (
                        // Since when the percentage runs: the first recorded purchase, when the
                        // account has a purchase history; a positions-only sync has none.
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="inline-flex cursor-help rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
                              <Delta amount={l.pnlEur} percent={l.pnlPercent} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {l.firstBuyDate
                              ? t('investments.positions.pnlSince', { date: formatLocalDate(l.firstBuyDate) })
                              : t('investments.positions.pnlSinceUnknown')}
                          </TooltipContent>
                        </Tooltip>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {total > 0 ? formatPercent((l.valueEur / total) * 100) : '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        </TooltipProvider>
      </CardContent>
      {selected && <HoldingDetailModal line={selected} onClose={() => setSelected(null)} />}
    </Card>
  )
}
