import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Plus, X } from 'lucide-react'
import { formatApiError } from '@/lib/errors'
import { setupSecuritySchema, type SetupSecurityFormValues } from '@/features/setup/schemas'
import { useSubmitSecurity } from '@/features/setup/hooks'
import { SetupCard, SetupNote } from './components/SetupCard'

/**
 * Step 2 — security. Pre-populated from the browser's current origin so
 * the typical user doesn't have to edit a thing. We derive
 * {@code secureCookies} from {@code location.protocol === 'https:'} — if
 * the wizard is loaded on http, cookies with the Secure flag silently
 * fail to round-trip, so defaulting to false there saves a debug session.
 */
export function SetupStepSecurity() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const submit = useSubmitSecurity()

  const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const defaultSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'

  const { register, handleSubmit, control, formState } = useForm<SetupSecurityFormValues>({
    resolver: zodResolver(setupSecuritySchema),
    defaultValues: {
      allowedOrigins: defaultOrigin ? [defaultOrigin] : [''],
      secureCookies: defaultSecure,
    },
    mode: 'onBlur',
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'allowedOrigins' as never,
  })
  const allowedOrigins = useWatch({ control, name: 'allowedOrigins' })

  const onSubmit = handleSubmit(async (values) => {
    await submit.mutateAsync({
      allowedOrigins: values.allowedOrigins.filter((o) => o.trim().length > 0),
      secureCookies: values.secureCookies,
    })
    navigate('/setup/integrations')
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <SetupCard
        title={t('setup.security.title')}
        description={t('setup.security.subtitle')}
        footer={
          <Button type="submit" disabled={submit.isPending} className="w-full sm:w-auto">
            {submit.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {submit.isPending ? t('setup.security.saving') : t('setup.security.cta')}
          </Button>
        }
      >
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{t('setup.security.originsLabel')}</legend>
          <p className="text-[13px] text-muted-foreground">{t('setup.security.originsHint')}</p>
          <div className="space-y-2">
            {fields.map((field, idx) => {
              const originError = formState.errors.allowedOrigins?.[idx]
              const originMessage = typeof originError?.message === 'string' ? originError.message : undefined
              const originHasInput = (allowedOrigins?.[idx] ?? '').trim().length > 0
              const showOriginError = (originHasInput || formState.submitCount > 0) && !!originMessage

              return (
                <div key={field.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="https://example.com"
                      aria-label={t('setup.security.originsLabel')}
                      aria-invalid={showOriginError}
                      aria-describedby={showOriginError ? `origin-error-${idx}` : undefined}
                      spellCheck={false}
                      {...register(`allowedOrigins.${idx}` as const)}
                    />
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(idx)}
                        aria-label={t('setup.security.originRemove')}
                        className="text-muted-foreground"
                      >
                        <X />
                      </Button>
                    )}
                  </div>
                  {showOriginError && (
                    <p id={`origin-error-${idx}`} className="text-[13px] text-destructive">
                      {t(originMessage)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          {typeof formState.errors.allowedOrigins?.message === 'string' && formState.submitCount > 0 && (
            <p className="text-[13px] text-destructive">
              {t(formState.errors.allowedOrigins.message)}
            </p>
          )}
          <Button type="button" variant="outline" size="xs" onClick={() => append('')}>
            <Plus />
            {t('setup.security.originAdd')}
          </Button>
        </fieldset>

        <div className="flex items-start justify-between gap-4 border-t border-border pt-5">
          <div className="space-y-1">
            <Label htmlFor="setup-secure-cookies">{t('setup.security.secureCookiesLabel')}</Label>
            <p className="text-[13px] text-muted-foreground">{t('setup.security.secureCookiesHint')}</p>
          </div>
          <Controller
            control={control}
            name="secureCookies"
            render={({ field }) => (
              <Switch
                id="setup-secure-cookies"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>

        {submit.error && (
          <SetupNote tone="error" role="alert">
            {formatApiError(submit.error, t, 'setup.security.submitError')}
          </SetupNote>
        )}
      </SetupCard>
    </form>
  )
}
