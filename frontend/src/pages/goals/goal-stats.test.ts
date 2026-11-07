import { describe, expect, it } from 'vitest'
import type { GoalProgress } from '@/types/api'
import { formatMonthYear, goalStatus, projectReach, summarizeSavings, trajectoryRows } from './goal-stats'

function goal(partial: Partial<GoalProgress> = {}): GoalProgress {
  return {
    id: 1,
    name: 'Goal',
    type: 'SAVINGS_TARGET',
    createdAt: '2026-03-01T09:00:00Z',
    historyStartMonth: null,
    accounts: [],
    currentTotal: 1000,
    targetAmount: 4000,
    deadline: '2027-06-30',
    percentComplete: 25,
    monthlyNeeded: 400,
    avgMonthlyContribution: 300,
    surplus: -100,
    monthsLeft: 7,
    isOnTrack: true,
    monthlyAmount: null,
    expectedReturn: null,
    startDate: null,
    endDate: null,
    allocations: [],
    ...partial,
  }
}

describe('goalStatus', () => {
  it('follows the card badge: achieved, waiting, on track, behind', () => {
    expect(goalStatus(goal({ monthlyNeeded: 0 }))).toBe('achieved')
    expect(goalStatus(goal({ avgMonthlyContribution: null }))).toBe('waiting')
    expect(goalStatus(goal())).toBe('onTrack')
    expect(goalStatus(goal({ isOnTrack: false }))).toBe('behind')
  })
})

describe('summarizeSavings', () => {
  it('adds the goals up and compares required with averaged over the goals still to reach', () => {
    const summary = summarizeSavings([
      goal({ currentTotal: 1000, targetAmount: 4000, monthlyNeeded: 400, avgMonthlyContribution: 300 }),
      goal({ currentTotal: 2500, targetAmount: 2000, monthlyNeeded: -50, avgMonthlyContribution: 120 }),
      goal({ currentTotal: 500, targetAmount: 6000, monthlyNeeded: 250, avgMonthlyContribution: 100, isOnTrack: false }),
      goal({ currentTotal: 0, targetAmount: 1000, monthlyNeeded: 100, avgMonthlyContribution: null }),
    ])
    expect(summary).toEqual({
      saved: 4000,
      target: 13000,
      // The achieved one and the on-track one; "waiting" is not counted either way.
      onTrack: 2,
      behind: 1,
      count: 4,
      // 400 + 250 + 100: the achieved goal's negative need is left out.
      required: 750,
      // 300 + 100: the achieved goal's 120 would inflate it, the waiting one has none.
      averaged: 400,
    })
  })

  it('reports no average while no pending goal has history', () => {
    expect(summarizeSavings([goal({ avgMonthlyContribution: null })]).averaged).toBeNull()
    expect(summarizeSavings([]).averaged).toBeNull()
  })
})

describe('projectReach', () => {
  const TODAY = '2026-11-03'

  it('reaches the goal at the end of month today + n − 1', () => {
    // 3000 left at 300 a month: ten months, November included, so August 2027.
    expect(projectReach(goal({ currentTotal: 1000, avgMonthlyContribution: 300, deadline: '2027-08-31' }), TODAY))
      .toEqual({ kind: 'onTime', month: '2027-08' })
  })

  it('rounds a partial last month up, and counts an exact division as whole months', () => {
    // 900 / 300 is three months exactly: November, December, January.
    expect(projectReach(goal({ currentTotal: 3100, avgMonthlyContribution: 300 }), TODAY))
      .toEqual({ kind: 'onTime', month: '2027-01' })
    // 901 / 300 needs a fourth.
    expect(projectReach(goal({ currentTotal: 3099, avgMonthlyContribution: 300 }), TODAY))
      .toEqual({ kind: 'onTime', month: '2027-02' })
  })

  it('is late by the months between the deadline and the reach month', () => {
    // August 2027 against a deadline in May: three months late.
    expect(projectReach(goal({ avgMonthlyContribution: 300, deadline: '2027-05-31' }), TODAY))
      .toEqual({ kind: 'late', month: '2027-08', monthsLate: 3 })
  })

  it('is one month late when reached at the end of the deadline month, after the deadline day', () => {
    expect(projectReach(goal({ avgMonthlyContribution: 300, deadline: '2027-08-01' }), TODAY))
      .toEqual({ kind: 'late', month: '2027-08', monthsLate: 1 })
  })

  it('never gets there without a positive average, or within fifty years', () => {
    expect(projectReach(goal({ avgMonthlyContribution: 0 }), TODAY)).toEqual({ kind: 'never' })
    expect(projectReach(goal({ avgMonthlyContribution: -40 }), TODAY)).toEqual({ kind: 'never' })
    expect(projectReach(goal({ avgMonthlyContribution: 1 }), TODAY)).toEqual({ kind: 'never' })
  })

  it('has nothing to project once reached, without history, or for a recurring plan', () => {
    expect(projectReach(goal({ currentTotal: 4000 }), TODAY)).toBeNull()
    expect(projectReach(goal({ avgMonthlyContribution: null }), TODAY)).toBeNull()
    expect(projectReach(goal({ type: 'RECURRING_INVESTMENT', targetAmount: null, deadline: null }), TODAY)).toBeNull()
  })

  it('crosses the year boundary', () => {
    // 3000 at 1000: November, December, January.
    expect(projectReach(goal({ avgMonthlyContribution: 1000 }), '2026-11-28')).toEqual({ kind: 'onTime', month: '2027-01' })
  })
})

describe('formatMonthYear', () => {
  it('writes the month in words', () => {
    expect(formatMonthYear('2027-03', 'fr-FR')).toBe('mars 2027')
    expect(formatMonthYear('2027-03', 'en-US')).toBe('March 2027')
  })
})

describe('trajectoryRows', () => {
  const history = [
    { date: '2026-01-01', total: 500 },
    { date: '2026-03-01', total: 800 },
    { date: '2026-06-01', total: 1200 },
  ]

  it('starts at the goal creation and draws the line from that balance to the target', () => {
    expect(trajectoryRows(history, goal({ createdAt: '2026-03-01T09:00:00Z' }))).toEqual([
      { t: Date.parse('2026-03-01'), saved: 800, ideal: 800 },
      { t: Date.parse('2026-06-01'), saved: 1200 },
      { t: Date.parse('2027-06-30'), ideal: 4000 },
    ])
  })

  it('uses the whole window when the goal is older than the history', () => {
    const rows = trajectoryRows(history, goal({ createdAt: '2024-01-01T00:00:00Z' }))!
    expect(rows[0]).toEqual({ t: Date.parse('2026-01-01'), saved: 500, ideal: 500 })
    expect(rows).toHaveLength(4)
  })

  it('ends the line at the last point when the deadline has passed', () => {
    const rows = trajectoryRows(history, goal({ createdAt: '2024-01-01T00:00:00Z', deadline: '2026-02-01' }))!
    expect(rows.at(-1)).toEqual({ t: Date.parse('2026-06-01'), ideal: 4000 })
  })

  it('has nothing to draw with fewer than two points', () => {
    expect(trajectoryRows([{ date: '2026-06-01', total: 1200 }], goal())).toBeNull()
    expect(trajectoryRows([], goal())).toBeNull()
  })
})
