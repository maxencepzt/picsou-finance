import type { WealthTier } from '@/types/api'

/** One asset-class colour per tier, so the same money keeps the same colour across the app. */
export const TIER_COLORS: Record<WealthTier, string> = {
  SAFETY_NET: 'var(--class-cash)',
  REAL_ESTATE: 'var(--class-realestate)',
  EQUITY: 'var(--class-equity)',
  CRYPTO: 'var(--class-crypto)',
  ALTERNATIVE: 'var(--class-scpi)',
}
