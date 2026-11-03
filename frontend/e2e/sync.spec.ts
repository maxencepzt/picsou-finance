import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'
import { Buffer } from 'node:buffer'

/** The "Add a connection" catalog of the overview, where every provider has a tile. */
function catalog(page: Page) {
  return page.getByRole('region', { name: 'Ajouter une connexion' })
}

/** Opens a provider's view from its catalog tile (its accessible name starts with the provider's). */
async function openProvider(page: Page, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await catalog(page).getByRole('button', { name: new RegExp(`^${escaped}`) }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test.describe('Sync page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    // Sync is no longer a sidebar entry — navigate to the route directly.
    await page.goto('/sync')
    await page.waitForURL('**/sync')
  })

  test('should list every supported provider in the catalog', async ({ page }) => {
    const providerNames = [
      'Banques européennes',
      'BoursoBank',
      "Caisse d'Epargne",
      'CIC (livrets)',
      'Fortuneo',
      'Revolut',
      'American Express',
      'SimpleFIN',
      'Trade Republic',
      'Bourse Direct',
      'DEGIRO',
      'Interactive Brokers',
      'Plateformes crypto',
      'Portefeuilles crypto',
      'Amundi',
      'Crédit Mutuel / CIC Épargne Salariale',
      'CORUM',
      'Sofidy',
      'Finary',
      'Actual Budget',
      'Import HomeBank',
    ]

    const tiles = catalog(page).getByRole('listitem').getByRole('button')
    for (const name of providerNames) {
      await expect(tiles.filter({ has: page.getByText(name, { exact: true }) })).toHaveCount(1)
    }
    await expect(tiles).toHaveCount(providerNames.length)
    // Account visibility is not a provider: it has its own entry in the page header.
    await expect(page.getByRole('button', { name: 'Comptes visibles' })).toBeVisible()
  })

  test('should narrow the catalog by search and by category', async ({ page }) => {
    const tiles = catalog(page).getByRole('listitem')
    // Accent- and case-insensitive, on the name and the description.
    await catalog(page).getByLabel('Rechercher un établissement').fill('scpi')
    await expect(tiles).toHaveCount(2)
    await expect(catalog(page).getByText('CORUM', { exact: true })).toBeVisible()
    await catalog(page).getByLabel('Rechercher un établissement').fill('')
    await catalog(page).getByRole('button', { name: 'Crypto', exact: true }).click()
    await expect(tiles).toHaveCount(2)
    await expect(catalog(page).getByText('Portefeuilles crypto', { exact: true })).toBeVisible()
  })

  test('should list the connections with their state', async ({ page }) => {
    const connections = page.getByRole('main').getByRole('list').first()
    await expect(connections.getByRole('button', { name: /^BoursoBank.*Session expirée/ })).toBeVisible()
    await expect(connections.getByRole('button', { name: /^BINANCE.*Connecté/ })).toBeVisible()
  })

  test('should open a provider view from a connection and come back', async ({ page }) => {
    await page.getByRole('button', { name: /^BINANCE/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Plateformes crypto' })).toBeVisible()
    await page.getByRole('button', { name: 'Synchronisation' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Synchronisation' })).toBeVisible()
  })

  test('should require a currency for QIF files and reset it for HomeBank backups', async ({ page }) => {
    await openProvider(page, 'Import HomeBank')
    const fileInput = page.getByLabel('Fichier HomeBank')
    const qif = Buffer.from('!Account\nNSynthetic Checking\nTBank\n^\n!Type:Bank\nD2024/01/01\nT-12.34\nPTest transaction\n^\n')
    await fileInput.setInputFiles({
      name: 'sample.qif',
      mimeType: 'text/plain',
      buffer: qif,
    })

    const previewButton = page.getByRole('button', { name: "Prévisualiser l'import" })
    const currencyInput = page.getByLabel('Devise du QIF (ISO 4217)')
    await expect(currencyInput).toBeVisible()
    await expect(page.getByLabel('Mot de passe du fichier (si nécessaire)')).toHaveCount(0)
    await expect(previewButton).toBeDisabled()

    await currencyInput.fill('ABC')
    await expect(previewButton).toBeDisabled()
    await currencyInput.fill('EUR')
    await expect(previewButton).toBeEnabled()

    await fileInput.setInputFiles({
      name: 'sample.hbexport',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('synthetic HomeBank backup fixture'),
    })
    await expect(page.getByLabel('Mot de passe du fichier (si nécessaire)')).toBeVisible()
    await expect(page.getByLabel('Devise du QIF (ISO 4217)')).toHaveCount(0)

    await fileInput.setInputFiles({
      name: 'sample.qif',
      mimeType: 'text/plain',
      buffer: qif,
    })
    await expect(page.getByLabel('Devise du QIF (ISO 4217)')).toHaveValue('')
    await expect(page.getByLabel('Mot de passe du fichier (si nécessaire)')).toHaveCount(0)
  })

  test('should show the disconnected Fortuneo panel without a contract error', async ({ page }) => {
    await openProvider(page, 'Fortuneo')

    // The view's header carries the connection state; the panel shows the login form.
    await expect(page.getByRole('main').getByText('Non connecté', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Identifiant')).toBeVisible()
    await expect(page.getByText(/Invalid input|syncStatus|ZodError/)).toHaveCount(0)
  })

  // A provider view is a deep link: choosing a tile writes ?tab=<key>.
  test('should open the Exchanges view', async ({ page }) => {
    await openProvider(page, 'Plateformes crypto')
    await expect(page).toHaveURL(/\/sync\?tab=exchanges$/)
    // Exchanges content should be visible
    await expect(page.getByText('Ajouter une plateforme')).toBeVisible()
  })

  test('should open the Wallets view', async ({ page }) => {
    await openProvider(page, 'Portefeuilles crypto')
    // Wallets content should be visible
    await expect(page.getByText('Ajouter un portefeuille')).toBeVisible()
  })

  test('should open the Finary view and show login + file import', async ({ page }) => {
    await openProvider(page, 'Finary')
    // API-login form should be visible
    await expect(page.getByText('Se connecter à Finary')).toBeVisible()
    // Upload area should be visible
    await expect(page.getByText('Importer un fichier Finary (.xlsx)').first()).toBeVisible()
  })

  test('should open the Actual Budget view and show the file import', async ({ page }) => {
    await openProvider(page, 'Actual Budget')
    await expect(page.getByText('Importer un export Actual Budget')).toBeVisible()
    await expect(page.getByRole('button', { name: "Prévisualiser l'import" })).toBeDisabled()
  })

  test('should open a view directly via the ?tab= query param', async ({ page }) => {
    await page.goto('/sync?tab=exchanges')
    await expect(page.getByText('Ajouter une plateforme')).toBeVisible()
  })

  test('should fall back to the overview for an unknown ?tab=', async ({ page }) => {
    await page.goto('/sync?tab=nope')
    await expect(page.getByRole('heading', { level: 1, name: 'Synchronisation' })).toBeVisible()
    await expect(catalog(page)).toBeVisible()
  })
})
