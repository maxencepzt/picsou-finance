import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Accounts page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: 'Comptes' }).click()
    await page.waitForURL('**/accounts')
  })

  test('should show account cards grid', async ({ page }) => {
    // Account grid should be visible
    await expect(page.locator('.grid').first()).toBeVisible()
  })

  test('should filter accounts by type', async ({ page }) => {
    // Type filters are plain buttons now (no tablist)
    await page.getByRole('button', { name: 'Actions & Fonds' }).click()
    // The total row should still be visible
    await expect(page.getByText('Total').first()).toBeVisible()

    // Reset with "Tout" — .first() because the chart's time-range selector
    // also has a "Tout" button once it loads; the type filter row comes first in the DOM.
    await page.getByRole('button', { name: 'Tout', exact: true }).first().click()
    await expect(page.locator('.grid').first()).toBeVisible()
  })

  test('opens an account in the side panel from its row', async ({ page }) => {
    await page.getByRole('main').getByRole('button', { name: /PEA BoursoBank/ }).first().click()
    const panel = page.getByRole('dialog')
    await expect(panel.getByRole('heading', { name: 'PEA BoursoBank' })).toBeVisible()
    // Still on the list: the panel is not the detail page, it links to it.
    expect(page.url()).toMatch(/\/accounts$/)
    await panel.locator('a[href^="/accounts/"]').click()
    await page.waitForURL(/\/accounts\/\d+$/)
  })

  test('opens the edit form from ?edit=<id> and clears it on close', async ({ page }) => {
    await page.goto('/accounts?edit=2')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(page).toHaveURL(/\/accounts$/)
  })

  test('ignores ?edit= with an unknown id', async ({ page }) => {
    await page.goto('/accounts?edit=999999')
    await expect(page.getByRole('main').getByRole('button', { name: /PEA BoursoBank/ }).first()).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('should open add account dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Ajouter un compte' }).click()
    // Dialog should appear with the source choices
    await expect(page.getByRole('dialog')).toBeVisible()
    // Close via the dialog's close (X) button
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })
})
