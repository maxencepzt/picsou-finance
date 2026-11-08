import { flushSync } from 'react-dom'
import { AMOUNT_MASK, AXIS_MASK } from '@/lib/money'

/**
 * The combination-dial animation of privacy mode: on every figure that changes when amounts are
 * hidden or shown, the old characters roll up out of view and the new ones roll in from below,
 * one after another.
 *
 * It works on the DOM after React has rendered, not inside the components, so it reaches every
 * amount on screen — `CurrencyDisplay`, an amount inside a translated sentence, a chart axis —
 * without any of them knowing. React keeps owning the text: the overlays are separate elements,
 * and the real text is only made transparent for the length of the roll, through a CSS highlight.
 */

const HIGHLIGHT = 'privacy-dial'
const ROLL_MS = 420
const STAGGER_MS = 28
const OUT_MS = 220
const OUT_SPREAD_MS = 90
const SLIDE_DELAY_MS = 90
const IN_DELAY_MS = 140
const IN_SPREAD_MS = 160
const TOTAL_MS = IN_DELAY_MS + IN_SPREAD_MS + ROLL_MS
/** Beyond this many figures on screen the roll would drop frames; they then swap at once. */
const MAX_ROLLS = 250
const CANDIDATE = /[\d–*]/

/**
 * The part of a text that differs between two renders, as offsets into each.
 * `"184 532,18 €"` → `"– – – – – €"` keeps the shared ` €` and rolls the rest.
 */
export function changedSpan(was: string, now: string) {
  let start = 0
  while (start < was.length && start < now.length && was[start] === now[start]) start++
  let end = 0
  while (end < was.length - start && end < now.length - start
    && was[was.length - 1 - end] === now[now.length - 1 - end]) end++
  return { start, wasEnd: was.length - end, nowEnd: now.length - end }
}

let finish: (() => void) | null = null

function canRoll(): boolean {
  return typeof window !== 'undefined'
    && typeof Highlight !== 'undefined'
    && !!globalThis.CSS?.highlights
    && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function textNodes(): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (CANDIDATE.test(n.nodeValue ?? '') && !n.parentElement?.closest('[data-privacy-dial], script, style')) {
      nodes.push(n as Text)
    }
  }
  return nodes
}

function onScreen(rect: DOMRect): boolean {
  return rect.width + rect.height > 0 && rect.bottom > 0 && rect.right > 0
    && rect.top < window.innerHeight && rect.left < window.innerWidth
}

/** Where each part of a node's text stands: before, the changed run, after. Null when it wraps. */
function measure(node: Text, cut: number, cutEnd: number) {
  const range = document.createRange()
  const rect = (from: number, to: number) => {
    range.setStart(node, from)
    range.setEnd(node, to)
    return range.getBoundingClientRect()
  }
  range.selectNodeContents(node)
  if (range.getClientRects().length > 1) return null
  return { whole: range.getBoundingClientRect(), mid: rect(cut, cutEnd), after: rect(cutEnd, node.length) }
}

type Layout = NonNullable<ReturnType<typeof measure>>

function glyphs(text: string, keyframes: (i: number) => [Keyframe[], KeyframeAnimationOptions]) {
  const row = document.createElement('span')
  row.style.cssText = 'display:inline-flex;white-space:pre'
  ;[...text].forEach((c, i) => {
    const ch = document.createElement('span')
    ch.textContent = c
    ch.style.display = 'inline-block'
    ch.animate(...keyframes(i))
    row.append(ch)
  })
  return row
}

const slide = (dx: number): [Keyframe[], KeyframeAnimationOptions] =>
  [[{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: ROLL_MS, delay: SLIDE_DELAY_MS, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }]

/**
 * The figure redrawn on top of the page: the new text in place, its unchanged words sliding from
 * where they stood, the changed run rolling in; the old run rolls out above it.
 */
function overlay(source: Element, was: Layout, now: Layout, text: { was: string; now: string; start: number; wasEnd: number; nowEnd: number }) {
  const style = getComputedStyle(source)
  const svg = source instanceof SVGElement
  const box = document.createElement('span')
  box.dataset.privacyDial = ''
  box.setAttribute('aria-hidden', 'true')
  const height = Math.max(was.whole.height, now.whole.height)
  Object.assign(box.style, {
    position: 'fixed', left: `${now.whole.left}px`, top: `${now.whole.top}px`, height: `${height}px`,
    lineHeight: `${height}px`, whiteSpace: 'pre', pointerEvents: 'none', userSelect: 'none', zIndex: '2147483647',
    // Clip vertically only: the digits disappear into the slot, not off its sides.
    clipPath: 'inset(0 -100vw)',
    color: svg ? style.fill : style.color,
    fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
    fontStyle: style.fontStyle, letterSpacing: style.letterSpacing,
    fontVariantNumeric: style.fontVariantNumeric, fontFeatureSettings: style.fontFeatureSettings,
  })

  // The old run leaves right to left, fast, so whatever follows it (the "€") can close the gap
  // behind it; the new run then rolls in left to right. Staggers are capped so a long figure
  // takes no longer than a short one.
  const outLength = text.wasEnd - text.start
  const outStagger = Math.min(STAGGER_MS / 2, OUT_SPREAD_MS / Math.max(outLength, 1))
  const inStagger = Math.min(STAGGER_MS, IN_SPREAD_MS / Math.max(text.nowEnd - text.start, 1))
  const leave = (i: number): [Keyframe[], KeyframeAnimationOptions] => [
    [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-105%)', opacity: 0 }],
    { duration: OUT_MS, delay: (outLength - 1 - i) * outStagger, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'both' },
  ]
  const enter = (i: number): [Keyframe[], KeyframeAnimationOptions] => [
    [{ transform: 'translateY(105%)', opacity: 0 }, { transform: 'none', opacity: 1 }],
    // The incoming digit overshoots a hair and settles, like a dial clicking into place.
    { duration: ROLL_MS, delay: IN_DELAY_MS + i * inStagger, easing: 'cubic-bezier(.3,1.35,.5,1)', fill: 'both' },
  ]

  const line = document.createElement('span')
  line.style.cssText = 'position:absolute;left:0;top:0;display:flex;white-space:pre'
  line.append(
    glyphs(text.now.slice(0, text.start), () => slide(was.whole.left - now.whole.left)),
    glyphs(text.now.slice(text.start, text.nowEnd), enter),
    glyphs(text.now.slice(text.nowEnd), () => slide(was.after.left - now.after.left)),
  )
  const out = glyphs(text.was.slice(text.start, text.wasEnd), leave)
  out.style.cssText += `;position:absolute;top:0;left:${was.mid.left - now.whole.left}px`
  box.append(line, out)
  return box
}

/**
 * Runs `flip` — the state change that hides or shows amounts — and rolls every figure it changed.
 * Without the CSS Highlight API, or with reduced motion, it only runs `flip`.
 */
export function withPrivacyDial(flip: () => void): void {
  finish?.()
  if (!canRoll()) {
    flip()
    return
  }

  const before = new Map(textNodes().map((n) => [n, n.nodeValue ?? '']))
  flushSync(flip)

  const ranges: Range[] = []
  const boxes: HTMLElement[] = []
  const dimmed: SVGElement[] = []

  for (const [node, was] of before) {
    if (boxes.length >= MAX_ROLLS) break
    const now = node.nodeValue ?? ''
    const parent = node.parentElement
    if (!node.isConnected || now === was || !parent) continue
    // A figure nobody can see must not be drawn on top of the page: a screen-reader table, or the
    // part of a truncated cell past its ellipsis.
    if (parent.closest('.sr-only, .truncate')) continue
    const span = changedSpan(was, now)

    // Measure where the old figure stood by putting it back for an instant; nothing paints
    // in between, and React never sees it.
    node.nodeValue = was
    const wasLayout = measure(node, span.start, span.wasEnd)
    node.nodeValue = now
    const nowLayout = measure(node, span.start, span.nowEnd)
    if (!wasLayout || !nowLayout || !onScreen(nowLayout.whole)) continue

    boxes.push(overlay(parent, wasLayout, nowLayout, { was, now, ...span }))
    if (parent instanceof SVGElement) {
      // Highlights do not reach SVG text; an axis tick is the figure alone, so the whole label goes.
      parent.style.opacity = '0'
      dimmed.push(parent)
    } else {
      const range = document.createRange()
      range.selectNodeContents(node)
      ranges.push(range)
    }
  }
  if (boxes.length === 0) return

  CSS.highlights.set(HIGHLIGHT, new Highlight(...ranges))
  document.body.append(...boxes)

  const timer = window.setTimeout(() => finish?.(), TOTAL_MS + 40)
  // The overlays are pinned to the viewport; a scroll mid-roll would leave them behind.
  const end = () => finish?.()
  window.addEventListener('scroll', end, { capture: true, passive: true, once: true })
  window.addEventListener('resize', end, { once: true })
  finish = () => {
    finish = null
    window.clearTimeout(timer)
    window.removeEventListener('scroll', end, { capture: true })
    window.removeEventListener('resize', end)
    CSS.highlights.delete(HIGHLIGHT)
    boxes.forEach((b) => b.remove())
    dimmed.forEach((el) => { el.style.opacity = '' })
  }
}

const TINT = 'privacy-mask'

/**
 * Greys every mask on screen while amounts are hidden, so the dashes read as an empty slot rather
 * than as a figure. A highlight, like the roll, so it reaches every mask without touching React's
 * text; an observer keeps it on masks that render later (navigation, a refetch).
 * Returns the cleanup; a no-op where highlights are not supported.
 */
export function tintMasks(): () => void {
  if (typeof Highlight === 'undefined' || !globalThis.CSS?.highlights) return () => {}
  let frame = 0
  const paint = () => {
    frame = 0
    const ranges: Range[] = []
    for (const node of textNodes()) {
      const text = node.nodeValue ?? ''
      for (const mask of [AMOUNT_MASK, AXIS_MASK]) {
        for (let at = text.indexOf(mask); at !== -1; at = text.indexOf(mask, at + mask.length)) {
          const range = document.createRange()
          range.setStart(node, at)
          range.setEnd(node, at + mask.length)
          ranges.push(range)
        }
        // AXIS_MASK is a prefix of AMOUNT_MASK: once a node holds the long one, stop there.
        if (text.includes(AMOUNT_MASK)) break
      }
    }
    CSS.highlights.set(TINT, new Highlight(...ranges))
  }
  const observer = new MutationObserver(() => { frame ||= requestAnimationFrame(paint) })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true })
  paint()
  return () => {
    observer.disconnect()
    cancelAnimationFrame(frame)
    CSS.highlights.delete(TINT)
  }
}
