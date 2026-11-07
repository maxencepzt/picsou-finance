import type {
  AssetClass,
  CategoryKind,
  RecurringCadence,
  RecurringRuntimeStatus,
  RecurringStatus,
} from '@/types/api'

/**
 * Static lookup tables for the Budget module — kept in a component-free file so
 * Vite Fast Refresh (react-refresh/only-export-components) stays happy. The
 * components that consume them live in `budget-utils.tsx`.
 */

/** Fallback swatch colour when a category has no colour set. */
export const FALLBACK_COLOR = '#6366f1'

/** i18n key for each category kind. */
export const KIND_META: Record<CategoryKind, { labelKey: string }> = {
  INCOME: { labelKey: 'budget.kind.income' },
  EXPENSE: { labelKey: 'budget.kind.expense' },
  TRANSFER: { labelKey: 'budget.kind.transfer' },
}

export const CADENCE_LABEL_KEY: Record<RecurringCadence, string> = {
  WEEKLY: 'budget.cadence.weekly',
  BIWEEKLY: 'budget.cadence.biweekly',
  MONTHLY: 'budget.cadence.monthly',
  QUARTERLY: 'budget.cadence.quarterly',
  YEARLY: 'budget.cadence.yearly',
}

export const STATUS_LABEL_KEY: Record<RecurringStatus, string> = {
  SUGGESTED: 'budget.recurring.status.suggested',
  CONFIRMED: 'budget.recurring.status.confirmed',
  IGNORED: 'budget.recurring.status.ignored',
}

/** Tone of a status word: its dot and text colour. */
export type StatusTone = 'gain' | 'warning' | 'loss' | 'muted'

/** Series status as a dot and a word: confirmed reads as settled, suggested asks for a look. */
export const STATUS_TONE: Record<RecurringStatus, StatusTone> = {
  CONFIRMED: 'gain',
  SUGGESTED: 'warning',
  IGNORED: 'muted',
}

/**
 * Runtime urgency of a series. SCHEDULED is the quiet default and shows nothing, so it carries no
 * label key — only STALE, LATE and DUE_SOON surface a status on the subscription row.
 */
export const RUNTIME_STATUS_META: Record<
  Exclude<RecurringRuntimeStatus, 'SCHEDULED'>,
  { labelKey: string; tone: StatusTone }
> = {
  STALE: { labelKey: 'budget.recurring.runtime.stale', tone: 'muted' },
  LATE: { labelKey: 'budget.recurring.runtime.late', tone: 'loss' },
  DUE_SOON: { labelKey: 'budget.recurring.runtime.dueSoon', tone: 'warning' },
}

export const ASSET_CLASS_LABEL_KEY: Record<AssetClass, string> = {
  CURRENT: 'budget.asset.current',
  SAVINGS: 'budget.asset.savings',
  INVESTMENT: 'budget.asset.investment',
  OTHER: 'budget.asset.other',
}

/** The app's fixed asset-class colours (DESIGN.md), so the same money keeps its colour here too. */
export const ASSET_CLASS_COLOR: Record<AssetClass, string> = {
  CURRENT: 'var(--class-cash)',
  SAVINGS: 'var(--class-savings)',
  INVESTMENT: 'var(--class-equity)',
  OTHER: 'var(--class-other)',
}
