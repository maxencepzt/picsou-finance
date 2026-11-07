import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { accountsApi } from '@/features/accounts/api'
import { QUERY_STALE_TIMES } from '@/lib/constants'
import type { RealizedPnlResponse } from '@/types/api'

/** Module scope: a stable `combine` is what lets TanStack memoise its result between renders. */
function combineRealized(results: UseQueryResult<RealizedPnlResponse>[]) {
  return { data: results.map((r) => r.data), isLoading: results.some((r) => r.isLoading) }
}

/**
 * Realised P&L of several accounts at once, in the order of `accountIds`. Same keys as
 * `useRealizedPnl`, so both share one cache and the invalidations a transaction edit already sends.
 */
export function useRealizedPnls(accountIds: number[]) {
  return useQueries({
    queries: accountIds.map((id) => ({
      queryKey: ['accounts', id, 'realized-pnl'],
      queryFn: () => accountsApi.realizedPnl(id),
      staleTime: QUERY_STALE_TIMES.accountDetail,
    })),
    combine: combineRealized,
  })
}
