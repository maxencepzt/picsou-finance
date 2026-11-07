import { Skeleton } from '@/components/ui/skeleton'
import { useLoanSummary } from '@/features/accounts/hooks'
import { LoanProgressCard } from './LoanProgressCard'
import { LoanCostSummaryTable } from './LoanCostSummaryTable'
import { LoanAmortizationChart } from './LoanAmortizationChart'

interface LoanDetailSectionProps {
  accountId: number
}

/** A loan's amortisation curve beside its repayment progress, then what it costs in total. */
export function LoanDetailSection({ accountId }: LoanDetailSectionProps) {
  const { data, isLoading, isError } = useLoanSummary(accountId)

  if (isLoading) return <Skeleton className="h-72 w-full rounded-2xl" />

  if (isError || !data) return null

  const { summary, schedule } = data

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <LoanAmortizationChart schedule={schedule} className="xl:col-span-2" />
        <LoanProgressCard summary={summary} className={schedule.length === 0 ? 'xl:col-span-3' : undefined} />
      </div>
      <LoanCostSummaryTable summary={summary} />
    </div>
  )
}
