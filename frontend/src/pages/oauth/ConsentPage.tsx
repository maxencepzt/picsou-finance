import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Check, CircleAlert, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { cn } from '@/lib/utils'
import { formatApiError } from '@/lib/errors'
import { oauthConsentApi } from '@/features/oauthConsent/api'
import { scopeGroup, scopeI18nKey } from '@/features/accessKeys/scopes'
import { AuthScreen } from '@/pages/login/AuthScreen'

// One accessible checkbox for a single requested scope. Unlike the access-key create dialog's
// `ScopeToggle` (a faked ARIA checkbox — no plain input backs it), this one wraps a REAL
// `<input type="checkbox" name="scope">` so the browser's native form submission does the
// "one repeated `scope` field per approved scope" work for us; nothing here needs to serialize
// the selection by hand. The input is visually hidden, so the row carries its focus ring.
function ScopeCheckbox({
  scope,
  checked,
  onToggle,
}: {
  scope: string
  checked: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const k = scopeI18nKey(scope)
  return (
    <label className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/60 has-focus-visible:bg-muted/60 has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-ring">
      <input
        type="checkbox"
        name="scope"
        value={scope}
        checked={checked}
        onChange={onToggle}
        className="sr-only"
      />
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
        )}
        aria-hidden
      >
        {checked && <Check className="size-3 stroke-[3]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">{t(`accessKeys.scopes.${k}.label`)}</span>
          <code className="font-mono text-xs text-muted-foreground">{scope}</code>
        </span>
        <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">{t(`accessKeys.scopes.${k}.desc`)}</span>
      </span>
    </label>
  )
}

function ScopeGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-[13px] font-medium text-muted-foreground">{title}</legend>
      <div className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-border">{children}</div>
    </fieldset>
  )
}

export function ConsentPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('client_id') ?? ''
  const scopeParam = searchParams.get('scope') ?? ''
  const state = searchParams.get('state') ?? ''

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['oauthConsentInfo', clientId, scopeParam, state],
    queryFn: () => oauthConsentApi.getConsentInfo({ clientId, scope: scopeParam, state }),
    enabled: !!clientId,
    retry: false,
  })

  // Every requested scope starts pre-approved (standard consent-screen UX) — the user opts OUT
  // of a scope by unchecking it, rather than having to opt into everything from scratch. Synced
  // during render (not via useEffect) the same way ConfirmDialog resets its own local state on
  // open — react-query keeps `data` referentially stable across renders until it actually
  // refetches, so this only re-syncs when a genuinely new result arrives.
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [syncedData, setSyncedData] = useState(data)
  if (data && data !== syncedData) {
    setSyncedData(data)
    setSelectedScopes(data.requestedScopes)
  }

  const formRef = useRef<HTMLFormElement>(null)

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  // Approve: submit the form as-is — the currently checked `scope` inputs travel with it.
  function handleApprove() {
    formRef.current?.requestSubmit()
  }

  // Deny: submit the SAME form, but with every scope checkbox forced unchecked first, so no
  // `scope` field reaches `/oauth2/authorize` at all. Spring AS reads an authorize-consent POST
  // with zero granted scopes as a denial and returns `access_denied` to the client.
  function handleDeny() {
    const form = formRef.current
    if (!form) return
    form.querySelectorAll<HTMLInputElement>('input[name="scope"]').forEach((cb) => {
      cb.checked = false
    })
    form.requestSubmit()
  }

  const requestedScopes = data?.requestedScopes ?? []
  const readScopes = requestedScopes.filter((s) => scopeGroup(s) === 'read')
  const writeScopes = requestedScopes.filter((s) => scopeGroup(s) === 'write')

  return (
    <AuthScreen
      wide
      icon={<ShieldCheck />}
      title={data ? t('oauthConsent.title', { app: data.clientName }) : t('oauthConsent.titleGeneric')}
      description={t('oauthConsent.description')}
    >
      {!clientId ? (
        <AlertBanner role="alert" icon={<CircleAlert className="size-4 shrink-0" aria-hidden="true" />}>{t('oauthConsent.missingParams')}</AlertBanner>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('oauthConsent.loading')}
        </div>
      ) : isError ? (
        <AlertBanner role="alert" icon={<CircleAlert className="size-4 shrink-0" aria-hidden="true" />}>{formatApiError(error, t, 'oauthConsent.error')}</AlertBanner>
      ) : (
        <form
          ref={formRef}
          method="post"
          action="/oauth2/authorize"
          noValidate
          data-testid="consent-form"
          className="space-y-5"
        >
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="state" value={state} />

          {requestedScopes.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">{t('oauthConsent.noScopes')}</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-foreground">{t('oauthConsent.scopesIntro')}</p>
              {readScopes.length > 0 && (
                <ScopeGroup title={t('accessKeys.groupRead')}>
                  {readScopes.map((s) => (
                    <ScopeCheckbox key={s} scope={s} checked={selectedScopes.includes(s)} onToggle={() => toggleScope(s)} />
                  ))}
                </ScopeGroup>
              )}
              {writeScopes.length > 0 && (
                <ScopeGroup title={t('accessKeys.groupWrite')}>
                  {writeScopes.map((s) => (
                    <ScopeCheckbox key={s} scope={s} checked={selectedScopes.includes(s)} onToggle={() => toggleScope(s)} />
                  ))}
                </ScopeGroup>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={handleDeny} className="w-full sm:w-auto">
              {t('oauthConsent.deny')}
            </Button>
            <Button type="button" onClick={handleApprove} className="w-full sm:w-auto">
              {t('oauthConsent.approve')}
            </Button>
          </div>
        </form>
      )}
    </AuthScreen>
  )
}
