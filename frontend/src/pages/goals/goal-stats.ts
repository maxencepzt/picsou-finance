import { getLocale, normalizeIntlLocale } from '@/lib/utils'
import type { GoalProgress } from '@/types/api'

export type GoalStatus = 'achieved' | 'waiting' | 'onTrack' | 'behind'

/** The card badge's verdict, shared with the KPI row so the two cannot disagree. */
export function goalStatus(goal: GoalProgress): GoalStatus {
  if ((goal.monthlyNeeded ?? 0) <= 0) return 'achieved'
  if (goal.avgMonthlyContribution == null) return 'waiting'
  return goal.isOnTrack ? 'onTrack' : 'behind'
}

export interface SavingsSummary {
  saved: number
  target: number
  /** Achieved or on track, out of `count`. */
  onTrack: number
  behind: number
  count: number
  /** What the goals still to reach ask for per month. */
  required: number
  /** What those same goals averaged per month; null while none of them has any history. */
  averaged: number | null
}

/**
 * The KPI row of the savings section, from the goal list alone.
 *
 * An account linked to two goals counts in both, as it does on each card: the backend has no
 * partial allocation, and a KPI that disagreed with the cards under it would read as a bug.
 * Required and averaged cover the same goals (those not yet achieved), so they can be compared.
 */
export function summarizeSavings(goals: GoalProgress[]): SavingsSummary {
  const pending = goals.filter((g) => goalStatus(g) !== 'achieved')
  const withHistory = pending.filter((g) => g.avgMonthlyContribution != null)
  return {
    saved: goals.reduce((sum, g) => sum + g.currentTotal, 0),
    target: goals.reduce((sum, g) => sum + (g.targetAmount ?? 0), 0),
    onTrack: goals.filter((g) => ['achieved', 'onTrack'].includes(goalStatus(g))).length,
    behind: goals.filter((g) => goalStatus(g) === 'behind').length,
    count: goals.length,
    required: pending.reduce((sum, g) => sum + Math.max(0, g.monthlyNeeded ?? 0), 0),
    averaged: withHistory.length > 0
      ? withHistory.reduce((sum, g) => sum + (g.avgMonthlyContribution ?? 0), 0)
      : null,
  }
}

/** Beyond this, "reached in 2093" is not a forecast anyone should read. */
const MAX_MONTHS = 600

export type Reach =
  | { kind: 'onTime'; month: string }
  | { kind: 'late'; month: string; monthsLate: number }
  /** The average is zero, negative, or too small to get there within fifty years. */
  | { kind: 'never' }

/** `yyyy-MM` plus n months. */
function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const index = y! * 12 + (m! - 1) + n
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty! - fy!) * 12 + (tm! - fm!)
}

/** Last day of a `yyyy-MM`, as `yyyy-MM-dd`. */
function monthEnd(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${String(new Date(Date.UTC(y!, m!, 0)).getUTCDate()).padStart(2, '0')}`
}

/**
 * When the goal is reached if the member keeps saving their average monthly amount.
 *
 * The backend sends no projected date, so it is computed here. Each month's saving lands at its
 * end, the current month counting as the first, so the goal is reached at the end of month
 * `today + n − 1` with `n = ⌈remaining / average⌉`. Late when that end falls after the deadline,
 * by at least one month.
 *
 * Null when there is nothing to project: a recurring plan, a goal already reached, or no
 * history yet.
 */
export function projectReach(goal: GoalProgress, today: string): Reach | null {
  if (goal.targetAmount == null || goal.deadline == null || goal.avgMonthlyContribution == null) return null
  const remaining = goal.targetAmount - goal.currentTotal
  if (remaining <= 0) return null
  const average = goal.avgMonthlyContribution
  if (average <= 0) return { kind: 'never' }
  // The epsilon keeps 900 / 300 at 3 when floating point makes it 3.0000000000000004.
  const months = Math.ceil(remaining / average - 1e-9)
  if (months > MAX_MONTHS) return { kind: 'never' }
  const month = addMonths(today.slice(0, 7), months - 1)
  if (monthEnd(month) <= goal.deadline) return { kind: 'onTime', month }
  return { kind: 'late', month, monthsLate: Math.max(1, monthsBetween(goal.deadline.slice(0, 7), month)) }
}

/** "mars 2027" from `2027-03`. */
export function formatMonthYear(ym: string, locale = getLocale()): string {
  const [y, m] = ym.split('-').map(Number)
  return new Intl.DateTimeFormat(normalizeIntlLocale(locale), { month: 'long', year: 'numeric' }).format(new Date(y!, m! - 1, 1))
}

export interface TrajectoryRow {
  t: number
  saved?: number
  ideal?: number
}

/**
 * Rows of the card's trajectory chart: what the linked accounts held, from the goal's creation
 * (or the start of the 12 months of history when it is older), and the straight line from that
 * first point to the target at the deadline.
 *
 * The line starts from the first plotted balance, not from zero, for the same reason as the
 * detail chart: the accounts held money before the goal existed, and a line from zero would make
 * every goal look ahead. Null with fewer than two points, or no deadline to draw towards.
 */
export function trajectoryRows(
  history: { date: string; total: number }[],
  goal: GoalProgress,
): TrajectoryRow[] | null {
  if (goal.deadline == null || goal.targetAmount == null) return null
  const created = goal.createdAt.slice(0, 10)
  const sinceCreation = history.filter((p) => p.date >= created)
  const points = sinceCreation.length >= 2 ? sinceCreation : history
  if (points.length < 2) return null
  const rows: TrajectoryRow[] = points.map((p) => ({ t: Date.parse(p.date), saved: p.total }))
  rows[0]!.ideal = points[0]!.total
  const end = Date.parse(goal.deadline)
  // A deadline already passed ends the line where the history ends instead of folding it back.
  rows.push({ t: Math.max(end, rows.at(-1)!.t), ideal: goal.targetAmount })
  return rows
}
