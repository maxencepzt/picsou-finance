import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ArrowRight, Bitcoin, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Confetti } from './components/Confetti'
import { IntegrationMark } from './components/IntegrationMark'
import { SetupCard, SetupNote } from './components/SetupCard'
import { useCompleteSetup, useSetupStatus } from '@/features/setup/hooks'
import { useSetupFlowStore, type IntegrationKey } from '@/stores/setup-flow-store'
import { consumeSetupCredentials } from '@/stores/setup-credentials'
import { authApi } from '@/features/auth/api'
import { useAuthStore } from '@/stores/auth-store'
import { useAppStore } from '@/stores/app-store'
import { SidebarStylePromptModal } from '@/components/layout/SidebarStylePromptModal'

type AutoLoginState = 'idle' | 'attempting' | 'success' | 'failed'

/**
 * Final screen. On mount:
 *   1. POST /api/setup/complete to flip setup.state to COMPLETE
 *   2. Immediately attempt auto-login with the in-memory credentials
 *      stashed by SetupStepAdmin (cleared here — one-shot consumption)
 *   3. Show the confetti + "Open my dashboard" CTA
 *
 * Auto-login is best-effort: if credentials were cleared by a refresh or
 * the /login call itself rejects, the CTA falls back to routing the user
 * to /login manually. setup.state is COMPLETE either way, so the app
 * behaves normally from here.
 */
export function SetupStepComplete() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const complete = useCompleteSetup()
  const status = useSetupStatus()
  const { refetch: refetchStatus } = status
  const loginIntoStore = useAuthStore((s) => s.login)

  const displayName = useSetupFlowStore((s) => s.adminDisplayName)
  const completed = useSetupFlowStore((s) => s.completedIntegrations)
  const resetFlow = useSetupFlowStore((s) => s.reset)

  const [autoLogin, setAutoLogin] = useState<AutoLoginState>('idle')
  const ranOnce = useRef(false)

  const hasSeenSidebarStylePrompt = useAppStore((s) => s.hasSeenSidebarStylePrompt)
  const [showSidebarStylePrompt, setShowSidebarStylePrompt] = useState(!hasSeenSidebarStylePrompt)

  useEffect(() => {
    if (ranOnce.current) return
    ranOnce.current = true

    const run = async () => {
      try {
        await complete.mutateAsync()
      } catch (err) {
        // If /complete failed because setup was already complete (410), the
        // user probably finished in another tab — proceed to auto-login
        // anyway. Any other failure is surfaced as an inline error below.
        const statusCode = (err as { response?: { status?: number } })?.response?.status
        if (statusCode !== 410) {
          setAutoLogin('failed')
          return
        }
      }

      const creds = consumeSetupCredentials()
      if (!creds) {
        setAutoLogin('failed')
        return
      }

      setAutoLogin('attempting')
      try {
        const user = await authApi.login(creds.username, creds.password)
        loginIntoStore(user)
        // Make sure RequireSetup sees fresh status on dashboard nav.
        await refetchStatus()
        setAutoLogin('success')
      } catch {
        setAutoLogin('failed')
      }
    }

    void run()
  }, [complete, loginIntoStore, refetchStatus])

  /**
   * On leaving this screen we clear the in-memory wizard state so a second
   * visit to /setup (e.g. an admin wiping the DB and re-running setup)
   * starts from a blank slate, not a half-filled session.
   */
  const goToDashboard = () => {
    resetFlow()
    navigate('/')
  }

  const goToLogin = () => {
    resetFlow()
    navigate('/login')
  }

  const integrationList: IntegrationKey[] = completed

  return (
    <div className="relative">
      <SidebarStylePromptModal open={showSidebarStylePrompt} onOpenChange={setShowSidebarStylePrompt} />

      {/* The confetti container is absolutely positioned so it never pushes
          content around. The parent is relative so pieces anchor correctly. */}
      <Confetti />

      <SetupCard
        icon={<CheckCircle2 className="text-gain" />}
        title={t('setup.complete.title')}
        description={displayName ? t('setup.complete.subtitle', { name: displayName }) : undefined}
        footer={
          autoLogin === 'success' ? (
            <Button onClick={goToDashboard} className="w-full sm:w-auto">
              {t('setup.complete.cta')}
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : autoLogin === 'failed' ? (
            <Button onClick={goToLogin} className="w-full sm:w-auto">
              {t('setup.complete.loginFallback')}
            </Button>
          ) : (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {autoLogin === 'attempting' ? t('setup.complete.loggingIn') : t('setup.complete.completing')}
            </p>
          )
        }
      >
        {integrationList.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-[13px] font-medium text-muted-foreground">{t('setup.complete.summaryTitle')}</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-border">
              {integrationList.map((key) => {
                const title = t(`setup.integrations.cards.${key}.title`)
                return (
                  <li key={key} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground">
                    <IntegrationMark integration={key} label={title} icon={key === 'crypto' ? Bitcoin : undefined} className="size-8" />
                    <span className="min-w-0 flex-1">{title}</span>
                    <CheckCircle2 className="size-4 shrink-0 text-gain" aria-hidden="true" />
                  </li>
                )
              })}
            </ul>
          </section>
        ) : (
          <SetupNote>{t('setup.complete.noIntegrations')}</SetupNote>
        )}
      </SetupCard>
    </div>
  )
}
