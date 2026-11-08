import { describe, expect, it, vi } from 'vitest'
import { AMOUNT_MASK } from './money'
import { changedSpan, withPrivacyDial } from './privacy-dial'

describe('changedSpan', () => {
  it('rolls the digits and keeps the currency that both renders share', () => {
    const was = '184\u00a0532,18\u00a0€'
    const now = `${AMOUNT_MASK}\u00a0€`
    const span = changedSpan(was, now)
    expect(was.slice(span.start, span.wasEnd)).toBe('184\u00a0532,18')
    expect(now.slice(span.start, span.nowEnd)).toBe(AMOUNT_MASK)
  })

  it('keeps the words around an amount interpolated into a sentence', () => {
    const was = 'Soit 1\u00a0200\u00a0€ par mois'
    const now = `Soit ${AMOUNT_MASK}\u00a0€ par mois`
    const span = changedSpan(was, now)
    expect(was.slice(span.start, span.wasEnd)).toBe('1\u00a0200')
    expect(now.slice(span.start, span.nowEnd)).toBe(AMOUNT_MASK)
  })

  it('never lets the shared prefix and suffix overlap', () => {
    // "aa" → "aaa": a naive suffix scan would count the shared "a" twice.
    const span = changedSpan('aa', 'aaa')
    expect(span.start).toBeLessThanOrEqual(span.wasEnd)
    expect(span.start).toBeLessThanOrEqual(span.nowEnd)
    expect('aaa'.slice(span.start, span.nowEnd)).toBe('a')
  })
})

describe('withPrivacyDial', () => {
  it('still flips the state where the dial cannot run', () => {
    // jsdom has no CSS Highlight API: the toggle must keep working without the animation.
    const flip = vi.fn()
    withPrivacyDial(flip)
    expect(flip).toHaveBeenCalledOnce()
  })
})
