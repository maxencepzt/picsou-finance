import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Copy, Check, Download } from 'lucide-react'

/**
 * Displays a fresh set of recovery codes once. Codes are unmasked, formatted
 * in a 2-column grid (responsive to single column on narrow screens), with
 * Copy-to-clipboard and Download-as-txt actions. The user must positively
 * confirm via {@code onSaved} before this view goes away — recovery codes
 * are shown ONCE and never recoverable.
 */
export function RecoveryCodesView({
  codes,
  onSaved,
  saveLabel,
}: {
  codes: string[]
  onSaved: () => void
  saveLabel: string
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([codes.join('\n') + '\n'], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'picsou-recovery-codes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-2">
        {codes.map(code => (
          <code
            key={code}
            className="rounded-md bg-background px-2 py-1.5 text-center font-mono text-sm tracking-wider text-foreground"
          >
            {code}
          </code>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="flex-1">
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? t('settings.mfaCopied') : t('settings.mfaCopy')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDownload} className="flex-1">
          <Download aria-hidden="true" />
          {t('settings.mfaDownload')}
        </Button>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="recovery-codes-saved"
          checked={acknowledged}
          onCheckedChange={v => setAcknowledged(v === true)}
          className="mt-0.5"
        />
        <Label htmlFor="recovery-codes-saved" className="cursor-pointer text-sm font-normal">
          {t('settings.mfaEnrollStep4Confirm')}
        </Label>
      </div>

      <Button type="button" disabled={!acknowledged} onClick={onSaved} className="w-full">
        {saveLabel}
      </Button>
    </div>
  )
}
