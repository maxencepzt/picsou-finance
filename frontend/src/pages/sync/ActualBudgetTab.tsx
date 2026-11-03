import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useMoney } from '@/hooks/use-money'
import { ACCOUNT_COLORS, ACCOUNT_TYPES, NON_LEDGER_ACCOUNT_TYPES, SUPPORTED_CURRENCIES } from '@/lib/constants'
import { extractErrorMessage } from '@/lib/errors'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { useImportActualBudget, usePlanActualImport, usePreviewActualBudget } from '@/features/actual/hooks'
import type {
  ActualAccountMapping,
  ActualAccountPreview,
  ActualCategoryMapping,
  ActualImportPlan,
  ActualImportRequest,
  ActualImportResult,
  ActualImportWarning,
  ActualPreviewResponse,
} from '@/features/actual/types'
import type { AccountType } from '@/types/api'

/**
 * Actual holds cash ledgers, so it cannot target a non-ledger account. A loan is refused too: it
 * is stored as the positive amount owed, so Actual's negative ledger would count as wealth.
 */
const NON_LEDGER_TYPES: AccountType[] = [...NON_LEDGER_ACCOUNT_TYPES, 'LOAN']
const LEDGER_ACCOUNT_TYPES = ACCOUNT_TYPES.filter(({ value }) => !NON_LEDGER_TYPES.includes(value))
const RESULT_KEYS = ['accountsCreated', 'accountsMapped', 'accountsSkipped', 'categoriesCreated', 'transactionsImported', 'transactionsSkipped', 'transactionsDeleted', 'transactionsMoved'] as const
const ACCOUNT_ACTIONS = ['SKIP', 'MAP_EXISTING', 'CREATE_NEW'] as const
const ACCOUNT_ACTION_KEYS = { SKIP: 'skip', MAP_EXISTING: 'mapExisting', CREATE_NEW: 'createNew' } as const
/** A small neutral tag next to a payee (transfer, starting balance). */
const CHIP = 'rounded-md bg-muted px-1.5 text-xs font-medium text-muted-foreground'

function isPreview(data: unknown): data is ActualPreviewResponse {
  const value = data as Partial<ActualPreviewResponse> | null
  return !!value && typeof value.fileToken === 'string' && Array.isArray(value.accounts)
    && Array.isArray(value.categories) && Array.isArray(value.existingAccounts)
    && Array.isArray(value.actualAccountIds) && Array.isArray(value.existingCategories)
    && Array.isArray(value.sampleTransactions) && typeof value.totalTransactions === 'number'
}

function isPlan(data: unknown): data is ActualImportPlan {
  const value = data as Partial<ActualImportPlan> | null
  return !!value && typeof value.transactionsToAdd === 'number' && typeof value.transactionsToDelete === 'number'
    && typeof value.transactionsToMove === 'number' && Array.isArray(value.warnings)
    && typeof value.largeDeletion === 'boolean'
}

/**
 * An account an Actual import created belongs to the source account it was created for: offered
 * to another source, a re-import of its own file would treat that source's rows as its ledger.
 */
function compatibleAccounts(preview: ActualPreviewResponse, account: ActualAccountPreview, currency: string) {
  const actualAccountIds = new Set(preview.actualAccountIds)
  return preview.existingAccounts.filter((item) => item.currency === currency && !NON_LEDGER_TYPES.includes(item.type)
    && (!actualAccountIds.has(item.id) || item.id === account.importedAccountId))
}

function initialAccountMappings(preview: ActualPreviewResponse, currency: string): ActualAccountMapping[] {
  return preview.accounts.map((account, index) => {
    const compatible = compatibleAccounts(preview, account, currency)
    // The account an earlier import created for this very source wins over a same-name account.
    const match = compatible.find((item) => item.id === account.importedAccountId)
      ?? compatible.find((item) => item.name === account.name)
    // newAccount is kept even when mapping to an existing account, so switching back to
    // "create" restores the suggested details; the request strips it for other actions.
    return {
      sourceId: account.sourceId,
      action: match ? 'MAP_EXISTING' : 'CREATE_NEW',
      targetAccountId: match?.id,
      newAccount: {
        name: account.name.slice(0, 100),
        type: account.suggestedType,
        currency,
        color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
      },
    }
  })
}

function initialCategoryMappings(preview: ActualPreviewResponse): ActualCategoryMapping[] {
  return preview.categories.map((category) => {
    const kind = category.income ? 'INCOME' : 'EXPENSE'
    const match = preview.existingCategories.find((item) => item.name === category.name && item.kind === kind && !item.archived)
    return match
      ? { sourceId: category.sourceId, action: 'MAP_EXISTING', targetCategoryId: match.id }
      : { sourceId: category.sourceId, action: 'CREATE_NEW', name: category.name.slice(0, 100) }
  })
}

export function ActualBudgetTab() {
  const { t } = useTranslation()
  const money = useMoney()
  const previewMutation = usePreviewActualBudget()
  const planMutation = usePlanActualImport()
  const importMutation = useImportActualBudget()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ActualPreviewResponse | null>(null)
  const [currency, setCurrency] = useState('EUR')
  const [accountMappings, setAccountMappings] = useState<ActualAccountMapping[]>([])
  const [categoryMappings, setCategoryMappings] = useState<ActualCategoryMapping[]>([])
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [plan, setPlan] = useState<ActualImportPlan | null>(null)
  const [result, setResult] = useState<ActualImportResult | null>(null)

  const busy = previewMutation.isPending || planMutation.isPending || importMutation.isPending

  function selectFile(selected: File | undefined) {
    if (!selected || busy) return
    setFile(selected)
    setError(null)
  }

  async function handlePreview() {
    if (!file || busy) return
    setError(null)
    try {
      const data = await previewMutation.mutateAsync(file)
      if (!isPreview(data)) throw new Error(t('sync.actual.errors.invalidPreview'))
      const budgetCurrency = data.currency ?? 'EUR'
      setPreview(data)
      setCurrency(budgetCurrency)
      setAccountMappings(initialAccountMappings(data, budgetCurrency))
      setCategoryMappings(initialCategoryMappings(data))
    } catch (cause) {
      setError(extractErrorMessage(cause, t('sync.actual.errors.previewFailed')))
    }
  }

  function changeCurrency(next: string) {
    setCurrency(next)
    setAccountMappings((current) => current.map((mapping) => ({
      ...mapping,
      targetAccountId: undefined,
      newAccount: mapping.newAccount && { ...mapping.newAccount, currency: next },
    })))
  }

  function updateAccount(index: number, patch: Partial<ActualAccountMapping>) {
    setAccountMappings((current) => current.map((mapping, i) => (i === index ? { ...mapping, ...patch } : mapping)))
  }

  function updateCategory(index: number, patch: Partial<ActualCategoryMapping>) {
    setCategoryMappings((current) => current.map((mapping, i) => (i === index ? { ...mapping, ...patch } : mapping)))
  }

  function buildRequest(fileToken: string, acknowledgeLargeDeletion: boolean): ActualImportRequest {
    return {
      fileToken,
      currency,
      acknowledgeLargeDeletion,
      accountMappings: accountMappings.map((mapping) => ({
        sourceId: mapping.sourceId,
        action: mapping.action,
        ...(mapping.action === 'MAP_EXISTING' && { targetAccountId: mapping.targetAccountId }),
        ...(mapping.action === 'CREATE_NEW' && { newAccount: mapping.newAccount }),
      })),
      categoryMappings: categoryMappings.map((mapping) => ({
        sourceId: mapping.sourceId,
        action: mapping.action,
        ...(mapping.action === 'MAP_EXISTING' && { targetCategoryId: mapping.targetCategoryId }),
        ...(mapping.action === 'CREATE_NEW' && { name: mapping.name?.trim() }),
      })),
    }
  }

  /** The dry run tells the user what a re-import deletes and moves before they confirm. */
  async function reviewImport() {
    if (!preview || busy) return
    setError(null)
    try {
      const data = await planMutation.mutateAsync(buildRequest(preview.fileToken, false))
      if (!isPlan(data)) throw new Error(t('sync.actual.errors.importFailed'))
      setPlan(data)
      setConfirmOpen(true)
    } catch (cause) {
      setError(extractErrorMessage(cause, t('sync.actual.errors.importFailed')))
    }
  }

  async function executeImport() {
    if (!preview || importMutation.isPending) return
    setError(null)
    try {
      // The dialog only confirms a large deletion once the user typed its row count.
      setResult(await importMutation.mutateAsync(buildRequest(preview.fileToken, !!plan?.largeDeletion)))
    } catch (cause) {
      setError(extractErrorMessage(cause, t('sync.actual.errors.importFailed')))
    } finally {
      setConfirmOpen(false)
    }
  }

  function warningText(warning: ActualImportWarning) {
    return t(`sync.actual.warnings.${warning.reason}`, { count: warning.count })
  }

  function reset() {
    if (busy) return
    previewMutation.reset()
    planMutation.reset()
    importMutation.reset()
    setFile(null)
    setPreview(null)
    setAccountMappings([])
    setCategoryMappings([])
    setResult(null)
    setError(null)
  }

  const hasWork = accountMappings.some((mapping) => mapping.action !== 'SKIP')
  const mappingsValid = accountMappings.every((mapping) =>
    mapping.action === 'SKIP'
    || (mapping.action === 'MAP_EXISTING' ? mapping.targetAccountId != null : !!mapping.newAccount?.name.trim()))
    && categoryMappings.every((mapping) =>
      mapping.action === 'UNCATEGORIZED'
      || (mapping.action === 'MAP_EXISTING' ? mapping.targetCategoryId != null : !!mapping.name?.trim()))
  const accountNames = new Map(preview?.accounts.map((account) => [account.sourceId, account.name]))

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
            <Button type="submit" size="xs" className={PANEL_ACTION} disabled={!file || busy}>
              {previewMutation.isPending && <Loader2 className="animate-spin" />}
              {t('sync.actual.preview')}
            </Button>
          }
        >
          <FileDropZone
            title={t('sync.actual.upload')}
            hint={t('sync.actual.uploadHint')}
            buttonLabel={t('sync.actual.chooseFile')}
            accept=".zip,.sqlite,application/zip"
            inputLabel={t('sync.actual.file')}
            fileName={file?.name}
            disabled={busy}
            onFile={selectFile}
          />
        </PanelForm>
      )}

      {preview && !result && (
        <>
          <Card size="sm">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {t('sync.actual.previewSummary', {
                  accounts: preview.accounts.length,
                  categories: preview.categories.length,
                  transactions: preview.totalTransactions,
                })}
              </p>
              <PanelActions className="shrink-0">
                <Button variant="ghost" size="xs" className={PANEL_ACTION} onClick={reset} disabled={busy}>
                  {t('sync.actual.restart')}
                </Button>
                <Button size="xs" className={PANEL_ACTION} onClick={reviewImport} disabled={busy || !hasWork || !mappingsValid}>
                  {planMutation.isPending && <Loader2 className="animate-spin" />}
                  {t('sync.actual.import')}
                </Button>
              </PanelActions>
            </CardContent>
          </Card>

          {preview.transferTransactions > 0 && (
            <p role="status" className="rounded-xl bg-muted px-4 py-3 text-sm text-pretty text-foreground">
              {t('sync.actual.transfersNeutral', { count: preview.transferTransactions })}
            </p>
          )}

          {preview.currency ? (
            <p className="px-1 text-sm">
              <span className="text-muted-foreground">{t('sync.actual.currency')} · </span>
              <span className="font-medium text-foreground">{preview.currency}</span>
            </p>
          ) : (
            <PanelField id="actual-currency" label={t('sync.actual.currency')} hint={t('sync.actual.currencyHint')} className="max-w-xs">
              <NativeSelect id="actual-currency" className={PANEL_SELECT} value={currency} onChange={(event) => changeCurrency(event.target.value)}>
                {SUPPORTED_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
              </NativeSelect>
            </PanelField>
          )}

          <PanelSection title={t('sync.actual.accounts')} aside={preview.accounts.length}>
            {preview.accounts.map((account, index) => {
              const mapping = accountMappings[index]
              const compatible = compatibleAccounts(preview, account, currency)
              return (
                <div key={account.sourceId} className="space-y-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{account.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.transactionCount} {t('sync.actual.transactions')}
                        {account.offBudget && ` · ${t('sync.actual.offBudget')}`}
                        {account.closed && ` · ${t('sync.actual.closed')}`}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{money.amount(account.balance, currency)}</p>
                  </div>
                  <SegmentedControl
                    ariaLabel={account.name}
                    options={ACCOUNT_ACTIONS.map((action) => ({ value: action, label: t(`sync.actual.${ACCOUNT_ACTION_KEYS[action]}`) }))}
                    value={mapping.action}
                    onChange={(action) => updateAccount(index, { action })}
                    className={PANEL_SEGMENTED_WRAP}
                  />
                  {mapping.action === 'MAP_EXISTING' && (
                    <NativeSelect
                      aria-label={t('sync.actual.targetAccount', { name: account.name })}
                      className={PANEL_SELECT}
                      value={mapping.targetAccountId ?? ''}
                      onChange={(event) => updateAccount(index, { targetAccountId: event.target.value ? Number(event.target.value) : undefined })}
                    >
                      <option value="">{t('sync.actual.chooseAccount')}</option>
                      {compatible.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.currency})</option>)}
                    </NativeSelect>
                  )}
                  {mapping.action === 'MAP_EXISTING' && account.importedAccountId != null
                    && mapping.targetAccountId === account.importedAccountId && (
                    <p className="text-xs text-muted-foreground">{t('sync.actual.previouslyImported')}</p>
                  )}
                  {mapping.action === 'CREATE_NEW' && mapping.newAccount && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <PanelField id={`actual-account-name-${index}`} label={t('sync.actual.accountName')}>
                        <Input
                          id={`actual-account-name-${index}`}
                          className={PANEL_INPUT}
                          maxLength={100}
                          value={mapping.newAccount.name}
                          onChange={(event) => updateAccount(index, { newAccount: { ...mapping.newAccount!, name: event.target.value } })}
                        />
                      </PanelField>
                      <PanelField id={`actual-account-type-${index}`} label={t('sync.actual.accountType')}>
                        <NativeSelect
                          id={`actual-account-type-${index}`}
                          className={PANEL_SELECT}
                          value={mapping.newAccount.type}
                          onChange={(event) => updateAccount(index, { newAccount: { ...mapping.newAccount!, type: event.target.value as AccountType } })}
                        >
                          {LEDGER_ACCOUNT_TYPES.map((type) => <option key={type.value} value={type.value}>{t(type.labelKey)}</option>)}
                        </NativeSelect>
                      </PanelField>
                    </div>
                  )}
                </div>
              )
            })}
          </PanelSection>

          <PanelSection title={t('sync.actual.categories')} aside={preview.categories.length}>
            {preview.categories.map((category, index) => {
              const mapping = categoryMappings[index]
              const kind = category.income ? 'INCOME' : 'EXPENSE'
              return (
                <div key={category.sourceId} className="space-y-2 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {category.groupName && `${category.groupName} · `}
                      {t(category.income ? 'sync.actual.income' : 'sync.actual.expense')} · {category.transactionCount} {t('sync.actual.transactions')}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <NativeSelect
                      aria-label={t('sync.actual.categoryAction', { name: category.name })}
                      className={PANEL_SELECT}
                      value={mapping.action}
                      onChange={(event) => {
                        const action = event.target.value as ActualCategoryMapping['action']
                        updateCategory(index, { action, targetCategoryId: undefined, name: mapping.name ?? category.name.slice(0, 100) })
                      }}
                    >
                      <option value="CREATE_NEW">{t('sync.actual.createCategory')}</option>
                      <option value="MAP_EXISTING">{t('sync.actual.mapExistingCategory')}</option>
                      <option value="UNCATEGORIZED">{t('sync.actual.uncategorized')}</option>
                    </NativeSelect>
                    {mapping.action === 'CREATE_NEW' && (
                      <Input
                        aria-label={t('sync.actual.categoryName', { name: category.name })}
                        className={PANEL_INPUT}
                        maxLength={100}
                        value={mapping.name ?? ''}
                        onChange={(event) => updateCategory(index, { name: event.target.value })}
                      />
                    )}
                    {mapping.action === 'MAP_EXISTING' && (
                      <NativeSelect
                        aria-label={t('sync.actual.targetCategory', { name: category.name })}
                        className={PANEL_SELECT}
                        value={mapping.targetCategoryId ?? ''}
                        onChange={(event) => updateCategory(index, { targetCategoryId: event.target.value ? Number(event.target.value) : undefined })}
                      >
                        <option value="">{t('sync.actual.chooseCategory')}</option>
                        {preview.existingCategories
                          .filter((item) => item.kind === kind && !item.archived)
                          .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </NativeSelect>
                    )}
                  </div>
                </div>
              )
            })}
          </PanelSection>

          <PanelSection title={t('sync.actual.sampleTransactions')} aside={preview.sampleTransactions.length}>
            {preview.sampleTransactions.map((transaction) => (
              <div key={transaction.sourceId} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0 space-y-0.5">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                    <span className="min-w-0 truncate">{transaction.payee || t('sync.actual.noPayee')}</span>
                    {transaction.kind === 'TRANSFER' && <span className={CHIP}>{t('sync.actual.transfer')}</span>}
                    {transaction.kind === 'STARTING_BALANCE' && <span className={CHIP}>{t('sync.actual.startingBalance')}</span>}
                  </p>
                  {transaction.notes && <p className="text-xs text-muted-foreground">{transaction.notes}</p>}
                  <p className="text-xs text-muted-foreground">
                    {formatDate(transaction.date)} · {accountNames.get(transaction.accountSourceId)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{money.amount(transaction.amount, currency)}</p>
              </div>
            ))}
          </PanelSection>
        </>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RESULT_KEYS.map((key) => (
              <PanelStat key={key} label={t(`sync.actual.${key}`)} value={result[key]} />
            ))}
          </div>
          {result.warnings.map((warning) => (
            <p key={warning.reason} role="status" className="rounded-xl bg-muted px-4 py-3 text-sm text-pretty text-foreground">
              {warningText(warning)}
            </p>
          ))}
          <PanelActions>
            <Button size="xs" className={PANEL_ACTION} onClick={reset}>
              <CheckCircle2 />
              {t('sync.actual.done')}
            </Button>
          </PanelActions>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('sync.actual.confirmTitle')}
        description={plan ? [
          ...(plan.largeDeletion ? [t('sync.actual.largeDeletion', { count: plan.transactionsToDelete })] : []),
          t('sync.actual.planSummary', {
            added: plan.transactionsToAdd,
            deleted: plan.transactionsToDelete,
            moved: plan.transactionsToMove,
          }),
          ...plan.warnings.map(warningText),
          t('sync.actual.confirmDescription'),
        ].join(' ') : ''}
        confirmLabel={t('common.confirm')}
        onConfirm={executeImport}
        loading={importMutation.isPending}
        variant={plan?.largeDeletion ? 'destructive' : 'default'}
        confirmPhrase={plan?.largeDeletion ? String(plan.transactionsToDelete) : undefined}
      />
    </div>
  )
}
