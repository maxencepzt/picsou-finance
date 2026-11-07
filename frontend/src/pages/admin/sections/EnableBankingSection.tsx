import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  KeyRound,
  Loader2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { extractErrorMessage } from '@/lib/errors'
import {
  useGenerateEnableBankingKeyPair,
  useImportEnableBankingPrivateKey,
  useUpdateEnableBanking,
} from '@/features/admin/hooks'
import type { AdminEnableBankingSettings } from '@/features/admin/api'
import { SettingRow, SettingsCard, StatusText } from '../components/SettingsBlocks'

const schema = z.object({
  applicationId: z.string().min(1),
  redirectUri: z.string().url(),
})

type FormValues = z.infer<typeof schema>

export function EnableBankingSection({ settings }: { settings: AdminEnableBankingSettings }) {
  const { t } = useTranslation()
  const update = useUpdateEnableBanking()

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: settings,
  })

  useEffect(() => { reset(settings) }, [settings, reset])

  const onSubmit = handleSubmit(async (values) => {
    await update.mutateAsync(values)
  })

  const FIELDS: { name: keyof FormValues; labelKey: string; placeholder?: string; hintKey?: string }[] = [
    { name: 'applicationId', labelKey: 'admin.enableBanking.applicationId', hintKey: 'admin.enableBanking.applicationIdHint' },
    { name: 'redirectUri', labelKey: 'admin.enableBanking.redirectUri', placeholder: 'https://app.com/sync/callback' },
  ]

  // Which of the required pieces are missing — computed from the persisted
  // settings, not the dirty form, so the banner reflects the server's truth.
  // The Key ID isn't listed: it's derived from the Application ID server-side.
  const missing: string[] = []
  if (!settings.applicationId) missing.push(t('admin.enableBanking.applicationId'))
  if (!settings.redirectUri) missing.push(t('admin.enableBanking.redirectUri'))
  if (!settings.privateKeyPresent) missing.push(t('admin.enableBanking.privateKey'))

  return (
    <>
      <form onSubmit={onSubmit} noValidate>
        <SettingsCard
          title={t('admin.enableBanking.title')}
          description={t('admin.enableBanking.description')}
          action={
            missing.length === 0
              ? <StatusText tone="ok">{t('admin.enableBanking.statusReady')}</StatusText>
              : <StatusText tone="warn">{t('admin.enableBanking.statusIncomplete')}</StatusText>
          }
          footer={
            <>
              {update.error && (
                <p role="alert" className="text-[13px] text-destructive sm:mr-auto">
                  {extractErrorMessage(update.error)}
                </p>
              )}
              {update.isSuccess && !formState.isDirty && <StatusText tone="ok">{t('admin.enableBanking.saved')}</StatusText>}
              <Button type="submit" size="xs" disabled={update.isPending || !formState.isDirty}>
                {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {update.isPending ? t('admin.enableBanking.saving') : t('admin.enableBanking.save')}
              </Button>
            </>
          }
        >
          {/* Readiness — names every missing piece, not just the key. */}
          {missing.length > 0 && (
            <div className="py-4">
              <div role="alert" className="flex items-start gap-3 rounded-xl bg-warning/10 px-4 py-3 text-[13px] leading-5 text-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <span>{t('admin.enableBanking.incomplete', { fields: missing.join(', ') })}</span>
              </div>
            </div>
          )}

          {FIELDS.map(({ name, labelKey, placeholder, hintKey }) => (
            <SettingRow
              key={name}
              htmlFor={`admin-eb-${name}`}
              label={t(labelKey)}
              description={hintKey ? t(hintKey) : undefined}
            >
              <Input
                id={`admin-eb-${name}`}
                placeholder={placeholder}
                spellCheck={false}
                aria-invalid={!!formState.errors[name]}
                className="h-9 font-mono text-[13px]"
                {...register(name)}
              />
              {formState.errors[name] && (
                <p className="mt-1.5 text-[13px] text-destructive">{formState.errors[name]?.message}</p>
              )}
            </SettingRow>
          ))}
        </SettingsCard>
      </form>

      <KeypairPanel privateKeyPresent={settings.privateKeyPresent} />
    </>
  )
}

type Mode = 'generate' | 'import'

/**
 * Self-contained private-key manager for the admin page. Mirrors the setup
 * wizard's EBStep3Keypair (generate → show/copy/download public PEM, or import
 * a .pem) but talks to the admin endpoints, which — unlike the wizard's — are
 * not gated by "setup not complete", so an operator can recover a lost key
 * after first-run. Generating is idempotent and never invalidates a public key
 * already uploaded to the Enable Banking dashboard.
 */
function KeypairPanel({ privateKeyPresent }: { privateKeyPresent: boolean }) {
  const { t } = useTranslation()
  const generate = useGenerateEnableBankingKeyPair()
  const importKey = useImportEnableBankingPrivateKey()

  const [mode, setMode] = useState<Mode>('generate')
  const [publicPem, setPublicPem] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [privatePem, setPrivatePem] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleGenerate = () => {
    generate.mutate(undefined, { onSuccess: (data) => setPublicPem(data.publicKeyPem) })
  }

  const handleCopy = async () => {
    if (!publicPem) return
    try {
      await navigator.clipboard.writeText(publicPem)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — the PEM is visible for manual copy */
    }
  }

  const handleDownload = () => {
    if (!publicPem) return
    const blob = new Blob([publicPem], { type: 'application/x-pem-file' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'picsou-enablebanking-public.pem'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setPrivatePem((ev.target?.result as string) ?? '')
    reader.readAsText(file)
  }

  const handleImport = () => {
    if (!privatePem.trim()) return
    setImportError(null)
    importKey.mutate(privatePem.trim(), {
      onSuccess: (data) => { setPublicPem(data.publicKeyPem); setPrivatePem('') },
      onError: (err) => setImportError(extractErrorMessage(err) || t('admin.enableBanking.keypair.importError')),
    })
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setPrivatePem('')
    setImportError(null)
    setPublicPem(null)
  }

  return (
    <SettingsCard
      title={t('admin.enableBanking.keypair.title')}
      description={privateKeyPresent
        ? t('admin.enableBanking.keypair.statusPresent')
        : t('admin.enableBanking.keypair.statusMissing')}
      action={
        privateKeyPresent
          ? <StatusText tone="ok">{t('admin.enableBanking.keypair.present')}</StatusText>
          : <StatusText tone="warn">{t('admin.enableBanking.keypair.missing')}</StatusText>
      }
    >
      <div className="space-y-4 py-4">
        <SegmentedControl
          fill
          className="sm:w-auto"
          ariaLabel={t('admin.enableBanking.keypair.title')}
          value={mode}
          onChange={switchMode}
          options={[
            { value: 'generate', label: t('admin.enableBanking.keypair.modeGenerate') },
            { value: 'import', label: t('admin.enableBanking.keypair.modeImport') },
          ]}
        />

        {mode === 'generate' && !publicPem && (
          <div className="space-y-3">
            <p className="text-[13px] leading-5 text-muted-foreground">{t('admin.enableBanking.keypair.body')}</p>
            {generate.isError && (
              <p role="alert" className="text-[13px] text-destructive">{extractErrorMessage(generate.error)}</p>
            )}
            <Button type="button" size="xs" variant="outline" onClick={handleGenerate} disabled={generate.isPending} className="w-full sm:w-auto">
              {generate.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
              {generate.isPending
                ? t('admin.enableBanking.keypair.generating')
                : privateKeyPresent
                  ? t('admin.enableBanking.keypair.regenerate')
                  : t('admin.enableBanking.keypair.generate')}
            </Button>
          </div>
        )}

        {mode === 'import' && !publicPem && (
          <div className="space-y-3">
            <p className="text-[13px] leading-5 text-muted-foreground">{t('admin.enableBanking.keypair.importBody')}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pem,application/x-pem-file,text/plain"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button type="button" variant="outline" size="xs" className="w-full sm:w-auto" onClick={() => fileInputRef.current?.click()}>
              <Upload aria-hidden="true" />
              {t('admin.enableBanking.keypair.chooseFile')}
            </Button>
            <p className="text-[13px] text-muted-foreground">{t('admin.enableBanking.keypair.orPaste')}</p>
            <textarea
              value={privatePem}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrivatePem(e.target.value)}
              aria-label={t('admin.enableBanking.keypair.title')}
              spellCheck={false}
              placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
              className="min-h-[140px] w-full resize-y rounded-md border border-input bg-input/20 px-4 py-3 font-mono text-xs leading-snug outline-none placeholder:text-muted-foreground/80 dark:bg-input/30"
            />
            {importError && <p role="alert" className="text-[13px] text-destructive">{importError}</p>}
            <Button
              type="button"
              size="xs"
              className="w-full sm:w-auto"
              disabled={!privatePem.trim() || importKey.isPending}
              onClick={handleImport}
            >
              {importKey.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {importKey.isPending ? t('admin.enableBanking.keypair.importing') : t('admin.enableBanking.keypair.importCta')}
            </Button>
          </div>
        )}

        {/* Public PEM result (shared by both modes) */}
        {publicPem && (
          <div className="space-y-3">
            <p className="text-[13px] leading-5 text-muted-foreground">{t('admin.enableBanking.keypair.uploadInstruction')}</p>
            <pre className="max-h-64 overflow-auto rounded-xl bg-muted p-4 font-mono text-xs leading-snug whitespace-pre-wrap break-all text-foreground">
              {publicPem}
            </pre>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" size="xs" onClick={handleCopy} className="w-full sm:w-auto">
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? t('admin.enableBanking.keypair.copied') : t('admin.enableBanking.keypair.copy')}
              </Button>
              <Button type="button" variant="outline" size="xs" onClick={handleDownload} className="w-full sm:w-auto">
                <Download aria-hidden="true" />
                {t('admin.enableBanking.keypair.download')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </SettingsCard>
  )
}
