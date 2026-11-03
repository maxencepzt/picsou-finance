import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid, PieChart, RectangleHorizontal } from 'lucide-react'
import { BreakdownDonut, BreakdownTreemap, type BreakdownView, type ChartItem } from '@/components/shared/BreakdownChart'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { formatPercent } from '@/lib/utils'

export interface BreakdownItem {
  key: string
  label: string
  /** Positive amounts only: a part-to-whole has no room for a negative part. */
  amount: number
  color: string
  hint?: string
}

interface BreakdownProps {
  items: BreakdownItem[]
  /** What the donut's centre says above the total. */
  centerLabel: string
  defaultView?: BreakdownView
  ariaLabel: string
}

/**
 * A part-to-whole drawn three ways — stacked bar, donut or treemap — with the legend always
 * under it (names, amounts, shares), so the colour never carries the identity alone.
 */
export function Breakdown({ items, centerLabel, defaultView = 'donut', ariaLabel }: BreakdownProps) {
  const { t } = useTranslation()
  const [view, setView] = useState<BreakdownView>(defaultView)
  const [selected, setSelected] = useState<string | null>(null)
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const chartItems: ChartItem[] = items.map((item) => ({
    key: item.key,
    label: item.label,
    color: item.color,
    percent: total > 0 ? (item.amount / total) * 100 : 0,
  }))
  const summary = chartItems.map((item) => `${item.label} ${formatPercent(item.percent, { fractionDigits: 1 })}`).join(', ')

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        className="self-end"
        ariaLabel={t('breakdown.view')}
        value={view}
        onChange={setView}
        options={[
          { value: 'bar', label: t('breakdown.bar'), icon: RectangleHorizontal },
          { value: 'donut', label: t('breakdown.donut'), icon: PieChart },
          { value: 'treemap', label: t('breakdown.treemap'), icon: LayoutGrid },
        ]}
      />

      <div role="img" aria-label={`${ariaLabel} : ${summary}`}>
        {view === 'bar' && (
          <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {chartItems.map((item) => (
              <span key={item.key} style={{ width: `${item.percent}%`, backgroundColor: item.color }} />
            ))}
          </div>
        )}
        {view === 'donut' && (
          <div className="relative">
            <BreakdownDonut items={chartItems} selected={selected} onSelect={setSelected} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">{centerLabel}</span>
              <CurrencyDisplay value={total} className="text-base font-bold tabular-nums text-foreground" />
            </div>
          </div>
        )}
        {view === 'treemap' && <BreakdownTreemap items={chartItems} selected={selected} onSelect={setSelected} />}
      </div>

      <ul className="flex flex-col gap-2">
        {chartItems.map((item, index) => (
          <li key={item.key} className="grid grid-cols-[10px_minmax(0,1fr)_auto_3.5rem] items-center gap-2 text-sm">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
            {/* Label and hint truncate on their own lines: a long "Apple Inc. · PEA BoursoBank" must not push the row wide. */}
            <span className="min-w-0" title={items[index].hint ? `${item.label} · ${items[index].hint}` : item.label}>
              <span className="block truncate">{item.label}</span>
              {items[index].hint && <span className="block truncate text-xs text-muted-foreground">{items[index].hint}</span>}
            </span>
            <CurrencyDisplay value={items[index].amount} className="font-semibold tabular-nums text-foreground" />
            <span className="text-right tabular-nums text-muted-foreground">{formatPercent(item.percent, { fractionDigits: 1 })}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
