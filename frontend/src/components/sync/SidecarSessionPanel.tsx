import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import {
  CheckCircle2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/shared/NativeSelect"
import {
  PanelDisconnect,
  PanelError,
  PanelField,
  PanelForm,
  PanelIntro,
  PanelLoading,
  PanelStatus,
  PanelWaiting,
} from "@/components/sync/ProviderPanel"
import { PANEL_ACTION, PANEL_CODE_INPUT, PANEL_INPUT, PANEL_SELECT } from "@/components/sync/panel-styles"
import { useProviderSession } from "@/features/sync/hooks"
import { sidecarProviders } from "@/features/sync/providers"
import type { Credentials, PanelProviderId, SecondFactor } from "@/features/sync/providers"
import { extractErrorMessage, getErrorCode, getErrorStatus } from "@/lib/errors"
import { formatTimeAgo } from "@/lib/utils"
import type { SidecarAuthInitResponse, SidecarSessionStatus } from "@/types/api"

/**
 * `AWAITING_APP` has no form: the provider pushes a notification to its mobile
 * app and the completion request simply stays open until the user approves it.
 * Only reachable when the panel declares {@link SidecarSessionPanelProps.appPush}.
 */
type AuthState = "IDLE" | "AWAITING_OTP" | "AWAITING_APP" | "ERROR"

/**
 * A single extra choice appended to the login form and merged into the
 * credentials the panel submits, keyed by `id`. AMEX is the only connector
 * that needs one today (SMS vs e-mail one-time code) -- kept generic rather
 * than AMEX-specific so a future connector with the same shape of need
 * doesn't require another one-off panel.
 */
export interface SidecarExtraField {
  id: string
  label: string
  options: { value: string; label: string }[]
  defaultValue: string
}

/**
 * Backend error code -> `<prefix>.errors.<suffix>` translation suffix. The union
 * of every sidecar provider's error enum: a panel only ever sees the codes its
 * own backend enum can produce, so a suffix it has no translation for is
 * unreachable.
 */
const ERROR_MESSAGE_SUFFIXES: Record<string, string> = {
  INVALID_CREDENTIALS: "invalidCredentials",
  CAPTCHA_BLOCKED: "captchaBlocked",
  INVALID_OTP: "invalidCode",
  /** Sofidy names it MFA_INVALID: its code is a wrong or expired e-mail code. */
  MFA_INVALID: "invalidCode",
  /** Sofidy parks the login until the holder finishes their first visit. */
  FIRST_VISIT_PENDING: "firstVisitPending",
  /** No e-mail on the account, so no code can be sent to it. */
  EMAIL_UNREACHABLE: "emailUnreachable",
  ACCOUNT_INACTIVE: "accountInactive",
  /** Sofidy arms a brute-force counter of its own; the fix is to wait. */
  RATE_LIMITED: "tooManyAttempts",
  APP_VALIDATION_TIMEOUT: "appValidationTimeout",
  /** The confirmation was refused in the bank's app (Crédit Mutuel Épargne Salariale). */
  APP_VALIDATION_CANCELLED: "appValidationCancelled",
  /** The site parks the login on a step only the holder can complete on its website. */
  ACTION_REQUIRED: "actionRequired",
  /** The site asked for a second factor the connector does not drive (Digipass, Safetrans). */
  MFA_TYPE_UNSUPPORTED: "mfaTypeUnsupported",
  SAFEKEY_TIMEOUT: "appValidationTimeout",
  AUTH_ATTEMPT_EXPIRED: "authAttemptExpired",
  SESSION_EXPIRED: "sessionExpired",
  /** Only reachable by a provider whose login can see more than one contract. */
  MULTIPLE_CONTRACTS: "multipleContracts",
  PORTFOLIO_INCOMPLETE: "portfolioIncomplete",
  UPSTREAM_FORMAT_CHANGED: "formatChanged",
  INVALID_DATA: "invalidData",
  UPSTREAM_UNAVAILABLE: "serverError",
  INTERNAL_ERROR: "serverError",
}

/**
 * How long the panel keeps polling the session once a mobile confirmation's
 * completion request is lost: the backend's own confirmation window (120 s)
 * plus the time to import.
 */
const LOST_CONFIRMATION_WAIT_MS = 150_000
const LOST_CONFIRMATION_POLL_MS = 3_000

/**
 * The completion request got no answer from the backend: iOS drops it while
 * Safari sits in the background, which is exactly when the user is approving
 * the push in the bank's app. The backend carries on regardless.
 */
function isLostRequest(value: unknown) {
  const httpStatus = getErrorStatus(value)
  return httpStatus === undefined || httpStatus === 502 || httpStatus === 504
}

export interface SidecarSessionPanelProps {
  /** Entry of `sidecarProviders` whose session this panel drives. */
  provider: PanelProviderId
  /** i18n namespace holding the panel's copy, e.g. `sync.amundi`. */
  translationPrefix: string
  /** Prefix for the form control ids, e.g. `amundi` -> `amundi-login`. */
  fieldIdPrefix: string
  /** Icon shown next to the login field — the provider's own metaphor. */
  loginIcon: LucideIcon
  /** Whether the provider can answer the second factor with a mobile app push. */
  appPush?: boolean
  /**
   * The sidecar keeps the attempt after a wrong SMS code (Crédit Mutuel Épargne Salariale), so
   * the panel stays on the code form for another try instead of starting over.
   */
  otpRetryable?: boolean
  /** An extra login-form choice merged into the initiate payload (e.g. AMEX's SMS/e-mail pick). */
  extraField?: SidecarExtraField
  /**
   * A provider whose table entry has a `reconnect` logs in again from the
   * credentials stored at the last login. It is offered while the status reports
   * `canReconnect`; the second factor then runs as after a typed login, with the
   * user there to approve it. This starts that reconnect as soon as the status
   * allows it, once.
   */
  autoReconnect?: boolean
  /** Called once the auto-reconnect has been considered, whether it started or not. */
  onAutoReconnectStarted?: () => void
  onConnected?: () => void
  recoveryAction?: { label: string; busyLabel: string; description: string; busy: boolean; onRun: () => void }
  /**
   * Replaces the generic "sync succeeded" line once a sync has completed. The SCPI
   * panels use it to report what each fund became, so a sync that applied nothing
   * never reads as a plain success.
   */
  successSummary?: ReactNode
}

/**
 * Login + second factor + sync/disconnect for a browser-sidecar provider
 * (Amundi, Bourse Direct): the backend only queues the import, so the panel
 * polls the session status and surfaces a background failure the same way it
 * surfaces a failed request.
 */
export function SidecarSessionPanel({
  provider,
  translationPrefix,
  fieldIdPrefix,
  loginIcon: LoginIcon,
  appPush = false,
  otpRetryable = false,
  extraField,
  autoReconnect = false,
  onAutoReconnectStarted,
  onConnected,
  recoveryAction,
  successSummary,
}: SidecarSessionPanelProps) {
  const { t } = useTranslation()
  const [authState, setAuthState] = useState<AuthState>("IDLE")
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [extraValue, setExtraValue] = useState(extraField?.defaultValue ?? "")
  const [processId, setProcessId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lostConfirmationAt, setLostConfirmationAt] = useState<number | null>(null)
  const notifyConnectedOnSuccess = useRef(false)
  const autoReconnectHandled = useRef(false)

  const session = useProviderSession(provider)
  const status = session.status as UseQueryResult<SidecarSessionStatus>
  const initiate = session.initiate as UseMutationResult<SidecarAuthInitResponse, Error, Credentials>
  const { reconnect, clear: logout } = session
  const complete = session.complete as UseMutationResult<SidecarSessionStatus, Error, SecondFactor>
  const sync = session.sync as UseMutationResult<SidecarSessionStatus, Error, void>
  const { mutate: completeMutate } = complete

  const key = (suffix: string) => `${translationPrefix}.${suffix}`

  const messageForCode = (value: string | null | undefined) => {
    const suffix = value ? ERROR_MESSAGE_SUFFIXES[value] : undefined
    return suffix ? t(key(`errors.${suffix}`)) : null
  }

  const formatError = (value: unknown) => {
    const httpStatus = getErrorStatus(value)
    if (httpStatus === 429) return t(key("errors.tooManyAttempts"))
    const codedMessage = messageForCode(getErrorCode(value))
    if (codedMessage) return codedMessage
    return extractErrorMessage(value, t(key("errors.serverError")))
  }

  const resetAuth = () => {
    setAuthState("IDLE")
    setProcessId(null)
    setCode("")
    setLostConfirmationAt(null)
  }

  const submitSecondFactor = (id: string, otp?: string) => {
    setError(null)
    completeMutate(
      { processId: id, code: otp },
      {
        onSuccess: (result) => {
          notifyConnectedOnSuccess.current = true
          resetAuth()
          setLogin("")
          setPassword("")
          if (result.syncStatus === "SUCCESS") {
            notifyConnectedOnSuccess.current = false
            onConnected?.()
          } else {
            void status.refetch()
          }
        },
        onError: (value) => {
          if (appPush && otp === undefined && isLostRequest(value)) {
            // Keep the waiting card: the session status tells whether it went through.
            setLostConfirmationAt(Date.now())
            return
          }
          setError(formatError(value))
          setCode("")
          if (otpRetryable && getErrorCode(value) === "INVALID_OTP") {
            setAuthState("AWAITING_OTP")
            return
          }
          setAuthState("ERROR")
          setProcessId(null)
        },
      }
    )
  }

  /** What follows a login request, typed or from stored credentials: a second factor, or a session. */
  const handleInitResult = (result: SidecarAuthInitResponse) => {
    setPassword("")
    if (result.mfaRequired) {
      if (!result.processId) {
        setError(t(key("errors.formatChanged")))
        setAuthState("ERROR")
        return
      }
      setProcessId(result.processId)
      if (appPush && result.mfaType === "APP_PUSH") {
        // Nothing to type: hold the completion request open
        // while the user approves the push on their phone.
        setAuthState("AWAITING_APP")
        submitSecondFactor(result.processId)
        return
      }
      setAuthState("AWAITING_OTP")
      return
    }
    notifyConnectedOnSuccess.current = true
    setLogin("")
    setAuthState("IDLE")
    void status.refetch()
  }

  const handleInitError = (value: unknown) => {
    setPassword("")
    setError(formatError(value))
    setAuthState("ERROR")
  }

  const startReconnect = () => {
    reconnect.mutate(undefined, { onSuccess: handleInitResult, onError: handleInitError })
  }

  const connected = status.data?.isActive === true
  const canReconnect = "reconnect" in sidecarProviders[provider] && status.data?.canReconnect === true
  const syncStatus = status.data?.syncStatus ?? "IDLE"
  const isSyncing = syncStatus === "QUEUED" || syncStatus === "RUNNING"
  const requestingSync = sync.isPending || isSyncing
  const backgroundError =
    syncStatus === "FAILED"
      ? (messageForCode(status.data?.lastSyncError) ??
        t(key("errors.serverError")))
      : null
  const statusError = status.isError ? formatError(status.error) : null
  const visibleError = error ?? backgroundError ?? statusError

  const { refetch: refetchStatus } = status
  useEffect(() => {
    if (lostConfirmationAt === null) return
    const timer = setInterval(() => {
      if (Date.now() - lostConfirmationAt >= LOST_CONFIRMATION_WAIT_MS) {
        setLostConfirmationAt(null)
        setError(t(`${translationPrefix}.errors.appValidationTimeout`))
        setAuthState("ERROR")
        setProcessId(null)
        return
      }
      void refetchStatus().then(({ data }) => {
        if (!data?.isActive) return
        setLostConfirmationAt(null)
        setAuthState("IDLE")
        setProcessId(null)
        setLogin("")
        setPassword("")
        if (data.syncStatus === "SUCCESS") onConnected?.()
        else notifyConnectedOnSuccess.current = true
      })
    }, LOST_CONFIRMATION_POLL_MS)
    return () => clearInterval(timer)
  }, [lostConfirmationAt, onConnected, refetchStatus, t, translationPrefix])

  useEffect(() => {
    if (!autoReconnect || autoReconnectHandled.current || status.isLoading) return
    autoReconnectHandled.current = true
    onAutoReconnectStarted?.()
    if (!connected && canReconnect && authState === "IDLE") startReconnect()
    // startReconnect is a fresh closure every render; the ref makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReconnect, status.isLoading, connected, canReconnect, authState, onAutoReconnectStarted])

  useEffect(() => {
    if (syncStatus !== "SUCCESS" || !notifyConnectedOnSuccess.current) return
    notifyConnectedOnSuccess.current = false
    onConnected?.()
  }, [onConnected, syncStatus])

  if (status.isLoading) return <PanelLoading />

  const lastSync = status.data?.lastSyncCompletedAt
  const startLogin = () => {
    setError(null)
    initiate.mutate(
      { login, password, ...(extraField ? { [extraField.id]: extraValue } : {}) },
      { onSuccess: handleInitResult, onError: handleInitError }
    )
  }

  return (
    <div className="space-y-4">
      {connected ? (
        <PanelStatus
          tone={isSyncing ? "busy" : backgroundError ? "error" : "ok"}
          label={t(key("sessionActive"))}
          meta={[lastSync && t("sync.panel.lastSync", { time: formatTimeAgo(lastSync) })]}
          actions={
            <>
              <PanelDisconnect
                label={t(key("clearSession"))}
                provider={t(key("title"))}
                pending={logout.isPending}
                onConfirm={() => {
                  setError(null)
                  logout.mutate(undefined, {
                    onSuccess: () => {
                      notifyConnectedOnSuccess.current = false
                      resetAuth()
                    },
                    onError: (value) => setError(formatError(value)),
                  })
                }}
              />
              <Button
                size="xs"
                className={PANEL_ACTION}
                onClick={() => {
                  setError(null)
                  sync.mutate(undefined, {
                    onError: (value) => setError(formatError(value)),
                  })
                }}
                disabled={requestingSync}
              >
                <RefreshCw className={requestingSync ? "animate-spin" : undefined} />
                {requestingSync ? t(key("syncing")) : t(key("sync"))}
              </Button>
            </>
          }
        >
          {isSyncing && (
            <p className="text-muted-foreground">
              {syncStatus === "QUEUED" ? t(key("queued")) : t(key("syncing"))}
            </p>
          )}
          {syncStatus === "SUCCESS" && lastSync && (
            successSummary ?? (
              <p className="flex items-center gap-1.5 text-gain">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                {t(key("syncSuccess"))}
              </p>
            )
          )}
          {recoveryAction && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="flex-1 text-xs text-muted-foreground">{recoveryAction.description}</p>
              <Button
                variant="outline"
                size="xs"
                className={PANEL_ACTION}
                disabled={recoveryAction.busy || requestingSync}
                onClick={recoveryAction.onRun}
              >
                {recoveryAction.busy ? recoveryAction.busyLabel : recoveryAction.label}
              </Button>
            </div>
          )}
        </PanelStatus>
      ) : (
        // The provider view's header already says "not connected".
        <PanelIntro>{t(key("scope"))}</PanelIntro>
      )}

      {visibleError && (
        <PanelError
          onRetry={
            error || statusError
              ? () => {
                  setError(null)
                  resetAuth()
                  if (statusError) void status.refetch()
                }
              : undefined
          }
        >
          {visibleError}
        </PanelError>
      )}

      {!connected && authState === "IDLE" && canReconnect && (
        <PanelForm
          onSubmit={(event) => {
            event.preventDefault()
            setError(null)
            startReconnect()
          }}
          actions={
            <Button type="submit" size="xs" className={PANEL_ACTION} disabled={reconnect.isPending}>
              <RefreshCw className={reconnect.isPending ? "animate-spin" : undefined} />
              {reconnect.isPending ? t(key("connecting")) : t(key("reconnect"))}
            </Button>
          }
        >
          <p className="text-sm text-muted-foreground">{t(key("reconnectHint"))}</p>
        </PanelForm>
      )}

      {!connected && authState === "IDLE" && (
        <PanelForm
          onSubmit={(event) => {
            event.preventDefault()
            startLogin()
          }}
          actions={
            <Button type="submit" size="xs" className={PANEL_ACTION} disabled={initiate.isPending}>
              {initiate.isPending && <RefreshCw className="animate-spin" />}
              {initiate.isPending ? t(key("connecting")) : t(key("connect"))}
            </Button>
          }
        >
          <PanelField id={`${fieldIdPrefix}-login`} label={t(key("login"))} icon={LoginIcon}>
            <Input
              id={`${fieldIdPrefix}-login`}
              className={PANEL_INPUT}
              autoComplete="username"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              required
            />
          </PanelField>
          <PanelField id={`${fieldIdPrefix}-password`} label={t(key("password"))} icon={Lock}>
            <Input
              id={`${fieldIdPrefix}-password`}
              className={PANEL_INPUT}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </PanelField>
          {extraField && (
            <PanelField id={`${fieldIdPrefix}-${extraField.id}`} label={extraField.label}>
              <NativeSelect
                id={`${fieldIdPrefix}-${extraField.id}`}
                className={PANEL_SELECT}
                value={extraValue}
                onChange={(event) => setExtraValue(event.target.value)}
              >
                {extraField.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </PanelField>
          )}
        </PanelForm>
      )}

      {!connected && authState === "AWAITING_APP" && (
        <PanelWaiting
          icon={Smartphone}
          title={t(key("appValidationPrompt"))}
          hint={t(key("appValidationHint"))}
        />
      )}

      {!connected && authState === "AWAITING_OTP" && (
        <PanelForm
          onSubmit={(event) => {
            event.preventDefault()
            if (!processId) return
            submitSecondFactor(processId, code)
          }}
          step={{ icon: ShieldCheck, title: t(key("otpPrompt")) }}
          actions={
            <Button type="submit" size="xs" className={PANEL_ACTION} disabled={complete.isPending || code.length < 4}>
              {complete.isPending && <RefreshCw className="animate-spin" />}
              {complete.isPending ? t(key("validating")) : t(key("validate"))}
            </Button>
          }
        >
          <PanelField id={`${fieldIdPrefix}-otp`} label={t(key("otpCode"))}>
            <Input
              id={`${fieldIdPrefix}-otp`}
              className={PANEL_CODE_INPUT}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{4,10}"
              maxLength={10}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              required
              autoFocus
            />
          </PanelField>
        </PanelForm>
      )}
    </div>
  )
}
