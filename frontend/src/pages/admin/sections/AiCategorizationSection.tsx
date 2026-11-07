import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { extractErrorMessage } from '@/lib/errors'
import { useUpdateAi, useTestAi } from '@/features/admin/hooks'
import type { AdminAiSettings } from '@/features/admin/api'
import { SettingRow, SettingsCard, StatusText } from '../components/SettingsBlocks'

const schema = z.object({
  provider: z.string().min(1),
  model: z.string(),
  baseUrl: z.string(),
  apiKey: z.string(),
  maxConcurrency: z.number().int().min(1).max(16).optional(),
})

type FormValues = z.infer<typeof schema>

const PROVIDER_OPTIONS: { value: string; labelKey?: string; label?: string }[] = [
  { value: 'none', labelKey: 'admin.ai.providerNone' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', labelKey: 'admin.ai.providerOpenAi' },
  { value: 'ollama', label: 'Ollama (local)' },
]

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-4-5' },
  openrouter: { baseUrl: 'https://openrouter.ai/api', model: 'anthropic/claude-3.5-haiku' },
  openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini' },
  ollama: { baseUrl: 'http://ollama:11434', model: 'qwen3:0.6b' },
}

export function AiCategorizationSection({ settings }: { settings: AdminAiSettings }) {
  const { t } = useTranslation()
  const update = useUpdateAi()
  const testAi = useTestAi()

  const { register, handleSubmit, reset, control, getValues, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.baseUrl,
      apiKey: '',
      maxConcurrency: settings.maxConcurrency ?? 4,
    },
  })

  useEffect(() => {
    reset({
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.baseUrl,
      apiKey: '',
      maxConcurrency: settings.maxConcurrency ?? 4,
    })
  }, [settings, reset])

  const provider = useWatch({ control, name: 'provider' })
  const defaults = PROVIDER_DEFAULTS[provider] ?? null
  const keyKept = settings.apiKeyPresent && provider === settings.provider

  const onSubmit = handleSubmit(async (values) => {
    const needsKey = values.provider !== 'none' && values.provider !== 'ollama'
    if (needsKey && !keyKept && !values.apiKey) {
      setError('apiKey', { type: 'manual', message: t('admin.ai.apiKeyRequired') })
      return
    }
    await update.mutateAsync({
      provider: values.provider,
      model: values.model,
      baseUrl: values.baseUrl,
      apiKey: values.apiKey,
      maxConcurrency: values.maxConcurrency,
    })
  })

  const handleTest = () => {
    const { provider, model, baseUrl, apiKey } = getValues()
    testAi.mutate({ provider, model, baseUrl, apiKey })
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsCard
        title={t('admin.ai.title')}
        description={t('admin.ai.description')}
        footer={
          <>
            {/* Test result and save outcome, left of the buttons */}
            <div className="flex min-w-0 flex-col gap-1 sm:mr-auto">
              {provider !== 'none' && testAi.data?.ok === true && (
                <StatusText tone="ok" className="whitespace-normal">{testAi.data.message}</StatusText>
              )}
              {provider !== 'none' && (testAi.isError || testAi.data?.ok === false) && (
                <p role="alert" className="text-[13px] text-destructive">
                  {testAi.data?.message ?? extractErrorMessage(testAi.error)}
                </p>
              )}
              {update.error && (
                <p role="alert" className="text-[13px] text-destructive">
                  {extractErrorMessage(update.error)}
                </p>
              )}
              {update.isSuccess && !formState.isDirty && <StatusText tone="ok">{t('admin.ai.saved')}</StatusText>}
            </div>
            {provider !== 'none' && (
              <Button type="button" variant="outline" size="xs" disabled={testAi.isPending} onClick={handleTest}>
                {testAi.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {testAi.isPending ? t('admin.ai.testing') : t('admin.ai.test')}
              </Button>
            )}
            <Button type="submit" size="xs" disabled={update.isPending}>
              {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {update.isPending ? t('admin.ai.saving') : t('admin.ai.save')}
            </Button>
          </>
        }
      >
        <SettingRow
          htmlFor="admin-ai-provider"
          label={t('admin.ai.provider')}
          description={provider === 'none' ? t('admin.ai.disabledHint') : undefined}
        >
          <NativeSelect id="admin-ai-provider" className="h-9" {...register('provider')}>
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.labelKey ? t(opt.labelKey) : opt.label}
              </option>
            ))}
          </NativeSelect>
        </SettingRow>

        {provider !== 'none' && (
          <>
            <SettingRow htmlFor="admin-ai-baseUrl" label={t('admin.ai.baseUrl')}>
              <Input
                id="admin-ai-baseUrl"
                placeholder={defaults?.baseUrl}
                spellCheck={false}
                className="h-9 font-mono text-[13px]"
                {...register('baseUrl')}
              />
            </SettingRow>

            <SettingRow htmlFor="admin-ai-model" label={t('admin.ai.model')}>
              <Input
                id="admin-ai-model"
                placeholder={defaults?.model}
                spellCheck={false}
                className="h-9 font-mono text-[13px]"
                {...register('model')}
              />
            </SettingRow>

            <SettingRow
              htmlFor="admin-ai-maxConcurrency"
              label={t('admin.ai.maxConcurrency')}
              description={t('admin.ai.maxConcurrencyHint')}
            >
              <Input
                id="admin-ai-maxConcurrency"
                type="number"
                min={1}
                max={16}
                className="h-9 tabular-nums"
                {...register('maxConcurrency', { valueAsNumber: true })}
              />
            </SettingRow>

            {/* API Key — hidden for Ollama */}
            {provider !== 'ollama' && (
              <SettingRow
                htmlFor="admin-ai-apiKey"
                label={t('admin.ai.apiKey')}
                description={keyKept ? t('admin.ai.apiKeyHintPresent') : undefined}
              >
                <Input
                  id="admin-ai-apiKey"
                  type="password"
                  autoComplete="off"
                  aria-invalid={!!formState.errors.apiKey}
                  placeholder={keyKept ? '••••••••' : undefined}
                  className="h-9"
                  {...register('apiKey')}
                />
                {formState.errors.apiKey && (
                  <p role="alert" className="mt-1.5 text-[13px] text-destructive">
                    {formState.errors.apiKey.message}
                  </p>
                )}
              </SettingRow>
            )}
          </>
        )}
      </SettingsCard>
    </form>
  )
}
