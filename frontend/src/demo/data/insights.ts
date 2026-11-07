import type { Benchmark, BenchmarkKey, FeesSummary, MerchantSpending, Movers, Performance, PerformancePoint, RecurringStats } from '@/types/api'
import { daysFromToday, monthStartFromToday } from './dates'

// Figures for the lot-2 endpoints (performance, benchmark, fees, movers, merchants, plan stats).
// Fictional but consistent with the demo holdings (AAPL, MSFT, IWDA, EUNL, BTC…).

/** Calendar days covered by a `months` query; 0 means "all" (two years of demo history). */
function spanDays(months: number): number {
  return Math.round((months > 0 ? months : 24) * 30.44)
}

/** A smooth, deterministic wobble so curves look market-like without randomness. */
function wobble(day: number, seed: number): number {
  return Math.sin(day / 17 + seed) * 0.018 + Math.sin(day / 53 + seed * 2) * 0.03
}

export function mockPerformance(months: number): Performance {
  const days = spanDays(months)
  const points: PerformancePoint[] = []
  let invested = 38000
  // The API's index starts at 100 on the first point: rebase the wobble on day 0.
  const growth0 = 1 + wobble(0, 1)
  for (let d = days; d >= 0; d--) {
    const elapsed = days - d
    if (elapsed > 0 && elapsed % 30 === 0) invested += 500
    const growth = 1 + 0.00026 * elapsed + wobble(elapsed, 1)
    const index = (100 * growth) / growth0
    points.push({
      date: daysFromToday(-d),
      valueEur: Math.round(invested * (1.12 + (growth - 1)) * 100) / 100,
      investedEur: invested,
      index: Math.round(index * 100) / 100,
    })
  }
  const last = points[points.length - 1]
  const twr = last.index - 100
  return {
    from: points[0].date,
    to: last.date,
    valueEur: last.valueEur,
    investedEur: last.investedEur,
    twrPercent: Math.round(twr * 100) / 100,
    annualizedPercent: days >= 365 ? Math.round((Math.pow(last.index / 100, 365 / days) - 1) * 10000) / 100 : null,
    xirrPercent: days >= 30 ? Math.round(twr * 0.93 * (365 / days) * 100) / 100 : null,
    volatilityPercent: points.length > 20 ? 13.4 : null,
    maxDrawdownPercent: -8.7,
    maxDrawdownFrom: daysFromToday(-Math.min(days, 140)),
    maxDrawdownTo: daysFromToday(-Math.min(days, 104)),
    points,
  }
}

const BENCHMARKS: Record<BenchmarkKey, { ticker: string; label: string; start: number; drift: number; seed: number }> = {
  MSCI_WORLD: { ticker: 'IWDA.AS', label: 'MSCI World', start: 92.4, drift: 0.00031, seed: 3 },
  SP500: { ticker: 'SXR8.DE', label: 'S&P 500', start: 498.2, drift: 0.00036, seed: 5 },
  CAC40: { ticker: 'C40.PA', label: 'CAC 40', start: 118.6, drift: 0.00012, seed: 7 },
}

export function mockBenchmark(key: string, months: number): Benchmark {
  const def = BENCHMARKS[key as BenchmarkKey] ?? BENCHMARKS.MSCI_WORLD
  const days = spanDays(months)
  const points = []
  for (let d = days; d >= 0; d--) {
    const elapsed = days - d
    const price = def.start * (1 + def.drift * elapsed + wobble(elapsed, def.seed))
    points.push({ date: daysFromToday(-d), priceEur: Math.round(price * 100) / 100 })
  }
  return { key: (key in BENCHMARKS ? key : 'MSCI_WORLD') as BenchmarkKey, ticker: def.ticker, label: def.label, points }
}

export function mockFees(months: number): FeesSummary {
  const lines = [
    { ticker: 'IWDA', name: 'iShares Core MSCI World', valueEur: 18240, terPercent: 0.2 },
    { ticker: 'EUNL', name: 'iShares Core S&P 500', valueEur: 9620, terPercent: 0.07 },
    { ticker: 'AAPL', name: 'Apple Inc.', valueEur: 6120, terPercent: null },
    { ticker: 'MSFT', name: 'Microsoft Corp.', valueEur: 5480, terPercent: null },
    { ticker: 'BTC', name: 'Bitcoin', valueEur: 7350, terPercent: null },
  ]
  const covered = lines.filter((l) => l.terPercent != null)
  const coveredValueEur = covered.reduce((s, l) => s + l.valueEur, 0)
  const annualCostEur = covered.reduce((s, l) => s + (l.valueEur * l.terPercent!) / 100, 0)
  return {
    from: daysFromToday(-spanDays(months)),
    to: daysFromToday(0),
    weightedTerPercent: Math.round(((annualCostEur / coveredValueEur) * 100) * 1000) / 1000,
    annualCostEur: Math.round(annualCostEur * 100) / 100,
    coveredValueEur,
    totalValueEur: lines.reduce((s, l) => s + l.valueEur, 0),
    lines,
    brokerFeesEur: months === 3 ? 7.96 : 31.84,
    brokerFeesCount: months === 3 ? 4 : 16,
  }
}

export function mockMovers(limit: number): Movers {
  const all = [
    { ticker: 'NVDA', name: 'NVIDIA Corp.', previousPriceEur: 118.4, priceEur: 122.9, quantity: 12 },
    { ticker: 'BTC', name: 'Bitcoin', previousPriceEur: 61250, priceEur: 62480, quantity: 0.12 },
    { ticker: 'AAPL', name: 'Apple Inc.', previousPriceEur: 191.2, priceEur: 192.6, quantity: 32 },
    { ticker: 'IWDA', name: 'iShares Core MSCI World', previousPriceEur: 98.71, priceEur: 98.52, quantity: 185 },
    { ticker: 'MSFT', name: 'Microsoft Corp.', previousPriceEur: 389.4, priceEur: 384.1, quantity: 14 },
    { ticker: 'ETH', name: 'Ethereum', previousPriceEur: 3120, priceEur: 3021, quantity: 1.4 },
  ].map((m) => ({
    ticker: m.ticker,
    name: m.name,
    logoUrl: null,
    priceEur: m.priceEur,
    previousPriceEur: m.previousPriceEur,
    changePercent: Math.round(((m.priceEur / m.previousPriceEur - 1) * 100) * 100) / 100,
    valueEur: Math.round(m.priceEur * m.quantity * 100) / 100,
    valueChangeEur: Math.round((m.priceEur - m.previousPriceEur) * m.quantity * 100) / 100,
  }))
  const n = Math.min(10, Math.max(1, limit))
  return {
    date: daysFromToday(0),
    previousDate: daysFromToday(-1),
    gainers: all.filter((m) => m.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, n),
    losers: all.filter((m) => m.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, n),
  }
}

export function mockMerchantSpending(limit: number): MerchantSpending {
  const rows = [
    ['brand:1', 'Carrefour', 412.3, 7], ['brand:2', 'Amazon', 236.8, 5], ['label:sncf', 'SNCF', 184.0, 2],
    ['brand:3', 'Monoprix', 152.45, 6], ['label:le comptoir', 'Le Comptoir', 96.5, 3], ['brand:4', 'Netflix', 17.99, 1],
    ['label:boulangerie paul', 'Boulangerie Paul', 42.3, 9], ['brand:5', 'Decathlon', 79.9, 1],
  ] as const
  const total = rows.reduce((s, r) => s + r[2], 0)
  const merchants = rows
    .map(([key, label, amount, count]) => ({ key, label, logoUrl: null, amount, count, share: Math.round((amount / total) * 1000) / 10 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, Math.min(25, Math.max(1, limit)))
  return { from: daysFromToday(-9), to: daysFromToday(21), total: Math.round(total * 100) / 100, merchants }
}

/** Only goal 4 is a recurring plan in the demo set. */
export function mockRecurringStats(id: number): RecurringStats | null {
  if (id !== 4) return null
  return {
    from: monthStartFromToday(-11),
    to: daysFromToday(0),
    investedEur: 2750,
    purchases: 22,
    monthsWithPurchase: 11,
    monthsElapsed: 12,
    currentValueEur: 3086.4,
    gainEur: 336.4,
    gainPercent: 12.23,
  }
}
