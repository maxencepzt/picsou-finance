import { useTranslation } from 'react-i18next'
import { ScrollStrip } from '@/components/shared/ScrollStrip'
import { SegmentedControl } from '@/components/shared/SegmentedControl'

export type TimeRange = '24H' | '7D' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL'

interface TimeRangeSelectorProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
}

const RANGES: TimeRange[] = ['24H', '7D', '1M', '3M', 'YTD', '1Y', 'ALL']

/** The period switch of every value chart: one compact segmented control that scrolls on a phone. */
export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  const { t } = useTranslation()
  return (
    <ScrollStrip activeKey={value}>
      <SegmentedControl
        ariaLabel={t('dashboard.rangeLabel')}
        value={value}
        onChange={onChange}
        options={RANGES.map((range) => ({ value: range, label: t(`dashboard.ranges.${range}`) }))}
      />
    </ScrollStrip>
  )
}
