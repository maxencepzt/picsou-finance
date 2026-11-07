import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { useMfaEnrollInit, useMfaEnrollVerify } from '@/features/mfa/hooks'
import { RecoveryCodesView } from './RecoveryCodesView'
import { formatApiError, safeBackendMessage, getErrorStatus } from '@/lib/errors'

type Step = 1 | 2 | 3 | 4

export function MfaEnrollDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const enrollInit = useMfaEnrollInit()
  const enrollVerify = useMfaEnrollVerify()

  const [step, setStep] = useState<Step>(1)
  const [currentPassword, setCurrentPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [qrUri, setQrUri] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])

  const reset = () => {
    setStep(1)
    setCurrentPassword('')
    setCode('')
    setError(null)
    setQrUri(null)
    setSecret(null)
    setRecoveryCodes([])
    enrollInit.reset()
    enrollVerify.reset()
  }

  const close = () => {
    onOpenChange(false)
    // Wait for the dialog close animation before clearing state — otherwise
    // the user briefly sees step 1 reappear during the fade-out.
    setTimeout(reset, 250)
  }

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const data = await enrollInit.mutateAsync({ currentPassword })
      setQrUri(data.qrCodeDataUri)
      setSecret(data.secret)
      setStep(2)
    } catch (err: unknown) {
      const status = getErrorStatus(err)
      if (status === 400) setError(safeBackendMessage(err) ?? t('auth.error'))
      else if (status === 429) setError(t('auth.mfaTooManyAttempts'))
      else setError(formatApiError(err, t))
    }
  }

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const data = await enrollVerify.mutateAsync({ code })
      setRecoveryCodes(data.recoveryCodes)
      setStep(4)
    } catch (err: unknown) {
      const status = getErrorStatus(err)
      if (status === 400) setError(t('auth.mfaInvalidCode'))
      else setError(formatApiError(err, t))
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => (v ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && t('settings.mfaEnrollStep1Title')}
            {step === 2 && t('settings.mfaEnrollStep2Title')}
            {step === 3 && t('settings.mfaEnrollStep3Title')}
            {step === 4 && t('settings.mfaEnrollStep4Title')}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && t('settings.mfaEnrollStep1Desc')}
            {step === 2 && t('settings.mfaEnrollStep2Desc')}
            {step === 3 && t('settings.mfaEnrollStep3Desc')}
            {step === 4 && t('settings.mfaEnrollStep4Desc')}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="enroll-pw">{t('settings.currentPassword')}</Label>
              <Input
                id="enroll-pw"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
                autoFocus
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                {t('settings.mfaCancel')}
              </Button>
              <Button type="submit" disabled={enrollInit.isPending}>
                {enrollInit.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {t('settings.mfaContinue')}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 2 && qrUri && secret && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <img
                src={qrUri}
                alt="2FA QR code"
                className="size-48 rounded-xl bg-white p-2 sm:size-56"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{t('settings.mfaEnrollSecretManual')}</p>
              <code className="block w-full break-all rounded-lg bg-muted p-2 text-center font-mono text-xs text-foreground sm:text-sm">
                {secret}
              </code>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                {t('settings.mfaCancel')}
              </Button>
              <Button type="button" onClick={() => setStep(3)}>
                {t('settings.mfaNext')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleStep3} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="enroll-code">{t('auth.mfaCodeLabel')}</Label>
              <Input
                id="enroll-code"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value)}
                autoComplete="one-time-code"
                autoFocus
                required
                placeholder="123456"
                className="text-center text-lg tracking-widest font-mono"
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                {t('settings.mfaPrevious')}
              </Button>
              <Button type="submit" disabled={enrollVerify.isPending || code.length !== 6}>
                {enrollVerify.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {t('settings.mfaConfirm')}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 4 && (
          <RecoveryCodesView
            codes={recoveryCodes}
            saveLabel={t('settings.mfaDone')}
            onSaved={close}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
