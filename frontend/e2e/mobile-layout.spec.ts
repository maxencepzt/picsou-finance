import { test, expect, type Page } from '@playwright/test'
import { login, setupLocale } from './helpers'

// Issue #273: at phone widths, nothing may stick out of the screen or of the card that clips
// it. French labels are the longest the app ships, so the check runs in French.

/**
 * Visible elements of <main> whose right edge passes the edge of whatever clips them: the
 * viewport, or an ancestor with overflow other than visible. A strip that scrolls only
 * sideways is allowed to hold wider content, since the user can swipe to it.
 */
async function clippedElements(page: Page): Promise<string[]> {
  return page.locator('main').evaluate((main) => {
    const found: string[] = []
    for (const el of main.querySelectorAll<HTMLElement>('*')) {
      if (el.closest('svg, [aria-hidden="true"], .sr-only, .recharts-wrapper')) continue
      const style = getComputedStyle(el)
      const box = el.getBoundingClientRect()
      if (style.visibility === 'hidden' || box.width === 0 || box.height === 0) continue
      let limit = window.innerWidth
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const overflowX = getComputedStyle(a).overflowX
        const sidewaysScroller =
          (overflowX === 'auto' || overflowX === 'scroll') &&
          a.scrollWidth > a.clientWidth + 1 &&
          a.scrollHeight <= a.clientHeight + 1
        if (sidewaysScroller) { limit = Infinity; break }
        if (overflowX !== 'visible') limit = Math.min(limit, a.getBoundingClientRect().right)
      }
      if (box.right > limit + 1 && box.left < limit) {
        const label = (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40)
        found.push(`${label} (right ${Math.round(box.right)} > ${Math.round(limit)})`)
      }
    }
    return found
  })
}

async function open(page: Page, path: string) {
  await setupLocale(page)
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

// Each page with the label that used to be cut, waited for since demo data arrives late.
const PAGES = [
  ['/settings', 'Système'],
  ['/settings?section=profile', 'Revenu brut annuel'],
  ['/settings?section=security', 'Appareils connectés'],
  ['/settings?section=mcp', 'Connecter votre client MCP'],
  ['/settings/family', 'Sélectionner'],
  ['/analysis', '30 ans'],
  ['/accounts/2', 'Ajouter'],
  ['/goals', 'Apport immobilier'],
  ['/goals/1/calendar', 'Voyage au Japon'],
  // The redesigned pages: KPI figures and breakdown legends must shrink or wrap, never run off.
  ['/', 'Plus fortes variations'],
  ['/accounts', "Classe d'actifs"],
  ['/budget', 'Principaux commerçants'],
  ['/investments', 'Performance'],
  ['/income', 'Mois par mois'],
  ['/real-estate', 'Résidence principale'],
] as const

test.describe('Phone layout (360px)', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  for (const [path, label] of PAGES) {
    test(`nothing is clipped on ${path}`, async ({ page }) => {
      await open(page, path)
      await expect(page.getByRole('main').getByText(label).first()).toBeVisible()
      expect(await clippedElements(page)).toEqual([])
    })
  }

  test('goal names are shown in full, not cut with an ellipsis', async ({ page }) => {
    const isCut = (el: HTMLElement) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1
    await open(page, '/goals')
    for (const name of ['Voyage au Japon', 'Apport immobilier']) {
      const title = page.getByRole('main').getByText(name, { exact: true })
      await expect(title).toBeVisible()
      expect(await title.evaluate(isCut)).toBe(false)
    }
    await open(page, '/goals/1/calendar')
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText(/Voyage au Japon/)
    expect(await heading.evaluate(isCut)).toBe(false)
  })

  test('every language of the settings switch is on screen', async ({ page }) => {
    await open(page, '/settings')
    for (const code of ['FR', 'EN', 'DE', 'ES']) {
      await expect(page.getByRole('main').getByRole('button', { name: code, exact: true })).toBeInViewport({ ratio: 1 })
    }
  })

  test('the settings section picker opens the section it names, by URL', async ({ page }) => {
    await open(page, '/settings?section=security')
    const picker = page.getByRole('main').getByRole('combobox').first()
    await expect(picker).toHaveValue('security')
    await picker.selectOption('profile')
    await expect(page).toHaveURL(/section=profile/)
    await expect(page.getByRole('main').getByText('Revenu brut annuel')).toBeVisible()
  })

  test('sync categories sit on one swipeable row, providers in one column', async ({ page }) => {
    await open(page, '/sync')
    const categories = page.getByRole('group', { name: 'Catégorie' }).getByRole('button')
    await expect(categories.first()).toBeAttached()
    const tops = await categories.evaluateAll((all) =>
      new Set(all.map((c) => Math.round(c.getBoundingClientRect().top))).size,
    )
    expect(tops).toBe(1)
    const lefts = await page.getByRole('region', { name: 'Ajouter une connexion' }).getByRole('listitem')
      .evaluateAll((tiles) => new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().left))).size)
    expect(lefts).toBe(1)
  })

  test('nothing is clipped on the sync overview nor in a provider view', async ({ page }) => {
    await open(page, '/sync')
    await expect(page.getByRole('main').getByText('Vos connexions')).toBeVisible()
    await expect(page.getByRole('main').getByText('BoursoBank').first()).toBeVisible()
    expect(await clippedElements(page)).toEqual([])
    await open(page, '/sync?tab=cmes')
    await expect(page.getByLabel('Identifiant')).toBeVisible()
    expect(await clippedElements(page)).toEqual([])
  })

  test('account filters sit on one swipeable row', async ({ page }) => {
    await open(page, '/accounts')
    const filter = page.getByRole('main').getByRole('button', { name: 'Actions & Fonds' })
    await expect(filter).toBeVisible()
    const tops = await filter.locator('xpath=..').locator('button')
      .evaluateAll((buttons) => new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top))).size)
    expect(tops).toBe(1)
  })

  test('the active budget section is scrolled into view', async ({ page }) => {
    await open(page, '/budget/review')
    await expect(page.getByRole('link', { name: /À catégoriser/ })).toBeInViewport({ ratio: 1 })
  })

  test('a deep link to the CMES sync view shows its header and panel', async ({ page }) => {
    await open(page, '/sync?tab=cmes')
    const name = 'Crédit Mutuel / CIC Épargne Salariale'
    await expect(page.getByRole('heading', { level: 1, name })).toBeInViewport()
    await expect(page.getByRole('region', { name })).not.toBeEmpty()
    // The way back to the overview, full width on a phone.
    await expect(page.getByRole('button', { name: 'Synchronisation' })).toBeInViewport({ ratio: 1 })
  })

  test('a deep link to the visible-accounts view shows it', async ({ page }) => {
    await open(page, '/sync?tab=visibility')
    await expect(page.getByRole('heading', { level: 1, name: 'Comptes visibles' })).toBeInViewport({ ratio: 1 })
    await expect(page.getByRole('region', { name: 'Comptes visibles' })).not.toBeEmpty()
  })

  test('selecting a half-hidden sync category brings it fully into view', async ({ page }) => {
    await open(page, '/sync')
    // The connections card above loads late and grows: wait for it, or the strip moves under the click.
    await expect(page.getByRole('button', { name: /^BINANCE/ })).toBeVisible()
    const group = page.getByRole('group', { name: 'Catégorie' })
    await expect(group.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true')
    const tabs = group.getByRole('button')
    const strip = group.locator('xpath=..')
    await strip.scrollIntoViewIfNeeded()
    // Swipe so the first tab whose middle is past the right edge shows only its first half there.
    // A tab that overflows by less than half would need a negative swipe, so it can't be picked.
    const stripBox = (await strip.boundingBox())!
    const stripRight = stripBox.x + stripBox.width
    const i = await tabs.evaluateAll((all, right) => all.findIndex((tab) => {
      const box = tab.getBoundingClientRect()
      return box.left + box.width / 2 > right
    }), stripRight)
    const hidden = (await tabs.nth(i).boundingBox())!
    const shift = Math.round(hidden.x + hidden.width / 2 - stripRight)
    await strip.hover()
    await page.mouse.wheel(shift, 0)
    await expect.poll(() => strip.evaluate((s) => s.scrollLeft)).toBe(shift)
    const box = (await tabs.nth(i).boundingBox())!
    // A real pointer press on the visible half: Playwright's click() would scroll the tab into view itself.
    await page.mouse.click(box.x + 8, box.y + box.height / 2)
    const tab = tabs.nth(i)
    await expect(tab).toHaveAttribute('aria-pressed', 'true')
    await expect(tab).toBeInViewport({ ratio: 1 })
  })

  test('content loading late does not undo a swipe on the budget sections', async ({ page }) => {
    await open(page, '/budget/review')
    await expect(page.getByRole('link', { name: /À catégoriser/ })).toBeInViewport({ ratio: 1 })
    const nav = page.getByRole('main').locator('nav')
    const strip = nav.locator('xpath=..')
    await strip.hover()
    await page.mouse.wheel(-2000, 0)
    await expect.poll(() => strip.evaluate((s) => s.scrollLeft)).toBe(0)
    // Stands in for a late response widening a section, like the review-count badge arriving.
    await nav.evaluate((n) => { n.querySelector('a')!.append(' (12)') })
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
    expect(await strip.evaluate((s) => s.scrollLeft)).toBe(0)
  })

  // The global focus ring is drawn 4px outside the control (index.css), so a strip's overflow
  // must leave room for it above and below, or keyboard users lose sight of where they are.
  const STRIP_ITEMS = [
    ['/accounts', 'button', 'Actions & Fonds'],
    ['/budget/review', 'link', /À catégoriser/],
    ['/sync', 'button', /^Bourse$/],
  ] as const
  for (const [path, role, name] of STRIP_ITEMS) {
    test(`the focus ring of a ${role} in the ${path} strip is not cut`, async ({ page }) => {
      await open(page, path)
      const item = page.getByRole('main').getByRole(role, { name })
      await item.focus()
      const cut = await item.evaluate((el) => {
        if (!el.matches(':focus-visible')) return ['not focus-visible']
        const style = getComputedStyle(el)
        const reach = parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth)
        const box = el.getBoundingClientRect()
        const sides: string[] = []
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const s = getComputedStyle(a)
          if (s.overflowX === 'visible' && s.overflowY === 'visible') continue
          const clip = a.getBoundingClientRect()
          const top = clip.top + a.clientTop
          if (box.top - reach < top - 0.5) sides.push(`top cut by ${a.tagName}`)
          if (box.bottom + reach > top + a.clientHeight + 0.5) sides.push(`bottom cut by ${a.tagName}`)
        }
        return sides
      })
      expect(cut).toEqual([])
    })
  }
})

const NAV_INSET = 16

function contentBox(page: Page) {
  return page.locator('#main-content .overflow-auto').first().evaluate((el) => {
    const style = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    return {
      left: box.left + parseFloat(style.paddingLeft),
      right: box.right - parseFloat(style.paddingRight),
      top: box.top + parseFloat(style.paddingTop),
      bottom: box.bottom - parseFloat(style.paddingBottom),
    }
  })
}

test.describe('Mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  for (const route of ['/accounts', '/goals', '/settings']) {
    test(`the end of ${route} stays clear of the bottom nav`, async ({ page }) => {
      await page.goto(route)

      const nav = (await page.locator('nav.fixed').boundingBox())!
      const content = await contentBox(page)
      expect(content.bottom).toBeLessThanOrEqual(nav.y - NAV_INSET)
    })
  }

  test('the end of a page also clears a home-indicator safe area', async ({ page }) => {
    // Playwright's viewport has no safe area, so env(safe-area-inset-bottom) is 0 above;
    // a CDP override gives it the height of an iPhone home indicator.
    const safeArea = 34
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { bottom: safeArea } })
    await page.goto('/accounts')

    const nav = (await page.locator('nav.fixed').boundingBox())!
    const content = await contentBox(page)
    expect(content.bottom).toBeLessThanOrEqual(nav.y - NAV_INSET)

    // The visible bar sits above the nav's safe-area spacer: it must clear the inset by its
    // own bottom-4, which also fails this test if the override had no effect.
    const bar = (await page.locator('nav.fixed > div').first().boundingBox())!
    expect(bar.y + bar.height).toBeLessThanOrEqual(page.viewportSize()!.height - safeArea - NAV_INSET)
  })

  test('page content lines up with the bottom nav gutter', async ({ page }) => {
    await page.goto('/accounts')

    const nav = (await page.locator('nav.fixed').boundingBox())!
    const content = await contentBox(page)
    expect(content.left).toBe(nav.x)
    expect(content.right).toBe(nav.x + nav.width)
    expect(content.top).toBeGreaterThanOrEqual(NAV_INSET)
  })

  test('Famille is reachable from the bottom nav through "Plus"', async ({ page }) => {
    const more = page.locator('nav.fixed').getByRole('button', { name: 'Plus' })
    await more.click()
    await page.getByRole('dialog').getByRole('link', { name: 'Famille' }).click()
    await page.waitForURL('**/family')
    await expect(more).toHaveAttribute('aria-current', 'page')
  })
})
