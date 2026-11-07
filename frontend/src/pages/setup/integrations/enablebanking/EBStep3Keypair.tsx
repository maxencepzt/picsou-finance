import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Download, KeyRound, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Label } from '@/components/ui/label'
import { formatApiError } from '@/lib/errors'
import { EBSubstepShell } from './EBSubstepShell'
import { useSetupFlowStore } from '@/stores/setup-flow-store'
import { SetupNote } from '../../components/SetupCard'
import type { EnableBankingKeyMode } from '@/stores/setup-flow-store'
import {
  useGenerateEnableBankingKeyPair,
  useImportEnableBankingPrivateKey,
} from '@/features/setup/hooks'

interface Props {
  onNext: () => void
  onBack: () => void
}

export function EBStep3Keypair({ onNext, onBack }: Props) {
  const { t } = useTranslation()
  const draft = useSetupFlowStore((s) => s.ebDraft)
  const updateEbDraft = useSetupFlowStore((s) => s.updateEbDraft)
  const generate = useGenerateEnableBankingKeyPair()
  const importKey = useImportEnableBankingPrivateKey()

  const [mode, setMode] = useState<EnableBankingKeyMode>(draft.keyPair?.mode ?? 'import')
  const [copied, setCopied] = useState(false)
  const [privatePem, setPrivatePem] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleGenerate = () => {
    generate.mutate(undefined, {
      onSuccess: (data) => updateEbDraft({ keyPair: { mode: 'generate', publicKeyPem: data.publicKeyPem } }),
    })
  }

  const pem = draft.keyPair?.mode === mode ? draft.keyPair.publicKeyPem : null
  const pending = generate.isPending || importKey.isPending

  const handleCopy = async () => {
    if (!pem) return
    try {
      await navigator.clipboard.writeText(pem)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      const pre = document.getElementById('eb-public-pem')
      if (pre) {
        const range = document.createRange()
        range.selectNode(pre)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }
  }

  const handleDownload = () => {
    if (!pem) return
    const blob = new Blob([pem], { type: 'application/x-pem-file' })
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
    reader.onload = () => {
      if (typeof reader.result === 'string') setPrivatePem(reader.result)
    }
    reader.onerror = () => setImportError(t('setup.enablebanking.keypair.importError'))
    reader.readAsText(file)
  }

  const handleImport = () => {
    if (!privatePem.trim()) return
    setImportError(null)
    importKey.mutate(
      { privatePem: privatePem.trim() },
      {
        onSuccess: (data) => {
          setPrivatePem('')
          if (fileInputRef.current) fileInputRef.current.value = ''
          updateEbDraft({ keyPair: { mode: 'import', publicKeyPem: data.publicKeyPem } })
        },
        onError: (err) => {
          setImportError(formatApiError(err, t, 'setup.enablebanking.keypair.importError'))
        },
      }
    )
  }

  const handleSwitchMode = (next: EnableBankingKeyMode) => {
    if (next === mode || pending) return
    setMode(next)
    setPrivatePem('')
    setImportError(null)
    generate.reset()
    importKey.reset()
    updateEbDraft({ keyPair: null })
  }

  const pemBlock = (
    <pre
      id="eb-public-pem"
      className="max-h-64 overflow-auto rounded-xl bg-muted p-4 font-mono text-xs leading-snug whitespace-pre-wrap break-all text-foreground"
    >
      {pem}
    </pre>
  )

  return (
    <EBSubstepShell
      current={4}
      total={5}
      title={t(mode === 'import' ? 'setup.enablebanking.keypair.importTitle' : 'setup.enablebanking.keypair.title')}
      description={t(mode === 'import' ? 'setup.enablebanking.keypair.importBody' : 'setup.enablebanking.keypair.body')}
      footer={
        <>
          <Button type="button" variant="ghost" disabled={pending} onClick={onBack} className="w-full sm:mr-auto sm:w-auto">
            {t('setup.enablebanking.back')}
          </Button>
          <Button onClick={onNext} disabled={!pem || pending} className="w-full sm:w-auto">
            {t(mode === 'import' ? 'setup.enablebanking.continue' : 'setup.enablebanking.keypair.uploadedCta')}
          </Button>
        </>
      }
    >
      {/* A disabled fieldset locks both segments while a request is in flight. */}
      <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
        <SegmentedControl
          fill
          ariaLabel={t('setup.enablebanking.keypair.title')}
          value={mode}
          onChange={handleSwitchMode}
          options={[
            { value: 'import', label: t('setup.enablebanking.keypair.modeImport') },
            { value: 'generate', label: t('setup.enablebanking.keypair.modeGenerate') },
          ]}
        />
      </fieldset>

      {mode === 'generate' && (
        <>
          {generate.isPending && !pem && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t('setup.enablebanking.keypair.generating')}
            </p>
          )}

          {!pem && !generate.isPending && (
            <Button className="w-full sm:w-auto" onClick={handleGenerate}>
              <KeyRound aria-hidden="true" />
              {t('setup.enablebanking.keypair.generateCta')}
            </Button>
          )}

          {generate.isError && !pem && (
            <SetupNote tone="error" role="alert">
              {formatApiError(generate.error, t, 'setup.enablebanking.keypair.error')}
            </SetupNote>
          )}

          {pem && (
            <>
              <p className="text-[13px] text-muted-foreground">{t('setup.enablebanking.keypair.uploadInstruction')}</p>
              {pemBlock}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" size="xs" onClick={handleCopy} className="w-full sm:w-auto">
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copied ? t('setup.enablebanking.keypair.copied') : t('setup.enablebanking.keypair.copy')}
                </Button>
                <Button type="button" variant="outline" size="xs" onClick={handleDownload} className="w-full sm:w-auto">
                  <Download aria-hidden="true" />
                  {t('setup.enablebanking.keypair.download')}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {mode === 'import' && (
        <>
          {!pem && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pem,application/x-pem-file,text/plain"
                aria-label={t('setup.enablebanking.keypair.chooseFile')}
                disabled={pending}
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload aria-hidden="true" />
                {t('setup.enablebanking.keypair.chooseFile')}
              </Button>

              <div className="space-y-2">
                <Label htmlFor="eb-private-pem">{t('setup.enablebanking.keypair.privateKeyLabel')}</Label>
                <p className="text-[13px] text-muted-foreground">{t('setup.enablebanking.keypair.orPaste')}</p>
                <textarea
                  id="eb-private-pem"
                  value={privatePem}
                  disabled={pending}
                  spellCheck={false}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrivatePem(e.target.value)}
                  placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
                  className="min-h-[140px] w-full resize-y rounded-md border border-input bg-input/20 px-4 py-3 font-mono text-xs leading-snug outline-none placeholder:text-muted-foreground/80 disabled:opacity-50 dark:bg-input/30"
                />
              </div>

              {importError && (
                <SetupNote tone="error" role="alert">{importError}</SetupNote>
              )}

              <Button
                className="w-full sm:w-auto"
                disabled={!privatePem.trim() || importKey.isPending}
                onClick={handleImport}
              >
                {importKey.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {importKey.isPending ? t('setup.enablebanking.keypair.importing') : t('setup.enablebanking.keypair.importCta')}
              </Button>
            </div>
          )}

          {pem && (
            <>
              <SetupNote tone="success">{t('setup.enablebanking.keypair.importSuccess')}</SetupNote>
              {pemBlock}
            </>
          )}
        </>
      )}
    </EBSubstepShell>
  )
}
