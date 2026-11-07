import type { LoanInstallment } from '@/types/api'

/** The HCSF cap French lenders apply to the debt-to-income ratio (payments ÷ net income). */
export const DEBT_TO_INCOME_THRESHOLD = 35

/**
 * Flattens a shared component's own `Card` when it sits inside one of this page's cards, so a
 * chart reads as part of the card instead of a box within a box.
 */
export const EMBEDDED_CARD =
  '[&>[data-slot=card]]:bg-transparent [&>[data-slot=card]]:p-0 [&>[data-slot=card]]:ring-0 [&_[data-slot=card-header]]:px-0 [&_[data-slot=card-content]]:px-0 ' +
  // Without padding, the card's clipping cut the title's accent (É) and the chart's edge labels
  // ("nov. 26", "Aujourd'hui"); the host card's own padding leaves them room.
  '[&>[data-slot=card]]:overflow-visible [&_.recharts-surface]:overflow-visible ' +
  // The embedded chart's title is a section label of the host card, never larger than the card's own title.
  '[&_[data-slot=card-title]]:text-[13px] [&_[data-slot=card-title]]:font-medium [&_[data-slot=card-title]]:text-muted-foreground'

/** Interest over the whole schedule, and the part of it in the instalments not yet paid. */
export function loanInterest(schedule: LoanInstallment[], paidInstallments: number): { total: number; remaining: number } {
  return schedule.reduce(
    (acc, row) => ({
      total: acc.total + row.interest,
      remaining: row.number > paidInstallments ? acc.remaining + row.interest : acc.remaining,
    }),
    { total: 0, remaining: 0 },
  )
}

export interface DebtToIncome {
  /** Monthly payments over monthly income, in points. */
  percent: number
  over: boolean
  /** Right end of the gauge, in points: 60, or the ratio itself when it is higher. */
  scale: number
  /** Bar fill and threshold mark, as a percentage of the gauge width. */
  fill: number
  mark: number
}

/** Null when no income is declared: a ratio over an unknown income would be a guess. */
export function debtToIncome(monthlyPayments: number, monthlyIncome: number | null | undefined): DebtToIncome | null {
  if (monthlyIncome == null || monthlyIncome <= 0) return null
  const percent = (monthlyPayments / monthlyIncome) * 100
  const scale = Math.max(60, percent)
  return {
    percent,
    over: percent > DEBT_TO_INCOME_THRESHOLD,
    scale,
    fill: (percent / scale) * 100,
    mark: (DEBT_TO_INCOME_THRESHOLD / scale) * 100,
  }
}

/** "juin 2023" from `2023-06-01`, built from the parts so no time zone moves it a month back. */
export function monthYear(isoDate: string, locale: string): string {
  const [year, month] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}
