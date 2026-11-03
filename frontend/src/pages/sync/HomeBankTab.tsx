import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMoney } from '@/hooks/use-money'
import { ACCOUNT_COLORS, ACCOUNT_TYPES, NON_LEDGER_ACCOUNT_TYPES, SUPPORTED_CURRENCIES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { extractErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import {
  FileDropZone,
  PanelActions,
  PanelError,
  PanelField,
  PanelForm,
  PanelSection,
  PanelStat,
} from '@/components/sync/ProviderPanel'
import { PANEL_ACTION, PANEL_INPUT, PANEL_SEGMENTED_WRAP, PANEL_SELECT } from '@/components/sync/panel-styles'
import { CheckCircle2, Loader2, Lock, TriangleAlert } from 'lucide-react'
import { useImportHomeBank, usePreviewHomeBank } from '@/features/homebank/hooks'
import type { HomeBankAccountMapping, HomeBankCategoryMapping, HomeBankCategoryPreview, HomeBankPreviewResponse } from '@/features/homebank/types'
import type { AccountType } from '@/types/api'

const allowedAccountTypes = ACCOUNT_TYPES.filter(({ value }) => !NON_LEDGER_ACCOUNT_TYPES.includes(value))
const ACCOUNT_ACTIONS = ['SKIP', 'MAP_EXISTING', 'CREATE_NEW'] as const
const ACCOUNT_ACTION_KEYS = { SKIP: 'skip', MAP_EXISTING: 'mapExisting', CREATE_NEW: 'createNew' } as const
const intlSupportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: 'currency') => string[] }).supportedValuesOf
const validCurrencyCodes = new Set(intlSupportedValuesOf?.call(Intl, 'currency') ?? SUPPORTED_CURRENCIES)

function isValidCurrencyCode(code: string) {
  return validCurrencyCodes.has(code)
}

export function HomeBankTab() {
  const { t } = useTranslation()
  const money = useMoney()
  const previewMutation = usePreviewHomeBank()
  const importMutation = useImportHomeBank()
  const previewInFlightRef = useRef(false)
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [currency, setCurrency] = useState('')
  const [preview, setPreview] = useState<HomeBankPreviewResponse | null>(null)
  const [accountMappings, setAccountMappings] = useState<HomeBankAccountMapping[]>([])
  const [categoryMappings, setCategoryMappings] = useState<HomeBankCategoryMapping[]>([])
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof importMutation.mutateAsync>> | null>(null)

  async function handlePreview() {
    const isQif = file?.name.toLowerCase().endsWith('.qif') ?? false
    const normalizedCurrency = currency.trim().toUpperCase()
    if (!file || (isQif && !isValidCurrencyCode(normalizedCurrency)) || previewInFlightRef.current || previewMutation.isPending) return
    previewInFlightRef.current = true
    setError(null)
    try {
      const data = await previewMutation.mutateAsync({ file, password: isQif ? undefined : password || undefined, currency: isQif ? normalizedCurrency : undefined })
      if (!data || typeof data.fileToken !== 'string' || !Array.isArray(data.accounts) || !Array.isArray(data.categories)
        || !Array.isArray(data.existingAccounts) || !Array.isArray(data.existingCategories) || !Array.isArray(data.sampleTransactions)
        || typeof data.totalTransactions !== 'number' || typeof data.forecastTransactions !== 'number') {
        throw new Error(t('sync.homebank.errors.invalidPreview'))
      }
      setPreview(data)
      setPassword('')
      setAccountMappings(data.accounts.map((account, index) => {
        const exact = data.existingAccounts.find(item => item.name === account.name && item.currency === account.currency && isLedgerType(item.type))
        const safeType = allowedAccountTypes.some(item => item.value === account.suggestedType) ? account.suggestedType : 'OTHER'
        return exact
          ? { sourceId: account.sourceId, action: 'MAP_EXISTING', targetAccountId: exact.id }
          : { sourceId: account.sourceId, action: 'CREATE_NEW', newAccount: { name: account.name, type: safeType, provider: account.institution || undefined, currency: account.currency, color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length] } }
      }))
      setCategoryMappings(data.categories.map(category => {
        const parent = data.categories.find(item => item.sourceId === category.parentSourceId)
        const parentKindMismatch = !!parent && parent.income !== category.income && !category.kindInferred
        const exact = data.existingCategories.find(item => item.name === category.name && kindAccepts(category, item.kind) && !item.archived)
        return exact && !parentKindMismatch
          ? { sourceId: category.sourceId, action: 'MAP_EXISTING', targetCategoryId: exact.id }
          : { sourceId: category.sourceId, action: 'CREATE_NEW', name: category.name }
      }))
    } catch (cause) {
      setError(extractErrorMessage(cause, t('sync.homebank.errors.previewFailed')))
    } finally {
      previewInFlightRef.current = false
    }
  }

  function isLedgerType(type: AccountType) {
    return !NON_LEDGER_ACCOUNT_TYPES.includes(type)
  }

  function updateAccount(index: number, patch: Partial<HomeBankAccountMapping>) {
    setAccountMappings(current => current.map((mapping, itemIndex) => itemIndex === index ? { ...mapping, ...patch } : mapping))
  }

  function updateCategory(index: number, patch: Partial<HomeBankCategoryMapping>) {
    setCategoryMappings(current => current.map((mapping, itemIndex) => itemIndex === index ? { ...mapping, ...patch } : mapping))
  }

  function hasParentKindMismatch(sourceId: string) {
    const category = preview?.categories.find(item => item.sourceId === sourceId)
    const parent = preview?.categories.find(item => item.sourceId === category?.parentSourceId)
    return !!category && !!parent && category.income !== parent.income && !category.kindInferred
  }

  function kindAccepts(category: HomeBankCategoryPreview, kind: string) {
    return category.kindInferred ? kind === 'INCOME' || kind === 'EXPENSE' : kind === (category.income ? 'INCOME' : 'EXPENSE')
  }

  async function executeImport() {
    if (!preview || importMutation.isPending) return
    setError(null)
    try {
      const imported = await importMutation.mutateAsync({ fileToken: preview.fileToken, accountMappings, categoryMappings })
      setResult(imported)
      setConfirmOpen(false)
    } catch (cause) {
      setError(extractErrorMessage(cause, t('sync.homebank.errors.importFailed')))
      setConfirmOpen(false)
    }
  }

  function resetWizard() {
    if (previewInFlightRef.current || importMutation.isPending) return
    previewMutation.reset()
    importMutation.reset()
    setFile(null)
    setPassword('')
    setCurrency('')
    setPreview(null)
    setAccountMappings([])
    setCategoryMappings([])
    setResult(null)
    setError(null)
    setConfirmOpen(false)
  }

  function selectFile(selected: File | undefined) {
    if (!selected || previewInFlightRef.current || importMutation.isPending) return
    previewMutation.reset()
    importMutation.reset()
    setFile(selected)
    setPassword('')
    setCurrency('')
    setPreview(null)
    setResult(null)
    setError(null)
  }

  const busy = previewMutation.isPending || importMutation.isPending
  const isQif = file?.name.toLowerCase().endsWith('.qif') ?? false
  const normalizedCurrency = currency.trim().toUpperCase()
  const qifCurrencyValid = isValidCurrencyCode(normalizedCurrency)
  const hasWork = accountMappings.some(mapping => mapping.action !== 'SKIP')
  const mappingsValid = accountMappings.every(mapping => mapping.action === 'SKIP' || (mapping.action === 'MAP_EXISTING' ? mapping.targetAccountId != null : !!mapping.newAccount?.name.trim()))
    && categoryMappings.every(mapping => mapping.action === 'UNCATEGORIZED' || (mapping.action === 'MAP_EXISTING' ? mapping.targetCategoryId != null : !!mapping.name?.trim() && !hasParentKindMismatch(mapping.sourceId)))

  return (
    <div className="space-y-4">
      {error && <PanelError>{error}</PanelError>}

      {!preview && !result && (
        <PanelForm
          onSubmit={(event) => {
            event.preventDefault()
            void handlePreview()
          }}
          actions={
            <Button type="submit" size="xs" className={PANEL_ACTION} disabled={!file || busy || (isQif && !qifCurrencyValid)}>
              {previewMutation.isPending && <Loader2 className="animate-spin" />}
              {t('sync.homebank.preview')}
            </Button>
          }
        >
          <FileDropZone
            title={t('sync.homebank.upload')}
            hint={t('sync.homebank.uploadHint')}
            buttonLabel={t('sync.homebank.chooseFile')}
            accept=".hbk,.hbexport,.qif"
            inputLabel={t('sync.homebank.file')}
            fileName={file?.name}
            disabled={busy}
            onFile={selectFile}
          />
          {isQif ? (
            <>
              <PanelField id="homebank-currency" label={t('sync.homebank.currency')} className="max-w-xs">
                <Input
                  id="homebank-currency"
                  className={PANEL_INPUT}
                  aria-label={t('sync.homebank.currency')}
                  required
                  maxLength={3}
                  autoComplete="off"
                  placeholder={t('sync.homebank.currencyPlaceholder')}
                  value={currency}
                  onChange={event => setCurrency(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
                />
              </PanelField>
              <p className="rounded-xl bg-muted px-4 py-3 text-xs text-pretty text-muted-foreground">{t('sync.homebank.qifLimitations')}</p>
            </>
          ) : (
            <PanelField id="homebank-password" label={t('sync.homebank.password')} icon={Lock}>
              <Input
                id="homebank-password"
                className={PANEL_INPUT}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
            </PanelField>
          )}
        </PanelForm>
      )}

      {preview && !result && (
        <>
          <Card size="sm">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {t('sync.homebank.previewSummary', { accounts: preview.accounts.length, categories: preview.categories.length, transactions: preview.totalTransactions })}
              </p>
              <PanelActions className="shrink-0">
                <Button variant="ghost" size="xs" className={PANEL_ACTION} onClick={resetWizard} disabled={busy}>
                  {t('sync.homebank.restart')}
                </Button>
                <Button size="xs" className={PANEL_ACTION} onClick={() => setConfirmOpen(true)} disabled={busy || !hasWork || !mappingsValid}>
                  {t('sync.homebank.import')}
                </Button>
              </PanelActions>
            </CardContent>
          </Card>

          {preview.forecastTransactions > 0 && (
            <p role="status" className="rounded-xl bg-muted px-4 py-3 text-sm text-pretty text-foreground">
              {t('sync.homebank.forecastsSkipped', { count: preview.forecastTransactions })}
            </p>
          )}

          <PanelSection title={t('sync.homebank.accounts')} aside={preview.accounts.length}>
            {preview.accounts.map((account, index) => {
              const mapping = accountMappings[index]
              const compatible = preview.existingAccounts.filter(item => item.currency === account.currency && isLedgerType(item.type))
              const suggestedType = allowedAccountTypes.some(type => type.value === account.suggestedType) ? account.suggestedType : 'OTHER'
              return (
                <div key={account.sourceId} className="space-y-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{account.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.institution} · {account.currency} · {account.transactionCount} {t('sync.homebank.transactions')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-foreground tabular-nums">{money.amount(account.balance, account.currency)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {t('common.labelColon', { label: t('sync.homebank.initialBalance') })} {money.amount(account.initialBalance, account.currency)}
                      </p>
                    </div>
                  </div>
                  <SegmentedControl
                    ariaLabel={account.name}
                    options={ACCOUNT_ACTIONS.map(action => ({ value: action, label: t(`sync.homebank.${ACCOUNT_ACTION_KEYS[action]}`) }))}
                    value={mapping.action}
                    onChange={action => updateAccount(index, action === 'SKIP'
                      ? { action, targetAccountId: undefined, newAccount: undefined }
                      : action === 'MAP_EXISTING'
                        ? { action, newAccount: undefined }
                        : { action, targetAccountId: undefined, newAccount: mapping.newAccount ?? { name: account.name, type: suggestedType, provider: account.institution || undefined, currency: account.currency } })}
                    className={PANEL_SEGMENTED_WRAP}
                  />
                  {mapping.action === 'MAP_EXISTING' && (
                    <NativeSelect
                      aria-label={t('sync.homebank.targetAccount', { name: account.name })}
                      className={PANEL_SELECT}
                      value={mapping.targetAccountId ?? ''}
                      onChange={event => updateAccount(index, { targetAccountId: event.target.value ? Number(event.target.value) : undefined })}
                    >
                      <option value="">{t('sync.homebank.chooseAccount')}</option>
                      {compatible.map(item => <option key={item.id} value={item.id}>{item.name} ({item.currency})</option>)}
                    </NativeSelect>
                  )}
                  {mapping.action === 'CREATE_NEW' && mapping.newAccount && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <PanelField id={`homebank-account-name-${index}`} label={t('sync.homebank.accountName')}>
                        <Input
                          id={`homebank-account-name-${index}`}
                          className={PANEL_INPUT}
                          value={mapping.newAccount.name}
                          onChange={event => updateAccount(index, { newAccount: { ...mapping.newAccount!, name: event.target.value } })}
                        />
                      </PanelField>
                      <PanelField id={`homebank-account-type-${index}`} label={t('sync.homebank.accountType')}>
                        <NativeSelect
                          id={`homebank-account-type-${index}`}
                          className={PANEL_SELECT}
                          value={mapping.newAccount.type}
                          onChange={event => updateAccount(index, { newAccount: { ...mapping.newAccount!, type: event.target.value as AccountType } })}
                        >
                          {allowedAccountTypes.map(type => <option key={type.value} value={type.value}>{t(type.labelKey)}</option>)}
                        </NativeSelect>
                      </PanelField>
                    </div>
                  )}
                </div>
              )
            })}
          </PanelSection>

          <PanelSection title={t('sync.homebank.categories')} aside={preview.categories.length}>
            {preview.categories.map((category, index) => {
              const mapping = categoryMappings[index]
              return (
                <div key={category.sourceId} className="space-y-2 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(category.income ? 'sync.homebank.income' : 'sync.homebank.expense')} · {category.transactionCount} {t('sync.homebank.transactions')}
                    </p>
                  </div>
                  {hasParentKindMismatch(category.sourceId) && (
                    <p role="alert" className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {t('sync.homebank.categoryParentKindMismatch', { parent: preview.categories.find(item => item.sourceId === category.parentSourceId)?.name })}
                    </p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <NativeSelect
                      aria-label={t('sync.homebank.categoryAction', { name: category.name })}
                      className={PANEL_SELECT}
                      value={mapping.action}
                      onChange={event => updateCategory(index, { action: event.target.value as HomeBankCategoryMapping['action'], targetCategoryId: undefined, name: event.target.value === 'CREATE_NEW' ? mapping.name ?? category.name : undefined })}
                    >
                      <option value="CREATE_NEW">{t('sync.homebank.createCategory')}</option>
                      <option value="MAP_EXISTING">{t('sync.homebank.mapExistingCategory')}</option>
                      <option value="UNCATEGORIZED">{t('sync.homebank.uncategorized')}</option>
                    </NativeSelect>
                    {mapping.action === 'CREATE_NEW' && (
                      <Input
                        aria-label={t('sync.homebank.categoryName', { name: category.name })}
                        className={PANEL_INPUT}
                        value={mapping.name ?? category.name}
                        onChange={event => updateCategory(index, { name: event.target.value })}
                      />
                    )}
                    {mapping.action === 'MAP_EXISTING' && (
                      <NativeSelect
                        aria-label={t('sync.homebank.targetCategory', { name: category.name })}
                        className={PANEL_SELECT}
                        value={mapping.targetCategoryId ?? ''}
                        onChange={event => updateCategory(index, { targetCategoryId: event.target.value ? Number(event.target.value) : undefined })}
                      >
                        <option value="">{t('sync.homebank.chooseCategory')}</option>
                        {preview.existingCategories.filter(item => kindAccepts(category, item.kind) && !item.archived).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </NativeSelect>
                    )}
                  </div>
                </div>
              )
            })}
          </PanelSection>

          <PanelSection title={t('sync.homebank.sampleTransactions')} aside={preview.sampleTransactions.length}>
            {preview.sampleTransactions.map(transaction => (
              <div key={transaction.sourceId} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium text-foreground">{transaction.payee || t('sync.homebank.noPayee')}</p>
                  {transaction.notes && <p className="text-xs text-muted-foreground">{transaction.notes}</p>}
                  <p className="text-xs text-muted-foreground">
                    {formatDate(transaction.date)} · {transaction.currency}{transaction.transfer ? ` · ${t('sync.homebank.transfer')}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{money.amount(transaction.amount, transaction.currency)}</p>
              </div>
            ))}
          </PanelSection>
        </>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(['accountsCreated', 'accountsMapped', 'accountsSkipped', 'categoriesCreated', 'transactionsImported', 'transactionsSkipped'] as const).map(key => (
              <PanelStat key={key} label={t(`sync.homebank.${key}`)} value={result[key]} />
            ))}
          </div>
          <PanelActions>
            <Button size="xs" className={PANEL_ACTION} onClick={resetWizard}>
              <CheckCircle2 />
              {t('sync.homebank.done')}
            </Button>
          </PanelActions>
        </>
      )}

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title={t('sync.homebank.confirmTitle')} description={t('sync.homebank.confirmDescription')} confirmLabel={t('common.confirm')} onConfirm={executeImport} loading={importMutation.isPending} variant="default" />
    </div>
  )
}
