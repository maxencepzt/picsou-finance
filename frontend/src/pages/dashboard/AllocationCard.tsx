import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Breakdown, type BreakdownItem } from '@/components/shared/Breakdown'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { ASSET_CLASS_ORDER, assetClassColor, assetClassOf, sumBy } from '@/lib/asset-classes'
import type { DashboardData } from '@/types/api'

type GroupBy = 'class' | 'account'

/** Gross assets split by asset class (the default) or by account. */
export function AllocationCard({ distribution }: { distribution: DashboardData['distribution'] }) {
  const { t } = useTranslation()
  const [groupBy, setGroupBy] = useState<GroupBy>('class')

  const items: BreakdownItem[] = groupBy === 'class'
    ? sumBy(distribution.map((d) => ({ type: d.accountType, amount: d.balanceEur })), assetClassOf, ASSET_CLASS_ORDER)
        .sort((a, b) => b.amount - a.amount)
        .map(({ key, amount }) => ({ key, amount, label: t(`assetClasses.${key}`), color: assetClassColor(key) }))
    : distribution
        .filter((d) => d.balanceEur > 0)
        .sort((a, b) => b.balanceEur - a.balanceEur)
        .map((d) => ({ key: String(d.accountId), amount: d.balanceEur, label: d.name, color: d.color }))

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('dashboard.distribution')}</CardTitle>
        <CardAction>
          <SegmentedControl
            ariaLabel={t('dashboard.allocationGroupBy')}
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: 'class', label: t('dashboard.byClass') },
              { value: 'account', label: t('dashboard.byAccount') },
            ]}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0
          ? <p className="text-sm text-muted-foreground">{t('dashboard.noAssets')}</p>
          : <Breakdown items={items} centerLabel={t('dashboard.grossAssets')} ariaLabel={t('dashboard.distribution')} />}
      </CardContent>
    </Card>
  )
}
