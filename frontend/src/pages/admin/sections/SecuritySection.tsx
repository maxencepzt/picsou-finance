import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Loader2, Plus, X, RotateCw } from 'lucide-react'
import { extractErrorMessage } from '@/lib/errors'
import { useUpdateSecurity, useReloadCorsFromEnv } from '@/features/admin/hooks'
import type { AdminSecuritySettings } from '@/features/admin/api'
import { SettingRow, SettingsCard, StatusText } from '../components/SettingsBlocks'

const schema = z.object({
  allowedOrigins: z.array(z.string().min(1)).min(1),
  secureCookies: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function SecuritySection({ settings }: { settings: AdminSecuritySettings }) {
  const { t } = useTranslation()
  const update = useUpdateSecurity()
  const reloadCors = useReloadCorsFromEnv()

  const { register, handleSubmit, control, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: settings,
  })

  useEffect(() => { reset(settings) }, [settings, reset])

  const { fields, append, remove } = useFieldArray({ control, name: 'allowedOrigins' as never })

  const onSubmit = handleSubmit(async (values) => {
    await update.mutateAsync({
      allowedOrigins: values.allowedOrigins.filter((o) => o.trim().length > 0),
      secureCookies: values.secureCookies,
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsCard
        title={t('admin.security.title')}
        description={t('admin.security.description')}
        footer={
          <>
            {update.error && (
              <p role="alert" className="text-[13px] text-destructive sm:mr-auto">
                {extractErrorMessage(update.error)}
              </p>
            )}
            {update.isSuccess && !formState.isDirty && <StatusText tone="ok">{t('admin.security.saved')}</StatusText>}
            <Button type="submit" size="xs" disabled={update.isPending || !formState.isDirty}>
              {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {update.isPending ? t('admin.security.saving') : t('admin.security.save')}
            </Button>
          </>
        }
      >
        <SettingRow stacked label={t('admin.security.originsLabel')} description={t('admin.security.originsHint')}>
          <div className="space-y-2">
            {fields.map((field, idx) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  placeholder="https://example.com"
                  aria-label={t('admin.security.originsLabel')}
                  spellCheck={false}
                  className="h-9 font-mono text-[13px]"
                  {...register(`allowedOrigins.${idx}` as const)}
                />
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(idx)}
                    aria-label={t('admin.security.originRemove')} className="text-muted-foreground">
                    <X aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="xs" onClick={() => append('')}>
              <Plus aria-hidden="true" />
              {t('admin.security.originAdd')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => reloadCors.mutate()}
              disabled={reloadCors.isPending}
              title={t('admin.security.reloadFromEnvHint')}
            >
              <RotateCw className={reloadCors.isPending ? 'animate-spin' : undefined} aria-hidden="true" />
              {reloadCors.isPending
                ? t('admin.security.reloadFromEnvLoading')
                : t('admin.security.reloadFromEnv')}
            </Button>
          </div>
          {reloadCors.error && (
            <p role="alert" className="mt-2 text-[13px] text-destructive">
              {extractErrorMessage(reloadCors.error)}
            </p>
          )}
          {reloadCors.isSuccess && (
            <StatusText tone="ok" className="mt-2 whitespace-normal">{t('admin.security.reloadFromEnvDone')}</StatusText>
          )}
        </SettingRow>

        <SettingRow
          toggle
          htmlFor="admin-secure-cookies"
          label={t('admin.security.secureCookiesLabel')}
          description={t('admin.security.secureCookiesHint')}
        >
          <Controller control={control} name="secureCookies"
            render={({ field }) => (
              <Switch id="admin-secure-cookies" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </SettingRow>
      </SettingsCard>
    </form>
  )
}
