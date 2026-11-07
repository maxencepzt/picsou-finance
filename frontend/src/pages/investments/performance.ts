import type { Benchmark, BenchmarkKey, FeeLine, FeesSummary, PerformancePoint } from '@/types/api'

/** The performance periods, in months; 0 is all history. */
export const PERF_PERIODS = [3, 6, 12, 36, 60, 0] as const
export type PerfPeriod = (typeof PERF_PERIODS)[number]

/** Index names are proper nouns, the same in every language. */
export const BENCHMARKS: { key: BenchmarkKey; label: string }[] = [
  { key: 'MSCI_WORLD', label: 'MSCI World' },
  { key: 'SP500', label: 'S&P 500' },
  { key: 'CAC40', label: 'CAC 40' },
]

export interface ComparisonPoint {
  date: string
  portfolio: number
  benchmark: number | null
}

/**
 * The portfolio's time-weighted index beside a benchmark, both rebased to 100 on the first date
 * they share. Only the dates present in both are kept (the benchmark has no weekend closes of
 * its own). Without a benchmark, the index is rebased on its own first day, where the API
 * already puts it at 100.
 */
export function compareToBenchmark(points: PerformancePoint[], benchmark: Benchmark['points'] | null | undefined): ComparisonPoint[] {
  if (!benchmark) {
    const base = points.find((p) => p.index > 0)?.index
    return base ? points.filter((p) => p.index > 0).map((p) => ({ date: p.date, portfolio: (p.index / base) * 100, benchmark: null })) : []
  }
  const prices = new Map(benchmark.filter((b) => b.priceEur > 0).map((b) => [b.date, b.priceEur]))
  const common = points.filter((p) => p.index > 0 && prices.has(p.date))
  if (common.length === 0) return []
  const indexBase = common[0].index
  const priceBase = prices.get(common[0].date)!
  return common.map((p) => ({
    date: p.date,
    portfolio: (p.index / indexBase) * 100,
    benchmark: (prices.get(p.date)! / priceBase) * 100,
  }))
}

export interface CostlyLine extends FeeLine {
  terPercent: number
  /** What the fund charges a year on the value held: value × TER. */
  costEur: number
}

/** The lines with a known TER, most expensive a year first; past `top`, they are summed up. */
export function costliestLines(lines: FeeLine[], top = 5): { top: CostlyLine[]; rest: { count: number; costEur: number } | null } {
  const ranked = lines
    .filter((l): l is FeeLine & { terPercent: number } => l.terPercent != null)
    .map((l) => ({ ...l, costEur: (l.valueEur * l.terPercent) / 100 }))
    .sort((a, b) => b.costEur - a.costEur)
  const rest = ranked.slice(top)
  return {
    top: ranked.slice(0, top),
    rest: rest.length > 0 ? { count: rest.length, costEur: rest.reduce((sum, l) => sum + l.costEur, 0) } : null,
  }
}

/** Share of the value whose TER is known, in percent; null when nothing is held. */
export function feeCoverage(fees: Pick<FeesSummary, 'coveredValueEur' | 'totalValueEur'>): number | null {
  return fees.totalValueEur > 0 ? (fees.coveredValueEur / fees.totalValueEur) * 100 : null
}

const DAY = 86_400_000

/**
 * X-axis ticks of a daily chart, as timestamps: evenly spaced days under three months, else the
 * first of every n-th month, at most `max` of them. Recharts would otherwise tick on the data
 * points and print the same month twice.
 */
export function dateTicks(fromMs: number, toMs: number, max = 6): number[] {
  const span = toMs - fromMs
  if (span <= 0) return [fromMs]
  if (span < 92 * DAY) return Array.from({ length: max }, (_, i) => fromMs + (span * i) / (max - 1))
  const months: number[] = []
  const start = new Date(fromMs)
  for (let d = new Date(start.getFullYear(), start.getMonth() + 1, 1); d.getTime() <= toMs; d.setMonth(d.getMonth() + 1)) months.push(d.getTime())
  const step = Math.ceil(months.length / max)
  return months.filter((_, i) => i % step === 0)
}

/** How a tick of {@link dateTicks} is written for that span. */
export function dateTickFormat(fromMs: number, toMs: number): Intl.DateTimeFormatOptions {
  const span = toMs - fromMs
  return span < 92 * DAY ? { day: 'numeric', month: 'short' } : span <= 2 * 365 * DAY ? { month: 'short' } : { month: 'short', year: '2-digit' }
}
