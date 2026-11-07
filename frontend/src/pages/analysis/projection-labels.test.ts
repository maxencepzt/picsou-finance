import { describe, expect, it } from 'vitest'
import { labelGutter, spreadLabels } from './projection-labels'

const ys = (placed: { key: string; labelY: number }[]) => Object.fromEntries(placed.map((p) => [p.key, p.labelY]))

describe('spreadLabels', () => {
  it('leaves labels that already clear each other where they are', () => {
    expect(ys(spreadLabels([{ key: 'a', y: 40 }, { key: 'b', y: 100 }], 14, 0, 300))).toEqual({ a: 40, b: 100 })
  })

  it('pushes a crowded label down by the gap, keeping the order of the lines', () => {
    // b is 4px under a, c 2px under b: each moves to sit 14px under the one above.
    const placed = spreadLabels([{ key: 'c', y: 46 }, { key: 'a', y: 40 }, { key: 'b', y: 44 }], 14, 0, 300)
    expect(placed.map((p) => p.key)).toEqual(['a', 'b', 'c'])
    expect(ys(placed)).toEqual({ a: 40, b: 54, c: 68 })
  })

  it('walks back up when the stack would pass the bottom', () => {
    // Three labels at the floor: the last sits on it, the others 14 and 28px above.
    expect(ys(spreadLabels([{ key: 'a', y: 295 }, { key: 'b', y: 298 }, { key: 'c', y: 300 }], 14, 0, 290)))
      .toEqual({ a: 262, b: 276, c: 290 })
  })

  it('clamps a label above the top into the plot', () => {
    expect(ys(spreadLabels([{ key: 'a', y: -5 }], 14, 6, 290))).toEqual({ a: 6 })
  })

  it('returns nothing for no lines', () => {
    expect(spreadLabels([], 14, 0, 300)).toEqual([])
  })
})

describe('labelGutter', () => {
  it('fits the longest label plus the gap', () => {
    // "1,23 M €" is 8 characters: ceil(8 × 6.6) + 12 = 65.
    expect(labelGutter(['812 k€', '1,23 M €'])).toBe(65)
    expect(labelGutter([])).toBe(12)
  })
})
