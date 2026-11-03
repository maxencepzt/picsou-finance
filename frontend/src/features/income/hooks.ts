import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useAccounts, useRealEstateSummary } from '@/features/accounts/hooks'
import { useUpcomingDividends } from '@/features/dividends/hooks'
import { savingsApi } from '@/features/savings/api'
import { QUERY_STALE_TIMES } from '@/lib/constants'
import { incomeSchedule, incomeTotals, type SavingsInterestLine } from './passive-income'

/**
 * Passive income over the next twelve months, aggregated on the client from what the backend
 * already serves: the dividend and SCPI forecast, the monthly rent of the properties, and the
 * yearly interest projection of each configured passbook.
 */
export function usePassiveIncome() {
  const [from] = useState(() => new Date())
  const dividends = useUpcomingDividends(366)
  const realEstate = useRealEstateSummary()
  const { data: accounts } = useAccounts()
  const passbooks = (accounts ?? []).filter((account) => account.savingsConfig != null)
  const interest = useQueries({
    queries: passbooks.map((account) => ({
      queryKey: ['savings', 'interest', account.id],
      queryFn: () => savingsApi.getInterest(account.id),
      staleTime: QUERY_STALE_TIMES.accountDetail,
    })),
  })

  const savings: SavingsInterestLine[] = passbooks.flatMap((account, i) => {
    const projection = interest[i]?.data
    return projection ? [{ accountId: account.id, name: account.name, projection }] : []
  })
  const months = incomeSchedule(from, dividends.data ?? [], realEstate.data?.monthlyRentalIncome ?? 0, savings)

  return {
    isLoading: dividends.isLoading || realEstate.isLoading || interest.some((q) => q.isLoading),
    // Any failed source fails the total: a silently missing source would understate it.
    isError: dividends.isError || realEstate.isError || interest.some((q) => q.isError),
    refetch: () => {
      void dividends.refetch()
      void realEstate.refetch()
      for (const q of interest) void q.refetch()
    },
    months,
    totals: incomeTotals(months),
    upcoming: dividends.data ?? [],
    savings,
    monthlyRent: realEstate.data?.monthlyRentalIncome ?? 0,
  }
}
