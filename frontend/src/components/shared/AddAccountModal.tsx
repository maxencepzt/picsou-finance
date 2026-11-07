import { useMemo, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  BackButton,
  BankWizard,
  ExchangeWizard,
  FinaryWizard,
  RevolutWizard,
  TradeRepublicWizard,
  WalletWizard,
} from '@/components/shared/AddAccountWizards'
import { AccountForm } from '@/components/shared/AccountForm'
import { AddPropertyModal } from '@/components/property/AddPropertyModal'
import { BourseDirectPanel } from '@/components/sync/BourseDirectPanel'
import { BoursoPanel } from '@/components/sync/BoursoPanel'
import { CaisseEpargnePanel } from '@/components/sync/CaisseEpargnePanel'
import { BanquePopulairePanel } from '@/components/sync/BanquePopulairePanel'
import { DegiroPanel } from '@/components/sync/DegiroPanel'
import { AmundiPanel } from '@/components/sync/AmundiPanel'
import { FortuneoPanel } from '@/components/sync/FortuneoPanel'
import { AmexPanel } from '@/components/sync/AmexPanel'
import { CorumPanel } from '@/components/sync/CorumPanel'
import { SofidyPanel } from '@/components/sync/SofidyPanel'
import { IbkrPanel } from '@/components/sync/IbkrPanel'
import { SimplefinPanel } from '@/components/sync/SimplefinPanel'
import { WisePanel } from '@/components/sync/WisePanel'
import { CmesPanel } from '@/components/sync/CmesPanel'
import { CicPanel } from '@/components/sync/CicPanel'
import { catalogEntry } from '@/pages/sync/catalog'
import { ProviderCatalog } from '@/pages/sync/ProviderCatalog'
import { ProviderMark } from '@/components/shared/ProviderMark'
import { useCreateAccount, useUpdateDebtMetadata } from '@/features/accounts/hooks'
import { HousePlus, PenLine, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Account, AccountRequest, AccountType } from '@/types/api'

// ---------------------------------------------------------------------------
// Props & steps
// ---------------------------------------------------------------------------

interface AddAccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Skip the source picker and open the manual form with this type preselected. */
  defaultType?: AccountType
  /** Called with the created account, so the caller can land on its detail page. */
  onCreated?: (account: Account) => void
}

/** `selector`, or the catalog key (the /sync `?tab=` key) of the provider being connected. */
type WizardStep = string

type Wizard = ComponentType<{ onDone: () => void; onBack: () => void }>

// Providers with a guided flow of their own (OAuth redirect, forms, a mapping step).
const WIZARD_STEPS: Record<string, Wizard> = {
  banks: BankWizard,
  exchanges: ExchangeWizard,
  wallets: WalletWizard,
  tr: TradeRepublicWizard,
  revolut: RevolutWizard,
  finary: FinaryWizard,
}

// Steps that are nothing but a sync Panel behind a Back button.
const PANEL_STEPS: Record<string, ComponentType<{ onConnected?: () => void }>> = {
  bourso: BoursoPanel,
  'caisse-epargne': CaisseEpargnePanel,
  'banque-populaire': BanquePopulairePanel,
  'bourse-direct': BourseDirectPanel,
  degiro: DegiroPanel,
  ibkr: IbkrPanel,
  simplefin: SimplefinPanel,
  wise: WisePanel,
  amundi: AmundiPanel,
  cmes: CmesPanel,
  cic: CicPanel,
  fortuneo: FortuneoPanel,
  amex: AmexPanel,
  corum: CorumPanel,
  sofidy: SofidyPanel,
}

/** One of the two hand-entered choices that open the dialog, ahead of the catalog. */
function ManualChoice({ icon: Icon, label, description, primary, onClick }: {
  icon: LucideIcon
  label: string
  description: string
  primary?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition-colors',
        primary ? 'ring-primary/40 hover:bg-primary/8' : 'ring-foreground/10 hover:bg-muted/60',
      )}
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', primary ? 'bg-primary/12 text-primary' : 'bg-muted text-foreground')}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AddAccountModal({ open, onOpenChange, defaultType, onCreated }: AddAccountModalProps) {
  const { t } = useTranslation()
  const createAccount = useCreateAccount()
  const updateDebt = useUpdateDebtMetadata()
  const [step, setStep] = useState<WizardStep>('selector')
  const manualDefaults = useMemo(
    () => (defaultType ? { type: defaultType } : undefined),
    [defaultType],
  )

  const [showManualForm, setShowManualForm] = useState(false)
  const [showPropertyForm, setShowPropertyForm] = useState(false)
  const navigate = useNavigate()
  const entry = catalogEntry(step)
  const Wizard = WIZARD_STEPS[step]
  const Panel = PANEL_STEPS[step]

  // "Create a loan" from the Receivables tab skips the source picker: the manual form is
  // the only route, and it is open as soon as the caller supplies the type.
  const manualOpen = showManualForm || (open && Boolean(defaultType))

  function handleSourceClick(key: string) {
    if (key === 'manual') {
      onOpenChange(false)
      setShowManualForm(true)
      return
    }
    if (key === 'property') {
      // Its own guided flow rather than a step here: it creates the account, saves the
      // description and runs the first estimate in one pass.
      onOpenChange(false)
      setShowPropertyForm(true)
      return
    }
    if (!WIZARD_STEPS[key] && !PANEL_STEPS[key]) {
      // A whole-budget file import (Actual, HomeBank) maps accounts and categories over a
      // page-sized preview: it runs on its Sync-page view, not in this dialog.
      onOpenChange(false)
      navigate(`/sync?tab=${key}`)
      return
    }
    setStep(key)
  }

  function handleDialogChange(open: boolean) {
    if (open) {
      setStep('selector')
    }
    onOpenChange(open)
  }

  function handleDone() {
    setStep('selector')
    onOpenChange(false)
  }

  async function handleManualSubmit(data: {
    name: string
    type: AccountType
    provider?: string
    currency: string
    currentBalance?: number
    isManual: boolean
    color: string
    ticker?: string
    institutionId?: string
    borrowedAmount?: number
    interestRatePct?: number
    monthlyPayment?: number
    insuranceMonthly?: number
    fileFees?: number
    startDate?: string
    endDate?: string
    openedAt?: string
    depositCeiling?: number
  }) {
    const request: AccountRequest = {
      name: data.name,
      type: data.type,
      provider: data.provider || undefined,
      currency: data.currency,
      currentBalance: data.currentBalance,
      isManual: true,
      color: data.color,
      ticker: data.ticker || undefined,
      // Set only when a bank was picked from the catalog; the backend resolves its logo from it.
      institutionId: data.institutionId,
      openedAt: data.openedAt || undefined,
      depositCeiling: data.type === 'PEA' ? data.depositCeiling : undefined,
    }
    const created = await createAccount.mutateAsync(request)

    if (data.type === 'LOAN' && data.borrowedAmount && data.borrowedAmount > 0) {
      await updateDebt.mutateAsync({
        id: created.id,
        data: {
          borrowedAmount: data.borrowedAmount,
          interestRate: data.interestRatePct != null ? data.interestRatePct / 100 : undefined,
          monthlyPayment: data.monthlyPayment,
          insuranceMonthly: data.insuranceMonthly,
          fileFees: data.fileFees,
          lenderName: data.provider,
          startDate: data.startDate || undefined,
          endDate: data.endDate || undefined,
        },
      })
    }

    setShowManualForm(false)
    if (defaultType) onOpenChange(false)
    onCreated?.(created)
  }

  return (
    <>
      <Dialog open={open && !defaultType} onOpenChange={handleDialogChange}>
        {/* sm:max-w-xl, not just max-w-xl: DialogContent's own `sm:max-w-sm` is a different
            Tailwind variant, so tailwind-merge keeps it and an unprefixed max-w-xl silently has
            no effect above 640px — which is what squeezed this wizard into 24rem. */}
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              {entry && <ProviderMark size="sm" name={t(entry.labelKey)} logo={entry.logo} icon={entry.icon} />}
              {entry ? t(entry.labelKey) : t('addAccount.title')}
            </DialogTitle>
            <DialogDescription className={entry ? 'sr-only' : undefined}>
              {entry ? t(entry.descKey) : t('addAccount.subtitle')}
            </DialogDescription>
          </DialogHeader>

          {step === 'selector' && (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <ManualChoice
                  primary
                  icon={PenLine}
                  label={t('addAccount.manual')}
                  description={t('addAccount.desc.manual')}
                  onClick={() => handleSourceClick('manual')}
                />
                <ManualChoice
                  icon={HousePlus}
                  label={t('property.add.source')}
                  description={t('addAccount.desc.property')}
                  onClick={() => handleSourceClick('property')}
                />
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                <span className="h-px flex-1 bg-border" aria-hidden />
                {t('addAccount.connectHeading')}
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>
              <ProviderCatalog onSelect={(p) => handleSourceClick(p.key)} />
            </div>
          )}

          {Wizard && <Wizard onDone={handleDone} onBack={() => setStep('selector')} />}
          {Panel && (
            <>
              <BackButton onClick={() => setStep('selector')} />
              <Panel onConnected={handleDone} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {showPropertyForm && (
        <AddPropertyModal open onOpenChange={setShowPropertyForm} />
      )}

      <AccountForm
        open={manualOpen}
        onOpenChange={(next) => {
          setShowManualForm(next)
          if (!next && defaultType) onOpenChange(false)
        }}
        onSubmit={handleManualSubmit}
        defaultValues={manualDefaults}
        title={t('addAccount.manual')}
        loading={createAccount.isPending}
      />
    </>
  )
}
