import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { FileDropZone, PanelActions, PanelStat } from '@/components/sync/ProviderPanel'
import { PANEL_ACTION, PANEL_INPUT, PANEL_SEGMENTED_WRAP, PANEL_SELECT } from '@/components/sync/panel-styles'
import { useMoney } from '@/hooks/use-money'
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from 'lucide-react'
import { ACCOUNT_COLORS, ACCOUNT_TYPES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { availableTargets } from '@/features/sync/finary-mappings'
import type { FinaryStep, NewAccountField } from '@/features/sync/use-finary-import'
import type {
  FinaryAccountMapping,
  FinaryImportResultResponse,
  FinaryMappingAction,
  FinaryPreviewResponse,
} from '@/types/api'

/** `page` is the Sync page (cards); `modal` is the add-account wizard (no cards, a scrolling list). */
type FinaryVariant = 'page' | 'modal'

const MAPPING_ACTIONS = ['SKIP', 'MAP_EXISTING', 'CREATE_NEW'] as const
const ACTION_LABEL_KEYS: Record<FinaryMappingAction, string> = {
  SKIP: 'sync.finary.skip',
  MAP_EXISTING: 'sync.finary.mapExisting',
  CREATE_NEW: 'sync.finary.createNew',
}

/** File → mapping → result. Only the current step's name shows on a phone. */
export function FinaryStepIndicator({ step, variant }: { step: FinaryStep; variant: FinaryVariant }) {
  const { t } = useTranslation()
  return (
    <ol className={cn('flex items-center gap-2', variant === 'modal' && 'mb-4')}>
      {([1, 2, 3] as const).map((s) => {
        const current = step === s
        const done = step > s
        return (
          <Fragment key={s}>
            {s > 1 && <li aria-hidden className={cn('h-px w-6 shrink-0', done || current ? 'bg-primary/50' : 'bg-border')} />}
            <li className="flex items-center gap-2" aria-current={current ? 'step' : undefined}>
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums',
                  current && 'bg-primary text-primary-foreground',
                  done && 'bg-primary/12 text-primary',
                  !current && !done && 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : s}
              </span>
              <span
                className={cn(
                  'text-xs',
                  current ? 'font-semibold text-foreground' : 'hidden text-muted-foreground sm:inline',
                )}
              >
                {t(`sync.finary.step${s}`)}
              </span>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}

/** The "or" divider and the .xlsx drop zone under the login / sync block of step 1. */
export function FinaryUploadZone({
  onFile,
  disabled,
  variant,
}: {
  onFile: (file: File) => void
  disabled: boolean
  variant: FinaryVariant
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="flex items-center gap-3" aria-hidden>
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{t('sync.panel.or')}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <FileDropZone
        title={t('sync.finary.uploadFile')}
        hint={t('sync.finary.uploadHint')}
        buttonLabel={t('sync.finary.uploadFile')}
        accept=".xlsx"
        disabled={disabled}
        onFile={onFile}
        compact={variant === 'modal'}
      />
    </>
  )
}

interface FinaryMappingStepProps {
  preview: FinaryPreviewResponse
  mappings: FinaryAccountMapping[]
  loading: boolean
  hasSkipAll: boolean
  onBack: () => void
  onImport: () => void
  onActionChange: (index: number, action: FinaryMappingAction) => void
  onTargetChange: (index: number, id: number) => void
  onNewAccountField: (index: number, field: NewAccountField, value: string) => void
  variant: FinaryVariant
}

export function FinaryMappingStep({
  preview,
  mappings,
  loading,
  hasSkipAll,
  onBack,
  onImport,
  onActionChange,
  onTargetChange,
  onNewAccountField,
  variant,
}: FinaryMappingStepProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const modal = variant === 'modal'

  const rows = preview.accounts.map((account, index) => {
    const mapping = mappings[index]
    const fieldId = `finary-${index}`
    return (
      <div key={account.finaryCategory + account.finaryId} className="space-y-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{account.finaryName}</p>
            <p className="text-xs text-muted-foreground">
              {account.finaryInstitution} · {account.finaryCategory}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <CurrencyDisplay
              value={account.currentBalance}
              currency={account.nativeCurrency}
              className="text-sm font-semibold text-foreground tabular-nums"
            />
            <p className="text-xs text-muted-foreground tabular-nums">{account.transactionCount} tx</p>
          </div>
        </div>

        <SegmentedControl
          ariaLabel={account.finaryName}
          options={MAPPING_ACTIONS.map((action) => ({ value: action, label: t(ACTION_LABEL_KEYS[action]) }))}
          value={mapping?.action ?? 'SKIP'}
          onChange={(action) => onActionChange(index, action)}
          className={PANEL_SEGMENTED_WRAP}
        />

        {mapping?.action === 'MAP_EXISTING' && (
          <NativeSelect
            aria-label={t('sync.finary.mapExisting')}
            className={PANEL_SELECT}
            value={mapping.targetAccountId ?? ''}
            onChange={(e) => {
              const val = e.target.value
              if (val) onTargetChange(index, Number(val))
            }}
          >
            <option value="" disabled>{t('sync.finary.mapExisting')}…</option>
            {availableTargets(preview.existingPicsouAccounts, mappings, index).map((acc) => (
              <option key={acc.id} value={acc.id}>
                {modal
                  ? `${acc.name} (${acc.type})`
                  : `${acc.name} (${acc.type}) — ${money.amount(acc.currentBalance)}`}
              </option>
            ))}
          </NativeSelect>
        )}

        {mapping?.action === 'CREATE_NEW' && mapping.newAccount && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-name`}>{t('accounts.accountName')}</Label>
              <Input
                id={`${fieldId}-name`}
                className={PANEL_INPUT}
                value={mapping.newAccount.name}
                onChange={(e) => onNewAccountField(index, 'name', e.target.value)}
                placeholder={modal ? undefined : account.finaryName}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-type`}>{t('accounts.accountType')}</Label>
              <NativeSelect
                id={`${fieldId}-type`}
                className={PANEL_SELECT}
                value={mapping.newAccount.type}
                onChange={(e) => onNewAccountField(index, 'type', e.target.value)}
              >
                {/* The shared list, not a local copy: deriving a label key from the
                    type name only held while every key was the lowercased value, and
                    broke the moment a type needed its own (livretA, employeeSavings). */}
                {ACCOUNT_TYPES.map((at) => (
                  <option key={at.value} value={at.value}>{t(at.labelKey)}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-provider`}>{t('accounts.provider')}</Label>
              <Input
                id={`${fieldId}-provider`}
                className={PANEL_INPUT}
                value={mapping.newAccount.provider ?? ''}
                onChange={(e) => onNewAccountField(index, 'provider', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-currency`}>{t('import.field.currency')}</Label>
              <Input
                id={`${fieldId}-currency`}
                className={PANEL_INPUT}
                value={mapping.newAccount.currency}
                onChange={(e) => onNewAccountField(index, 'currency', e.target.value)}
                maxLength={3}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t('accounts.color')}</Label>
              <div className="flex flex-wrap gap-2">
                {ACCOUNT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    aria-pressed={mapping.newAccount?.color === color}
                    className={cn(
                      'size-8 rounded-full border-2 transition-[border-color,box-shadow]',
                      mapping.newAccount?.color === color
                        ? 'border-background ring-2 ring-foreground'
                        : 'border-transparent',
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => onNewAccountField(index, 'color', color)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="xs" className="pointer-coarse:h-10" onClick={onBack}>
          <ArrowLeft />
          {t('sync.finary.back')}
        </Button>
        <Button size="xs" className="pointer-coarse:h-10" onClick={onImport} disabled={loading || hasSkipAll}>
          {loading ? t('common.loading') : t('sync.finary.import')}
          <ArrowRight />
        </Button>
      </div>

      {modal ? (
        <div className="max-h-80 divide-y divide-border/60 overflow-y-auto">{rows}</div>
      ) : (
        <Card size="sm">
          <CardContent className="divide-y divide-border/60 py-0">{rows}</CardContent>
        </Card>
      )}
    </div>
  )
}

export function FinaryResultStep({
  result,
  onDone,
  variant,
}: {
  result: FinaryImportResultResponse
  onDone: () => void
  variant: FinaryVariant
}) {
  const { t } = useTranslation()
  const modal = variant === 'modal'

  const rows = result.importedAccounts.map((account) => (
    <div key={account.id} className="flex items-center gap-3 py-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: account.color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{account.name}</p>
        <p className="text-xs text-muted-foreground">{account.type}</p>
      </div>
      <CurrencyDisplay value={account.currentBalance} className="text-sm font-semibold text-foreground tabular-nums" />
    </div>
  ))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <PanelStat label={t('sync.finary.accountsCreated')} value={result.accountsCreated} />
        <PanelStat label={t('sync.finary.accountsMapped')} value={result.accountsMapped} />
        <PanelStat label={t('sync.finary.accountsSkipped')} value={result.accountsSkipped} />
        <PanelStat label={t('sync.finary.transactionsImported')} value={result.transactionsImported} />
      </div>

      {result.importedAccounts.length > 0 && (
        modal ? (
          <div className="divide-y divide-border/60">{rows}</div>
        ) : (
          <Card size="sm">
            <CardContent className="divide-y divide-border/60 py-0">{rows}</CardContent>
          </Card>
        )
      )}

      <PanelActions>
        <Button size="xs" className={PANEL_ACTION} onClick={onDone}>
          <CheckCircle2 />
          {t('sync.finary.done')}
        </Button>
      </PanelActions>
    </div>
  )
}
