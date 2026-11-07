import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AccountForm } from '@/components/shared/AccountForm'
import { useAccounts, useUpdateAccount, useUpdateDebtMetadata } from '@/features/accounts/hooks'
import type { Account, AccountRequest, AccountType } from '@/types/api'

type AccountFormData = {
  name: string
  type: AccountType
  provider?: string
  currency: string
  currentBalance?: number
  isManual: boolean
  color: string
  ticker?: string
  logoKey?: string
  institutionId?: string
  borrowedAmount?: number
  interestRatePct?: number
  monthlyPayment?: number
  insuranceMonthly?: number
  fileFees?: number
  startDate?: string
  endDate?: string
  linkedAccountId?: number
  openedAt?: string
  depositCeiling?: number
}

/**
 * The edit form of one account, open while `account` is set: shared by the accounts list
 * (`?edit=<id>`) and the account detail page. Saves the account, then a loan's debt details.
 */
export function AccountEditDialog({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { data: accounts } = useAccounts()
  const updateAccount = useUpdateAccount()
  const updateDebt = useUpdateDebtMetadata()

  async function handleSubmit(data: AccountFormData) {
    if (!account) return
    const request: AccountRequest = {
      name: data.name,
      type: data.type,
      provider: data.provider || undefined,
      currency: data.currency,
      currentBalance: data.currentBalance,
      isManual: data.isManual,
      color: data.color,
      ticker: data.ticker || undefined,
      // Empty rather than absent for every account without a logo choice; the backend keeps
      // whatever it already stores when this is undefined.
      logoKey: data.logoKey || undefined,
      // Set only when a bank was picked from the catalog; the backend resolves its logo from it.
      institutionId: data.institutionId,
      // Undefined leaves the stored date alone, which is what an account type that never offers
      // the field should do -- see AccountRequest.
      openedAt: data.openedAt || undefined,
      // Same "undefined keeps it" rule; only a PEA offers the field.
      depositCeiling: data.type === 'PEA' ? data.depositCeiling : undefined,
    }
    await updateAccount.mutateAsync({ id: account.id, data: request })
    if (data.type === 'LOAN' && data.borrowedAmount && data.borrowedAmount > 0) {
      await updateDebt.mutateAsync({
        id: account.id,
        data: {
          borrowedAmount: data.borrowedAmount,
          interestRate: data.interestRatePct != null ? data.interestRatePct / 100 : undefined,
          monthlyPayment: data.monthlyPayment,
          insuranceMonthly: data.insuranceMonthly,
          fileFees: data.fileFees,
          lenderName: data.provider || undefined,
          startDate: data.startDate || undefined,
          endDate: data.endDate || undefined,
          // null, not undefined: an omitted key would leave a previously linked property
          // attached when the user picks "no linked asset".
          linkedAccountId: data.linkedAccountId ?? null,
        },
      })
    }
    onClose()
  }

  // Query structural sharing keeps the account object stable across refetches, so the form's
  // reset-on-defaultValues does not wipe what the user is typing.
  const defaultValues: Partial<AccountFormData> | undefined = useMemo(() => {
    if (!account) return undefined
    const debt = account.debt
    return {
      name: account.name,
      type: account.type,
      provider: (account.type === 'LOAN' ? debt?.lenderName : account.provider) ?? '',
      currency: account.currency,
      // The form asks for a card's amount owed; the backend stores it negative.
      currentBalance: account.type === 'CREDIT_CARD'
        ? Math.abs(account.currentBalance)
        : account.currentBalance,
      isManual: account.isManual,
      color: account.color,
      ticker: account.ticker ?? '',
      logoKey: account.logoKey ?? '',
      openedAt: account.openedAt ?? '',
      depositCeiling: account.depositCeiling ?? undefined,
      ...(debt
        ? {
            borrowedAmount: debt.borrowedAmount,
            interestRatePct: debt.interestRate != null ? debt.interestRate * 100 : undefined,
            monthlyPayment: debt.monthlyPayment ?? undefined,
            insuranceMonthly: debt.insuranceMonthly ?? undefined,
            fileFees: debt.fileFees ?? undefined,
            startDate: debt.startDate ?? '',
            endDate: debt.endDate ?? '',
            linkedAccountId: debt.linkedAccountId ?? undefined,
          }
        : {}),
    }
  }, [account])

  return (
    <AccountForm
      open={account != null}
      onOpenChange={(open) => { if (!open) onClose() }}
      onSubmit={handleSubmit}
      defaultValues={defaultValues}
      accounts={accounts}
      title={t('accounts.editAccount')}
      loading={updateAccount.isPending || updateDebt.isPending}
    />
  )
}
