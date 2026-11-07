import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should navigate to Comptes', async ({ page }) => {
    await page.getByRole('link', { name: 'Comptes' }).click()
    await page.waitForURL('**/accounts')
    await expect(page.getByRole('heading', { level: 1, name: 'Comptes' })).toBeVisible()
  })

  test('should navigate to Objectifs', async ({ page }) => {
    await page.getByRole('link', { name: 'Objectifs' }).click()
    await page.waitForURL('**/goals')
    await expect(page.getByRole('heading', { level: 1, name: 'Objectifs' })).toBeVisible()
  })

  // Sync is not a sidebar nav item (it lives in the profile menu, covered by
  // AppSidebar.test.tsx) — check the direct route instead.
  test('should reach Synchronisation via its route', async ({ page }) => {
    await page.goto('/sync')
    await page.waitForURL('**/sync')
    await expect(page.getByRole('heading', { name: 'Synchronisation' })).toBeVisible()
  })

  test('should navigate back to Synthèse', async ({ page }) => {
    // Go to accounts first
    await page.getByRole('link', { name: 'Comptes' }).click()
    await page.waitForURL('**/accounts')

    // Go back to the overview
    await page.getByRole('link', { name: 'Synthèse' }).click()
    await page.waitForURL('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Synthèse' })).toBeVisible()
  })

  for (const [label, path] of [
    ['Investissements', '/investments'],
    ['Revenus passifs', '/income'],
    ['Immobilier & prêts', '/real-estate'],
  ] as const) {
    test(`should navigate to ${label}`, async ({ page }) => {
      await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: label }).click()
      await page.waitForURL(`**${path}`)
      await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible()
    })
  }

  test('opens the search palette with the platform shortcut and jumps to a page', async ({ page }) => {
    // The layout mounts the shortcut listener; wait for it before pressing.
    await expect(page.getByRole('button', { name: 'Rechercher un compte, un titre, une page…' })).toBeVisible()
    // "Desktop Chrome" reports Windows on every host, so the app expects Ctrl, even on a Mac runner.
    await page.keyboard.press('Control+k')
    const search = page.getByRole('combobox', { name: 'Recherche' })
    await expect(search).toBeFocused()
    await search.fill('budget')
    await page.keyboard.press('Enter')
    await page.waitForURL('**/budget')
  })
})

for (const sidebarStyle of ['classic', 'current']) {
  for (const locale of ['fr', 'en', 'de', 'es']) {
    test(`${sidebarStyle} sidebar shows every nav label in full (${locale})`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.addInitScript(({ sidebarStyle, locale }) => {
        localStorage.setItem('picsou-locale', locale)
        localStorage.setItem('picsou-app', JSON.stringify({
          state: { sidebarStyle, hasSeenSidebarStylePrompt: true },
          version: 0,
        }))
      }, { sidebarStyle, locale })
      await page.goto('/')

      const labels = page.locator('nav:not(.fixed) a span.truncate')
      await expect(labels.first()).toBeVisible()
      const clipped = await labels.evaluateAll((els) => els
        .filter((el) => el.scrollWidth > el.clientWidth)
        .map((el) => el.textContent))
      expect(clipped).toEqual([])
    })
  }
}
