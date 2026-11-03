import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pyramid, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAllocationTargets, useWealthPyramid } from '@/features/analysis/hooks'
import { useDashboard } from '@/features/dashboard/hooks'
import { useMemberProfile } from '@/features/profile/hooks'
import { useCashflow } from '@/features/budget/hooks'
import { PyramidSection } from './PyramidSection'
import { ProjectionSection } from './ProjectionSection'
import { AllocationTargetsModal } from './AllocationTargetsModal'
import { FinancialIndependenceCard, FinancialIndependenceSimulator } from './FinancialIndependence'
import { DEFAULT_EXPENSES, currentPace, financialAssets, type FiBaseline } from './fi-math'

export function AnalysisPage() {
  const { t } = useTranslation()
  const pyramid = useWealthPyramid()
  const targets = useAllocationTargets()
  const dashboard = useDashboard()
  const profile = useMemberProfile()
  const cashflow = useCashflow('CYCLE')
  const [editing, setEditing] = useState(false)

  const hasWealth = (pyramid.data?.totalAssetsEur ?? 0) !== 0

  // Waits for every input: a simulation drawn from a half-loaded profile would print a duration,
  // then switch to an age a moment later.
  const statedExpenses = targets.data?.monthlyEssentialExpenses
  const baseline: FiBaseline | null =
    dashboard.data && !profile.isLoading && !cashflow.isLoading && !targets.isLoading
      ? {
          start: financialAssets(dashboard.data.distribution),
          pace: currentPace(profile.data?.monthlySavingsCapacity, cashflow.data?.net),
          expenses: statedExpenses != null && statedExpenses > 0 ? statedExpenses : DEFAULT_EXPENSES,
          expensesStated: statedExpenses != null && statedExpenses > 0,
          age: profile.data?.age ?? null,
          retirementAge: profile.data?.targetRetirementAge ?? null,
        }
      : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t('analysis.title')}
        actions={
          <Button variant="outline" onClick={() => setEditing(true)} disabled={!targets.data}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {t('analysis.editTargets')}
          </Button>
        }
      />

      {pyramid.isLoading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-1" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      )}

      {pyramid.isError && (
        <ErrorState
          title={t('analysis.error')}
          onRetry={() => void pyramid.refetch()}
        />
      )}

      {pyramid.data && !hasWealth && (
        <EmptyState
          className="flex-1"
          icon={<Pyramid className="size-12" />}
          title={t('analysis.empty.title')}
          description={t('analysis.empty.description')}
        />
      )}

      {pyramid.data && hasWealth && (
        <div className="flex flex-col gap-4">
          <PyramidSection pyramid={pyramid.data} />
          <div className="flex flex-wrap gap-4">
            <ProjectionSection className="flex-[8_1_34rem]" />
            {baseline && <FinancialIndependenceCard baseline={baseline} className="flex-[4_1_18rem]" />}
          </div>
          {baseline && <FinancialIndependenceSimulator baseline={baseline} />}
        </div>
      )}

      <AllocationTargetsModal
        open={editing}
        onOpenChange={setEditing}
        targets={targets.data}
      />
    </div>
  )
}
