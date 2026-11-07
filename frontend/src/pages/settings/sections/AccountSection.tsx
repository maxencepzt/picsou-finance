import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Loader2, LogOut, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLogout } from '@/features/auth/hooks'
import { useRevokeAllSessionsExceptCurrent, useSessions } from '@/features/mfa/hooks'
import { api } from '@/lib/api-client'
import { getErrorStatus } from '@/lib/errors'
import { useAuthStore } from '@/stores/auth-store'
import { ROW_BUTTON, SettingRow, SettingsCard } from '../SettingRow'

function UsernameRow() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const setUsername = useAuthStore((s) => s.setUsername)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function start() {
    setValue(user?.username ?? '')
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
    setError(null)
  }

  async function save() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === user?.username) { setEditing(false); return }
    if (trimmed.length < 3) { setError(t('auth.validation.usernameTooShort')); return }
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) { setError(t('auth.validation.usernameFormat')); return }
    setSaving(true)
    setError(null)
    try {
      await api.patch('/auth/username', { newUsername: trimmed })
      setUsername(trimmed)
      setEditing(false)
    } catch (err: unknown) {
      setError(getErrorStatus(err) === 409 ? t('settings.usernameTaken') : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <SettingRow label={t('settings.username')} description={t('settings.usernameHint')}>
        <span className="text-sm font-medium text-foreground">{user?.username}</span>
        <Button variant="outline" size="xs" className={ROW_BUTTON} onClick={start}>
          <Pencil aria-hidden="true" />
          {t('common.edit')}
        </Button>
      </SettingRow>
    )
  }

  return (
    <SettingRow label={t('settings.username')} description={t('settings.usernameHint')} htmlFor="settings-username">
      <div className="flex w-full flex-col gap-1.5 @md:w-auto">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="settings-username"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
            className="h-8 min-w-0 flex-1 px-3 @md:w-56 @md:flex-none"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'settings-username-error' : undefined}
            autoFocus
            disabled={saving}
          />
          <Button size="xs" className={ROW_BUTTON} onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {t('common.save')}
          </Button>
          <Button variant="ghost" size="xs" className={ROW_BUTTON} onClick={cancel} disabled={saving}>
            {t('common.cancel')}
          </Button>
        </div>
        {error && <p id="settings-username-error" role="alert" className="text-[13px] text-destructive">{error}</p>}
      </div>
    </SettingRow>
  )
}

/** Logout and closing the other sessions: the actions that end a session, kept apart at the end. */
function SensitiveZone() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useLogout()
  const { data: sessions } = useSessions()
  const revokeOthers = useRevokeAllSessionsExceptCurrent()
  // Unknown until the list arrives: the button waits, but "no other device" is not claimed yet.
  const otherCount = Array.isArray(sessions) ? sessions.filter((s) => !s.current).length : null

  // Through the server-side /auth/logout (useLogout), not just the local flag: otherwise the
  // session cookies stay valid and RequireAuth's probe signs the user straight back in.
  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate('/login') })
  }

  return (
    <SettingsCard title={t('settings.dangerZone')} className="ring-destructive/30">
      <SettingRow
        label={t('settings.otherDevices')}
        description={otherCount === 0 ? t('settings.otherDevicesNone') : t('settings.otherDevicesHint')}
      >
        <Button
          variant="destructive"
          size="xs"
          className={ROW_BUTTON}
          onClick={() => revokeOthers.mutate()}
          disabled={!otherCount || revokeOthers.isPending}
        >
          {revokeOthers.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {t('settings.sessionsRevokeAllOthers')}
        </Button>
      </SettingRow>
      <SettingRow label={t('settings.sessionsCurrent')} description={t('settings.logoutHint')}>
        <Button variant="destructive" size="xs" className={ROW_BUTTON} onClick={handleLogout} disabled={logout.isPending}>
          <LogOut aria-hidden="true" />
          {t('settings.logout')}
        </Button>
      </SettingRow>
    </SettingsCard>
  )
}

export function AccountSection() {
  const { t } = useTranslation()
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN')

  return (
    <>
      <SettingsCard>
        <UsernameRow />
        {isAdmin && (
          <SettingRow label={t('settings.adminSection')} description={t('settings.adminDescription')}>
            <Button asChild variant="outline" size="xs" className={ROW_BUTTON}>
              <Link to="/admin">
                {t('settings.adminButton')}
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          </SettingRow>
        )}
      </SettingsCard>
      <SensitiveZone />
    </>
  )
}
