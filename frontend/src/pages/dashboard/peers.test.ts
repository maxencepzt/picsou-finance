import { describe, expect, it } from 'vitest'
import { MEDIAN_GROSS_WEALTH, ageBracket } from './peers'

describe('ageBracket', () => {
  it('maps each age to its INSEE bracket, bounds included at the bottom', () => {
    expect([18, 29, 30, 39, 40, 49, 50, 59, 60, 69, 70, 92].map(ageBracket)).toEqual([
      'under30', 'under30', '30to39', '30to39', '40to49', '40to49',
      '50to59', '50to59', '60to69', '60to69', '70plus', '70plus',
    ])
  })

  it('falls back to every household without an age', () => {
    expect(ageBracket(null)).toBe('all')
    expect(ageBracket(undefined)).toBe('all')
  })

  it('keeps the figures of Insee Focus n° 371, figure 3a', () => {
    expect(MEDIAN_GROSS_WEALTH).toEqual({
      under30: 26_100, '30to39': 146_200, '40to49': 215_200, '50to59': 254_100, '60to69': 245_000, '70plus': 247_600, all: 205_100,
    })
  })
})
