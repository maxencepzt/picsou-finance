import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useMemberProfile, useSaveMemberProfile } from '@/features/profile/hooks'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { DateInput } from '@/components/shared/DateInput'
import { NumericInput } from '@/components/shared/NumericInput'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, Loader2 } from 'lucide-react'
import { extractErrorMessage } from '@/lib/errors'
import { cn, formatPercent, getLocale, parseAmount } from '@/lib/utils'
import type {
  HouseholdStatus,
  MemberProfile,
  MemberProfileRequest,
  RiskProfile,
} from '@/types/api'

/**
 * The French marginal brackets, offered as choices rather than a free field.
 *
 * The column is numeric and permissive so a value set through the API survives a round trip —
 * this list is the shortcut for the ninety-nine percent of members it fits, not the schema.
 */
const TMI_BRACKETS = [0, 11, 30, 41, 45] as const
const HOUSEHOLD_STATUSES: HouseholdStatus[] = ['SINGLE', 'COUPLE']
const RISK_PROFILES: RiskProfile[] = ['PRUDENT', 'BALANCED', 'DYNAMIC', 'AGGRESSIVE']

/** An empty field means "not stated", which the backend stores as null. */
function numberOrNull(raw: string): number | null {
  if (raw.trim() === '') return null
  const parsed = parseAmount(raw)
  return Number.isFinite(parsed) ? parsed : null
}

/** Seeds a field in the member's own notation ("2,5" in French), ungrouped so it parses back. */
function text(value: number | null): string {
  return value == null
    ? ''
    : new Intl.NumberFormat(getLocale(), { useGrouping: false, maximumFractionDigits: 20 }).format(value)
}

/**
 * Mutually exclusive choices, the selected one clearable by clicking it again — the only way to
 * withdraw an answer once given.
 */
function ChoiceField<T extends string | number>({
  label,
  options,
  value,
  onChange,
  render,
  className,
}: {
  label: string
  options: readonly T[]
  value: T | null
  onChange: (next: T | null) => void
  render: (option: T) => string
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <p className="text-[13px] font-medium text-foreground">{label}</p>
      <SegmentedControl
        ariaLabel={label}
        className="max-w-full self-start overflow-x-auto"
        value={value == null ? '' : String(value)}
        onChange={(picked) => {
          const option = options.find((o) => String(o) === picked) ?? null
          onChange(option === value ? null : option)
        }}
        options={options.map((o) => ({ value: String(o), label: render(o) }))}
      />
    </div>
  )
}

/** A numeric field with its unit drawn inside the input, and an optional hint under it. */
function NumberField({
  id,
  label,
  unit,
  hint,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  unit?: string
  hint?: React.ReactNode
  value: string
  onChange: (next: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id} className="text-[13px]">{label}</Label>
      <div className="relative">
        <NumericInput
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn('h-9 px-3 tabular-nums', unit && 'pr-12')}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground" aria-hidden="true">
            {unit}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ProfileGroup({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="@container">
        <div className="grid gap-x-6 gap-y-5 @lg:grid-cols-2">{children}</div>
      </CardContent>
    </Card>
  )
}

/**
 * The form body, mounted only once the profile has loaded and keyed on it.
 *
 * Every field seeds from props through a lazy `useState` initializer rather than an effect,
 * which is what the React Compiler's `set-state-in-effect` rule requires and what
 * `AllocationTargetsModal` already does.
 */
function ProfileForm({
  profile,
  saving,
  saved,
  onSubmit,
}: {
  profile: MemberProfile
  saving: boolean
  /** The last save succeeded: shown until the member edits again. */
  saved: boolean
  onSubmit: (body: MemberProfileRequest) => void
}) {
  const { t } = useTranslation()

  const [birthDate, setBirthDate] = useState(() => profile.birthDate ?? '')
  const [marginalTaxRate, setMarginalTaxRate] = useState<number | null>(
    () => profile.marginalTaxRate,
  )
  const [householdStatus, setHouseholdStatus] = useState<HouseholdStatus | null>(
    () => profile.householdStatus,
  )
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(() => profile.riskProfile)
  const [parts, setParts] = useState(() => text(profile.taxHouseholdParts))
  const [dependents, setDependents] = useState(() => text(profile.dependents))
  const [annualGrossIncome, setAnnualGrossIncome] = useState(() => text(profile.annualGrossIncome))
  const [netBeforeTax, setNetBeforeTax] = useState(() => text(profile.monthlyNetBeforeTax))
  const [withholding, setWithholding] = useState(() => text(profile.withholdingTaxRate))
  const [savingsCapacity, setSavingsCapacity] = useState(
    () => text(profile.monthlySavingsCapacity),
  )
  const [retirementAge, setRetirementAge] = useState(() => text(profile.targetRetirementAge))

  const body: MemberProfileRequest = {
    birthDate: birthDate === '' ? null : birthDate,
    marginalTaxRate,
    householdStatus,
    taxHouseholdParts: numberOrNull(parts),
    dependents: numberOrNull(dependents),
    annualGrossIncome: numberOrNull(annualGrossIncome),
    monthlyNetBeforeTax: numberOrNull(netBeforeTax),
    withholdingTaxRate: numberOrNull(withholding),
    monthlySavingsCapacity: numberOrNull(savingsCapacity),
    targetRetirementAge: numberOrNull(retirementAge),
    riskProfile,
  }
  // What the fields held when the form mounted: the form is keyed on the profile, so this is
  // always the stored version, and any difference is an unsaved edit.
  const [initial] = useState(() => JSON.stringify(body))
  const dirty = JSON.stringify(body) !== initial
  const eur = t('settings.profile.unitEur')

  return (
    <form
      className="space-y-4"
      onSubmit={e => {
        e.preventDefault()
        onSubmit(body)
      }}
    >
      <p className="text-sm text-muted-foreground">{t('settings.profile.hint')}</p>

      <ProfileGroup title={t('settings.profile.groupHousehold')}>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="profile-birth-date" className="text-[13px]">{t('settings.profile.birthDate')}</Label>
          <DateInput id="profile-birth-date" value={birthDate} onChange={setBirthDate} className="h-9 px-3" />
          {/* Derived server-side from the stored date; an age typed in would be wrong the
              morning after a birthday. */}
          {profile.age != null && (
            <p className="text-xs text-muted-foreground">
              {t('settings.profile.currentAge', { age: profile.age })}
            </p>
          )}
        </div>
        <ChoiceField
          label={t('settings.profile.householdStatus')}
          options={HOUSEHOLD_STATUSES}
          value={householdStatus}
          onChange={setHouseholdStatus}
          render={status => t(`settings.profile.household.${status}`)}
        />
        <NumberField
          id="profile-dependents"
          label={t('settings.profile.dependents')}
          value={dependents}
          onChange={setDependents}
          placeholder="0"
        />
        <NumberField
          id="profile-parts"
          label={t('settings.profile.taxHouseholdParts')}
          value={parts}
          onChange={setParts}
          placeholder="1"
        />
        <ChoiceField
          className="@lg:col-span-2"
          label={t('settings.profile.marginalTaxRate')}
          options={TMI_BRACKETS}
          value={marginalTaxRate}
          onChange={setMarginalTaxRate}
          render={bracket => formatPercent(bracket, { fractionDigits: 0 })}
        />
      </ProfileGroup>

      <ProfileGroup title={t('settings.profile.groupIncome')}>
        <NumberField
          id="profile-income"
          label={t('settings.profile.annualGrossIncome')}
          unit={eur}
          hint={t('settings.profile.incomeHint')}
          value={annualGrossIncome}
          onChange={setAnnualGrossIncome}
          placeholder="45000"
        />
        <div className="space-y-1 @lg:col-span-2">
          {/* Why two fields rather than one: gross cannot reach net on its own -- social
              contributions come off first, at a rate that varies by status and that nobody
              knows offhand. Both figures below are printed on every French payslip. */}
          <p className="text-[13px] font-medium text-foreground">{t('settings.profile.netPay')}</p>
          <p className="text-xs text-muted-foreground">{t('settings.profile.netPayHint')}</p>
        </div>
        <NumberField
          id="profile-net-before-tax"
          label={t('settings.profile.monthlyNetBeforeTax')}
          unit={eur}
          value={netBeforeTax}
          onChange={setNetBeforeTax}
          placeholder="2750"
        />
        <NumberField
          id="profile-withholding"
          label={t('settings.profile.withholdingTaxRate')}
          unit="%"
          value={withholding}
          onChange={setWithholding}
          placeholder="7.3"
        />
        {/* The figure the savings rate divides by, shown so the chain is visible rather than
            implied. It is the value the *server* derived, so it only updates after a save --
            recomputing it here would be a second implementation of the same formula. */}
        {profile.monthlyNetIncome != null && (
          <p className="text-sm text-muted-foreground @lg:col-span-2">
            {t('settings.profile.netIncomeDerived')}{' '}
            <CurrencyDisplay value={profile.monthlyNetIncome} className="font-medium text-foreground" />
          </p>
        )}
      </ProfileGroup>

      <ProfileGroup title={t('settings.profile.groupPlan')}>
        <NumberField
          id="profile-savings"
          label={t('settings.profile.savingsCapacity')}
          unit={eur}
          value={savingsCapacity}
          onChange={setSavingsCapacity}
          placeholder="500"
        />
        <NumberField
          id="profile-retirement-age"
          label={t('settings.profile.retirementAge')}
          unit={t('settings.profile.unitYears')}
          value={retirementAge}
          onChange={setRetirementAge}
          placeholder="64"
        />
        <ChoiceField
          className="@lg:col-span-2"
          label={t('settings.profile.riskProfile')}
          options={RISK_PROFILES}
          value={riskProfile}
          onChange={setRiskProfile}
          render={risk => t(`settings.profile.risk.${risk}`)}
        />
      </ProfileGroup>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="text-[13px] text-muted-foreground" aria-live="polite">
          {saving ? (
            t('settings.profile.saving')
          ) : dirty ? (
            t('settings.profile.unsaved')
          ) : saved ? (
            <span className="inline-flex items-center gap-1.5 text-gain">
              <Check className="size-3.5" aria-hidden="true" />
              {t('settings.profile.saved')}
            </span>
          ) : null}
        </p>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}

export function ProfileSection() {
  const { data: profile, isLoading } = useMemberProfile()
  // Owned here rather than in the form: saving invalidates ['me','profile'], the refetch changes
  // the remount key, and TanStack Query drops the callbacks passed to a mutate() whose caller
  // has unmounted. Same reason as AllocationTargetsModal.
  const save = useSaveMemberProfile()

  if (isLoading || !profile) return <Skeleton className="h-64 w-full rounded-2xl" />

  return (
    <ProfileForm
      key={JSON.stringify(profile)}
      profile={profile}
      saving={save.isPending}
      saved={save.isSuccess}
      onSubmit={body =>
        save.mutate(body, {
          onError: error => toast.error(extractErrorMessage(error)),
        })
      }
    />
  )
}
