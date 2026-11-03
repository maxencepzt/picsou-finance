import { assetClassOf, sumBy, type AssetClassKey } from '@/lib/asset-classes'
import type { AccountType } from '@/types/api'

/** Beyond this many years the simulation stops and answers "not within a lifetime". */
export const MAX_YEARS = 60

/** Simulator defaults the profile does not carry. */
export const DEFAULT_RETURN = 5
export const DEFAULT_WITHDRAWAL = 4
/** Used only until the member states their essential expenses in the allocation targets. */
export const DEFAULT_EXPENSES = 2000

/** What a retirement can be drawn from by selling it off: property and SCPI are left out. */
const FINANCIAL: AssetClassKey[] = ['cash', 'savings', 'equity', 'crypto', 'funds']

/** Financial assets today: positive balances of cash, savings, equity, crypto and funds accounts. */
export function financialAssets(distribution: { accountType: AccountType; balanceEur: number }[]): number {
  return sumBy(distribution.map((d) => ({ type: d.accountType, amount: d.balanceEur })), assetClassOf, FINANCIAL)
    .reduce((sum, row) => sum + row.amount, 0)
}

/** Monthly savings today: the capacity stated in the profile, else what the budget cycle left over. */
export function currentPace(capacity: number | null | undefined, cycleNet: number | null | undefined): number {
  return capacity ?? Math.max(0, cycleNet ?? 0)
}

/** Capital whose yearly withdrawal at `withdrawalPct` covers the expenses: expenses × 12 ÷ rate. */
export function fiTarget(monthlyExpenses: number, withdrawalPct: number): number {
  return (monthlyExpenses * 12) / (withdrawalPct / 100)
}

/** Capital after `years`, compounding yearly then adding a year of savings. */
export function capitalAfter(start: number, monthly: number, annualPct: number, years: number): number {
  let capital = start
  for (let i = 0; i < years; i++) capital = capital * (1 + annualPct / 100) + monthly * 12
  return capital
}

/** Whole years until the capital reaches the target, or null when it does not within MAX_YEARS. */
export function yearsToTarget(start: number, monthly: number, annualPct: number, target: number): number | null {
  let capital = start
  for (let years = 0; years <= MAX_YEARS; years++) {
    if (capital >= target) return years
    capital = capital * (1 + annualPct / 100) + monthly * 12
  }
  return null
}

/** A value brought onto a slider's grid: rounded to its step, kept within its bounds. */
export function snap(value: number, min: number, max: number, step: number): number {
  return Math.min(max, Math.max(min, Math.round(value / step) * step))
}

/** What the simulator starts from, gathered by the page from the dashboard, profile, budget and targets. */
export interface FiBaseline {
  /** Financial assets today. */
  start: number
  /** Monthly savings today. */
  pace: number
  /** Monthly essential expenses: the stated figure, else DEFAULT_EXPENSES. */
  expenses: number
  expensesStated: boolean
  /** Null without a birth date: durations are shown instead of ages. */
  age: number | null
  retirementAge: number | null
}
