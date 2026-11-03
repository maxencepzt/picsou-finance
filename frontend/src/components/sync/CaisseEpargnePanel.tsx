import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, Landmark, RefreshCw, ShieldAlert, Smartphone } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { PANEL_ACTION, PANEL_INPUT } from "@/components/sync/panel-styles"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { caisseEpargneApi } from "@/features/sync/api"
import {
  useProviderClear,
  useProviderComplete,
  useProviderStatus,
  useProviderSync,
} from "@/features/sync/hooks"
import { getErrorCode, getErrorDetail, getErrorStatus } from "@/lib/errors"
import { formatTimeAgo } from "@/lib/utils"

/**
 * `KEYPAD` is a pop-up showing the bank's virtual keypad: the user reads the
 * pad and clicks his own digits. Picsou never sees the password, only the
 * positions of the clicked keys, held in component state until Validate.
 * `AWAITING_APP` has no form: the bank pushes a Sécur'Pass notification and the
 * completion request stays open until the user approves it on their phone.
 *
 * One attempt only. A wrong password spends a bank attempt and can lock the
 * account, so nothing in this panel replays `initiate` or `keypad` after a
 * failure: after an error the form simply comes back and the user decides.
 */
type AuthState =
  | "IDLE"
  | "SUBMITTING"
  | "KEYPAD"
  | "SENDING_KEYPAD"
  | "AWAITING_APP"
  | "ERROR"

/** The bank's password is 6 to 12 digits; the sidecar enforces the same bounds. */
const MIN_POSITIONS = 6
const MAX_POSITIONS = 12
const DEFAULT_COLUMNS = 5

interface KeypadPad {
  processId: string
  images: string[]
  columns: number
}

/** The sidecar waits this long for the human to approve on the phone (COMPLETE_WAIT_SECONDS). */
const HUMAN_WAIT_SECONDS = 150

/**
 * How long the panel keeps polling the session once the completion request is lost:
 * the backend's own window (170 s, the human wait plus collecting the session) and a margin.
 */
const LOST_COMPLETION_WAIT_MS = 180_000
const LOST_COMPLETION_POLL_MS = 3_000
/**
 * Each poll tick sends its own status read, bounded by this, rather than refetching the
 * status query: a refetch every 3 s would cancel a read slower than that, so a slow network
 * would never see the session; and waiting on one read could hang on a request that never
 * returns. Reads may overlap; the first live answer wins.
 */
const LOST_COMPLETION_READ_TIMEOUT_MS = 10_000

/**
 * The completion request got no answer from the backend: iOS drops it while Safari sits
 * in the background, which is exactly when the user approves Sécur'Pass in the bank's app
 * on the same phone. The backend carries on and stores the session regardless.
 */
function isLostRequest(value: unknown) {
  const httpStatus = getErrorStatus(value)
  return httpStatus === undefined || httpStatus === 502 || httpStatus === 504
}

const KNOWN_CODES = new Set([
  "INVALID_CREDENTIALS",
  "KEYPAD_CHANGED",
  "KEYPAD_EXPIRED",
  "INVALID_POSITIONS",
  "APP_VALIDATION_TIMEOUT",
  "AUTH_ATTEMPT_EXPIRED",
  "SESSION_EXPIRED",
  "UPSTREAM_UNAVAILABLE",
  "UPSTREAM_FORMAT_CHANGED",
  "INVALID_SESSION_STATE",
  "INTERNAL_ERROR",
])

/** The code is in `code` when the backend sends one, else in the problem `detail`. */
function errorCodeOf(error: unknown): string | undefined {
  const code = getErrorCode(error)
  if (code && KNOWN_CODES.has(code)) return code
  const detail = getErrorDetail(error)
  return detail && KNOWN_CODES.has(detail) ? detail : undefined
}

/** Whole seconds of a `Retry-After` header, from a plain object or AxiosHeaders. */
function retryAfterSeconds(error: unknown): number | null {
  const headers = (error as { response?: { headers?: unknown } })?.response?.headers as
    | { get?: (name: string) => unknown; [key: string]: unknown }
    | undefined
  if (!headers) return null
  const raw =
    typeof headers.get === "function"
      ? headers.get("retry-after")
      : (headers["retry-after"] ?? headers["Retry-After"])
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

interface CaisseEpargnePanelProps {
  onConnected?: () => void
}

export function CaisseEpargnePanel({ onConnected }: CaisseEpargnePanelProps = {}) {
  const { t } = useTranslation()
  const [authState, setAuthState] = useState<AuthState>("IDLE")
  const [customerId, setCustomerId] = useState("")
  const [pad, setPad] = useState<KeypadPad | null>(null)
  // Key positions only (indexes in the pad's DOM order), never digits. Component
  // state only: no query, no mutation cache, no storage, no log.
  const [positions, setPositions] = useState<number[]>([])
  const [keypadSecondsLeft, setKeypadSecondsLeft] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  // When the completion request was lost: the waiting card stays and the session is polled.
  const [lostCompletionAt, setLostCompletionAt] = useState<number | null>(null)
  // Synchronous guard: state updates are async, so a fast double click could
  // otherwise reach the bank twice.
  const submitting = useRef(false)
  // Set once the login completed and its first sync was queued: the caller is told
  // "connected" only when that sync succeeded, so the accounts exist by then.
  const notifyConnectedOnSuccess = useRef(false)
  const firstSyncStarted = useRef(false)
  const authAttempt = useRef(0)

  const status = useProviderStatus("caisseEpargne")
  const complete = useProviderComplete("caisseEpargne")
  const sync = useProviderSync("caisseEpargne")
  const logout = useProviderClear("caisseEpargne")
  const { mutate: completeMutate } = complete
  const { mutate: syncMutate } = sync
  const { refetch: refetchStatus } = status

  const messageForCode = useCallback((value: string | null | undefined) => {
    switch (value) {
      case "INVALID_CREDENTIALS":
        return t("sync.caisseEpargne.errors.invalidCredentials")
      case "KEYPAD_CHANGED":
        return t("sync.caisseEpargne.errors.keypadChanged")
      case "KEYPAD_EXPIRED":
        return t("sync.caisseEpargne.errors.keypadExpired")
      case "INVALID_POSITIONS":
        return t("sync.caisseEpargne.errors.invalidPositions")
      case "APP_VALIDATION_TIMEOUT":
        return t("sync.caisseEpargne.errors.appValidationTimeout")
      case "AUTH_ATTEMPT_EXPIRED":
        return t("sync.caisseEpargne.errors.authAttemptExpired")
      case "SESSION_EXPIRED":
        return t("sync.caisseEpargne.errors.sessionExpired")
      case "UPSTREAM_FORMAT_CHANGED":
        return t("sync.caisseEpargne.errors.formatChanged")
      case "INVALID_SESSION_STATE":
        return t("sync.caisseEpargne.errors.invalidSessionState")
      case "UPSTREAM_UNAVAILABLE":
      case "INTERNAL_ERROR":
        return t("sync.caisseEpargne.errors.serverError")
      default:
        return null
    }
  }, [t])

  // Never shows a raw backend message: the bank's own detail can carry
  // internals, and an unknown failure gets the generic text.
  const formatError = useCallback((value: unknown) => {
    if (getErrorStatus(value) === 429) {
      const seconds = retryAfterSeconds(value)
      return seconds
        ? t("sync.caisseEpargne.errors.rateLimitedRetryAfter", {
            minutes: Math.ceil(seconds / 60),
          })
        : t("sync.caisseEpargne.errors.rateLimited")
    }
    return (
      messageForCode(errorCodeOf(value)) ?? t("sync.caisseEpargne.errors.serverError")
    )
  }, [messageForCode, t])

  const startFirstSync = useCallback(() => {
    if (firstSyncStarted.current) return
    firstSyncStarted.current = true
    setLostCompletionAt(null)
    setAuthState("IDLE")
    setCustomerId("")
    void refetchStatus()
    // A fresh session holds no accounts yet. Both completion paths queue one
    // first sync, and the caller is told only once its accounts exist.
    syncMutate(undefined, {
      onSuccess: () => {
        notifyConnectedOnSuccess.current = true
      },
      onError: (value) => setError(formatError(value)),
    })
  }, [formatError, refetchStatus, syncMutate])

  useEffect(() => {
    if (lostCompletionAt === null) return
    let cancelled = false
    const attempt = authAttempt.current
    const timer = setInterval(() => {
      if (Date.now() - lostCompletionAt >= LOST_COMPLETION_WAIT_MS) {
        clearInterval(timer)
        // Stop sending reads, but let a recent in-flight read confirm the login.
        // Keep its effect alive until success, a new attempt or unmount.
        setError(t("sync.caisseEpargne.errors.appValidationTimeout"))
        setAuthState("ERROR")
        return
      }
      const readStartedAt = Date.now()
      void caisseEpargneApi
        .getStatusWithin(LOST_COMPLETION_READ_TIMEOUT_MS)
        .then((data) => {
          if (cancelled || attempt !== authAttempt.current) return
          if (Date.now() - readStartedAt >= LOST_COMPLETION_READ_TIMEOUT_MS) return
          if (!data?.isActive) return
          cancelled = true
          clearInterval(timer)
          setError(null)
          startFirstSync()
        })
        .catch(() => {
          // Only status reads are retried. Authentication is never replayed.
        })
    }, LOST_COMPLETION_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [lostCompletionAt, startFirstSync, t])

  const connected = status.data?.isActive === true
  const syncStatus = status.data?.syncStatus ?? "IDLE"
  const isSyncing = syncStatus === "QUEUED" || syncStatus === "RUNNING"
  const requestingSync = sync.isPending || isSyncing
  const backgroundError =
    syncStatus === "FAILED"
      ? (messageForCode(status.data?.lastSyncError) ??
        t("sync.caisseEpargne.errors.serverError"))
      : null
  const statusError = status.isError ? formatError(status.error) : null
  const visibleError = error ?? backgroundError ?? statusError

  useEffect(() => {
    if (syncStatus !== "SUCCESS" || !notifyConnectedOnSuccess.current) return
    notifyConnectedOnSuccess.current = false
    onConnected?.()
  }, [onConnected, syncStatus])

  useEffect(() => {
    if (authState !== "AWAITING_APP") return
    const timer = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1_000)
    return () => clearInterval(timer)
  }, [authState])

  // The pad is stable for a short time only: once it is out of date nothing may
  // be sent, so the pop-up closes and everything the user clicked is dropped.
  useEffect(() => {
    if (authState !== "KEYPAD") return
    const timer = setInterval(() => setKeypadSecondsLeft((value) => Math.max(0, value - 1)), 1_000)
    return () => clearInterval(timer)
  }, [authState])

  const expired = authState === "KEYPAD" && keypadSecondsLeft <= 0
  if (expired) {
    // Derived during render (React's "adjust state on change" pattern), not in an effect.
    setPad(null)
    setPositions([])
    setKeypadSecondsLeft(0)
    setError(t("sync.caisseEpargne.errors.keypadExpired"))
    setAuthState("ERROR")
  }

  const resetKeypad = () => {
    setPad(null)
    setPositions([])
    setKeypadSecondsLeft(0)
  }

  const cancelKeypad = () => {
    if (authState !== "KEYPAD") return
    resetKeypad()
    setError(null)
    setAuthState("IDLE")
  }

  const awaitSecurPass = (processId: string) => {
    // One completion call: only session status may be polled if its answer is lost.
    completeMutate(
      { processId },
      {
        onSuccess: startFirstSync,
        onError: (value) => {
          if (isLostRequest(value)) {
            // Keep the waiting card: the session status tells whether it went through.
            // Recovery gets a full window even if the approval countdown already elapsed.
            setSecondsLeft(LOST_COMPLETION_WAIT_MS / 1_000)
            setLostCompletionAt(Date.now())
            return
          }
          setError(formatError(value))
          setAuthState("ERROR")
        },
      }
    )
  }

  const submit = async () => {
    if (submitting.current) return
    submitting.current = true
    authAttempt.current += 1
    firstSyncStarted.current = false
    setLostCompletionAt(null)
    setError(null)
    setAuthState("SUBMITTING")
    try {
      const result = await caisseEpargneApi.initiateAuth(customerId)
      const images = result.keypad?.images
      if (!result.processId || !Array.isArray(images) || images.length !== 10) {
        setError(t("sync.caisseEpargne.errors.formatChanged"))
        setAuthState("ERROR")
        return
      }
      const columns = Number(result.keypad.columns)
      setPad({
        processId: result.processId,
        images,
        columns: Number.isInteger(columns) && columns >= 1 && columns <= 10 ? columns : DEFAULT_COLUMNS,
      })
      setPositions([])
      setKeypadSecondsLeft(Math.max(0, Math.floor(result.expiresInSeconds ?? 0)))
      setAuthState("KEYPAD")
    } catch (value) {
      setError(formatError(value))
      setAuthState("ERROR")
    } finally {
      submitting.current = false
    }
  }

  const pressKey = (index: number) => {
    if (authState !== "KEYPAD") return
    setPositions((current) => (current.length >= MAX_POSITIONS ? current : [...current, index]))
  }

  const validateKeypad = async () => {
    if (!pad || authState !== "KEYPAD" || submitting.current) return
    if (positions.length < MIN_POSITIONS || positions.length > MAX_POSITIONS) return
    submitting.current = true
    const { processId } = pad
    const sent = positions
    setAuthState("SENDING_KEYPAD")
    // The request owns the only copy from here on: nothing of it stays in state.
    resetKeypad()
    try {
      await caisseEpargneApi.sendKeypad(processId, sent)
      // The keypad TTL is over: the user now only has the sidecar's 150 s human
      // wait to approve, so that is what the countdown shows.
      setSecondsLeft(HUMAN_WAIT_SECONDS)
      setAuthState("AWAITING_APP")
      awaitSecurPass(processId)
    } catch (value) {
      setError(formatError(value))
      setAuthState("ERROR")
    } finally {
      submitting.current = false
    }
  }

  if (status.isLoading) return <PanelLoading />

  const showForm = !connected && authState !== "AWAITING_APP"
  const pending =
    authState === "SUBMITTING" || authState === "KEYPAD" || authState === "SENDING_KEYPAD"
  const lastSync = status.data?.lastSyncCompletedAt
  const unsupported = status.data?.unsupported ?? []

  return (
    <div className="space-y-4">
      {connected ? (
        <PanelStatus
          tone={isSyncing ? "busy" : backgroundError ? "error" : "ok"}
          label={t("sync.caisseEpargne.sessionActive")}
          meta={[lastSync && t("sync.panel.lastSync", { time: formatTimeAgo(lastSync) })]}
          actions={
            <>
              <PanelDisconnect
                label={t("sync.caisseEpargne.clearSession")}
                provider={t("sync.caisseEpargne.title")}
                description={t("sync.caisseEpargne.disconnectConfirm")}
                confirmLabel={t("sync.caisseEpargne.disconnectConfirmAction")}
                pending={logout.isPending}
                onConfirm={() => {
                  setError(null)
                  logout.mutate(undefined, {
                    onSuccess: () => setAuthState("IDLE"),
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
                {requestingSync ? t("sync.caisseEpargne.syncing") : t("sync.caisseEpargne.sync")}
              </Button>
            </>
          }
        >
          {isSyncing && (
            <p className="text-muted-foreground">
              {syncStatus === "QUEUED"
                ? t("sync.caisseEpargne.queued")
                : t("sync.caisseEpargne.syncing")}
            </p>
          )}
          {syncStatus === "SUCCESS" && lastSync && (
            <p className="flex items-center gap-1.5 text-gain">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              {t("sync.caisseEpargne.syncSuccess")}
            </p>
          )}
          {unsupported.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-medium text-foreground">{t("sync.caisseEpargne.unsupportedTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("sync.caisseEpargne.unsupportedHint")}</p>
              {/* Family code only: the contract id is never shown. */}
              <ul className="flex flex-wrap gap-1.5">
                {unsupported.map((contract, index) => (
                  <li
                    key={`${contract.familyCode}-${index}`}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground tabular-nums"
                  >
                    {contract.familyCode}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </PanelStatus>
      ) : (
        // The provider view's header already says "not connected".
        <PanelIntro>{t("sync.caisseEpargne.scope")}</PanelIntro>
      )}

      {visibleError && (
        <PanelError onRetry={statusError && !error ? () => void status.refetch() : undefined}>
          {visibleError}
        </PanelError>
      )}

      {showForm && (
        <PanelForm
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          actions={
            <Button type="submit" size="xs" className={PANEL_ACTION} disabled={pending}>
              {pending && <RefreshCw className="animate-spin" />}
              {pending ? t("sync.caisseEpargne.connecting") : t("sync.caisseEpargne.connect")}
            </Button>
          }
        >
          <div className="flex items-start gap-3 rounded-xl bg-warning/10 px-3 py-2.5">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <ul className="space-y-1 text-xs text-pretty text-foreground">
              <li>{t("sync.caisseEpargne.notice.neverStored")}</li>
              <li>{t("sync.caisseEpargne.notice.noRetry")}</li>
              <li>{t("sync.caisseEpargne.notice.lockRisk")}</li>
            </ul>
          </div>
          <PanelField id="caisse-epargne-customer-id" label={t("sync.caisseEpargne.customerId")} icon={Landmark}>
            <Input
              id="caisse-epargne-customer-id"
              className={PANEL_INPUT}
              inputMode="numeric"
              autoComplete="off"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value.replace(/\D/g, ""))}
              required
            />
          </PanelField>
        </PanelForm>
      )}

      {!connected && authState === "AWAITING_APP" && (
        <PanelWaiting
          icon={Smartphone}
          title={t("sync.caisseEpargne.securPassPrompt")}
          hint={t("sync.caisseEpargne.securPassHint")}
        >
          {t("sync.caisseEpargne.countdownLabel")}{" "}
          <span data-testid="caisse-epargne-countdown" className="font-semibold text-foreground tabular-nums">
            {formatCountdown(secondsLeft)}
          </span>
        </PanelWaiting>
      )}
      <Dialog
        open={authState === "KEYPAD"}
        onOpenChange={(open) => {
          if (!open) cancelKeypad()
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t("sync.caisseEpargne.keypad.title")}</DialogTitle>
            <DialogDescription>{t("sync.caisseEpargne.keypad.description")}</DialogDescription>
          </DialogHeader>
          {pad && (
            <>
              {/* Plain <img src> only: the pad comes from the bank, nothing is injected as HTML.
                  Names are ranks ("Key 1"), never digits, so assistive tech cannot leak them.
                  White key faces: the bank draws its digits for a light page, in either theme. */}
              <div
                data-testid="caisse-epargne-keypad-grid"
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${pad.columns}, minmax(0, 1fr))` }}
              >
                {pad.images.map((src, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={t("sync.caisseEpargne.keypad.key", { n: index + 1 })}
                    className="flex aspect-square items-center justify-center rounded-xl bg-white p-1.5 ring-1 ring-foreground/10 transition-[box-shadow,transform] hover:ring-primary active:scale-[0.96]"
                    onClick={() => pressKey(index)}
                  >
                    <img src={src} alt="" draggable={false} className="size-full object-contain" />
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2">
                <div
                  data-testid="caisse-epargne-keypad-dots"
                  role="img"
                  aria-label={t("sync.caisseEpargne.keypad.entered", { count: positions.length })}
                  className="flex min-h-4 flex-wrap items-center gap-1.5"
                >
                  {positions.map((_, index) => (
                    <span key={index} data-dot className="size-2.5 rounded-full bg-foreground" />
                  ))}
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {t("sync.caisseEpargne.keypad.countdownLabel")}{" "}
                  <span data-testid="caisse-epargne-keypad-countdown" className="font-semibold text-foreground tabular-nums">
                    {formatCountdown(keypadSecondsLeft)}
                  </span>
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={cancelKeypad}>
                  {t("sync.caisseEpargne.keypad.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={positions.length === 0}
                  onClick={() => setPositions([])}
                >
                  {t("sync.caisseEpargne.keypad.clear")}
                </Button>
                <Button
                  type="button"
                  disabled={positions.length < MIN_POSITIONS || positions.length > MAX_POSITIONS}
                  onClick={() => void validateKeypad()}
                >
                  {t("sync.caisseEpargne.keypad.validate")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
