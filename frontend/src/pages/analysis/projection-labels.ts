export interface EndLabel {
  key: string
  /** Pixel y of the line's last point. */
  y: number
}

/**
 * Spreads the end labels of a chart's lines so none overlaps the next.
 *
 * Labels keep their order (the highest line keeps the highest label), are pushed apart by at
 * least `gap`, and stay between `top` and `bottom`. When they do not all fit, the top one may
 * cross `top`: four 11px labels need 42px of a 300px chart, so that does not happen here.
 */
export function spreadLabels<T extends EndLabel>(labels: T[], gap: number, top: number, bottom: number): (T & { labelY: number })[] {
  const placed = [...labels]
    .sort((a, b) => a.y - b.y)
    .map((label) => ({ ...label, labelY: Math.min(Math.max(label.y, top), bottom) }))
  for (let i = 1; i < placed.length; i++) {
    placed[i]!.labelY = Math.max(placed[i]!.labelY, placed[i - 1]!.labelY + gap)
  }
  const last = placed.at(-1)
  if (last && last.labelY > bottom) {
    last.labelY = bottom
    for (let i = placed.length - 2; i >= 0; i--) {
      placed[i]!.labelY = Math.min(placed[i]!.labelY, placed[i + 1]!.labelY - gap)
    }
  }
  return placed
}

/**
 * Right margin the labels need: the longest one at an 11px semibold Geist width, plus the gap
 * from the line's end.
 *
 * shortcut: estimates 6.6px per character instead of measuring the text; upgrade to a canvas
 * `measureText` if a locale's labels ever get clipped.
 */
export function labelGutter(texts: string[]): number {
  return Math.ceil(Math.max(0, ...texts.map((text) => text.length)) * 6.6) + 12
}
