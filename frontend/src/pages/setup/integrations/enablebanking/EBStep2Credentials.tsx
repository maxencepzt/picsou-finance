import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { SetupNote } from '../../components/SetupCard'
import { EBSubstepShell } from './EBSubstepShell'
import {
  enableBankingConfigSchema,
  type EnableBankingConfigFormValues,
} from '@/features/setup/schemas'
import { useSetupFlowStore } from '@/stores/setup-flow-store'
import { useWriteEnableBankingConfig } from '@/features/setup/hooks'
import { formatApiError } from '@/lib/errors'

interface Props {
  onNext: () => void
  onBack: () => void
}

/**
 * Credentials step (Application ID only). Per Enable Banking's spec the JWT
 * `kid` is the application id itself, so we collect a single value and the
 * backend derives the Key ID from it. The redirect URI is shown to the user in
 * the previous substep so they can register it in their EB dashboard before
 * generating credentials; we read it back from the draft (or recompute from
 * window.location as a fallback) and ship the config to the backend here.
 */
export function EBStep2Credentials({ onNext, onBack }: Props) {
  const { t } = useTranslation()
  const draft = useSetupFlowStore((s) => s.ebDraft)
  const updateEbDraft = useSetupFlowStore((s) => s.updateEbDraft)
  const writeConfig = useWriteEnableBankingConfig()

  const [serverError, setServerError] = useState<string | null>(null)
  const [prodAcknowledged, setProdAcknowledged] = useState(false)

  const defaultRedirect =
    typeof window !== 'undefined' ? `${window.location.origin}/sync/callback` : ''

  const { register, handleSubmit, formState, setValue } = useForm<EnableBankingConfigFormValues>({
    resolver: zodResolver(enableBankingConfigSchema),
    defaultValues: {
      applicationId: draft.applicationId ?? '',
      redirectUri: draft.redirectUri || defaultRedirect,
    },
    mode: 'onBlur',
  })

  /**
   * Trim clipboard whitespace on paste — users copy the UUID from the EB
   * dashboard, which loves adding a trailing newline. Trimming here (instead
   * of in onChange) avoids eating legitimate typed characters.
   */
  const handlePasteApplicationId = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim()
    if (pasted) {
      e.preventDefault()
      setValue('applicationId', pasted, { shouldValidate: true })
    }
  }

  useEffect(() => {
    // Pre-populate draft with the autodiscovered redirect URI so the prior step
    // can pick it up without re-computing if the user navigated back.
    if (!draft.redirectUri && defaultRedirect) {
      updateEbDraft({ redirectUri: defaultRedirect })
    }
  }, [draft.redirectUri, defaultRedirect, updateEbDraft])

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    updateEbDraft({
      applicationId: values.applicationId.trim(),
      redirectUri: values.redirectUri,
    })
    try {
      await writeConfig.mutateAsync({
        applicationId: values.applicationId.trim(),
        redirectUri: values.redirectUri,
      })
      onNext()
    } catch (err) {
      setServerError(formatApiError(err, t))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <EBSubstepShell
        current={3}
        total={5}
        title={t('setup.enablebanking.creds.title')}
        description={t('setup.enablebanking.creds.body')}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={onBack} className="w-full sm:mr-auto sm:w-auto">
              {t('setup.enablebanking.back')}
            </Button>
            <Button
              type="submit"
              disabled={writeConfig.isPending || !formState.isValid || !prodAcknowledged}
              className="w-full sm:w-auto"
            >
              {writeConfig.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('setup.enablebanking.continue')}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="eb-app-id">{t('setup.enablebanking.creds.applicationId')}</Label>
          <Input
            id="eb-app-id"
            autoComplete="off"
            spellCheck={false}
            placeholder="00000000-0000-0000-0000-000000000000"
            aria-invalid={!!formState.errors.applicationId}
            aria-describedby="eb-app-id-hint"
            onPaste={handlePasteApplicationId}
            className="font-mono"
            {...register('applicationId')}
          />
          <p id="eb-app-id-hint" className={formState.errors.applicationId ? 'text-[13px] text-destructive' : 'text-[13px] text-muted-foreground'}>
            {formState.errors.applicationId
              ? t(formState.errors.applicationId.message ?? 'setup.enablebanking.appIdFormat')
              : t('setup.enablebanking.creds.applicationIdHint')}
          </p>
        </div>

        {/* Hidden redirectUri — validated but not user-editable here; the
            prior substep displays it for the user to register in EB. */}
        <input type="hidden" {...register('redirectUri')} />

        <div className="flex items-start gap-3 rounded-xl bg-warning/10 px-4 py-3">
          <Checkbox
            id="eb-prod-ack"
            checked={prodAcknowledged}
            onCheckedChange={(value) => setProdAcknowledged(value === true)}
            className="mt-0.5 bg-card"
          />
          <Label htmlFor="eb-prod-ack" className="cursor-pointer leading-5 font-normal">
            {t('setup.enablebanking.creds.prodAcknowledge')}
          </Label>
        </div>

        {serverError && (
          <SetupNote tone="error" role="alert">
            {serverError}
          </SetupNote>
        )}
      </EBSubstepShell>
    </form>
  )
}
