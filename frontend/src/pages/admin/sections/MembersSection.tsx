import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as LinkIcon, KeyRound, Trash2, Copy, Check, ShieldOff, ShieldCheck, UserPlus, MoreHorizontal, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { formatApiError } from '@/lib/errors'
import { deriveMonogram } from '@/lib/utils'
import { SettingsCard, StatusText } from '../components/SettingsBlocks'
import { useAuthStore } from '@/stores/auth-store'
import {
  useFamilyMembers,
  useCreateUserWithLogin,
  useDeleteMember,
  useGenerateActivationLink,
  useResetMemberPassword,
} from '@/features/family/hooks'
import { useAdminForceDisableMfa } from '@/features/mfa/hooks'

type GeneratedLink = { memberId: number; url: string } | null

export function MembersSection() {
  const { t } = useTranslation()
  const currentUser = useAuthStore((s) => s.user)
  const { data: members, isLoading } = useFamilyMembers()
  const createUser = useCreateUserWithLogin()
  const deleteMember = useDeleteMember()
  const generateActivation = useGenerateActivationLink()
  const resetPassword = useResetMemberPassword()
  const forceDisableMfa = useAdminForceDisableMfa()

  const [newName, setNewName] = useState('')
  const [link, setLink] = useState<GeneratedLink>(null)
  const [copied, setCopied] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [resetMfaId, setResetMfaId] = useState<number | null>(null)

  function showLink(memberId: number, path: string) {
    setLink({ memberId, url: `${window.location.origin}${path}` })
    setCopied(false)
  }

  function handleCreateUser() {
    const displayName = newName.trim()
    if (!displayName) return
    createUser.mutate(
      { displayName },
      {
        onSuccess: ({ member, activationLink }) => {
          showLink(member.id, activationLink)
          setNewName('')
        },
      },
    )
  }

  async function handleCopy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be unavailable in non-https dev contexts; user can select-copy */
    }
  }

  function handleConfirmDelete() {
    if (deletingId == null) return
    deleteMember.mutate(deletingId, {
      onSuccess: () => setDeletingId(null),
    })
  }

  function handleConfirmResetMfa() {
    if (resetMfaId == null) return
    forceDisableMfa.mutate(resetMfaId, {
      onSuccess: () => setResetMfaId(null),
    })
  }

  const statusTone = { statusAdmin: 'neutral', statusActive: 'ok', statusPending: 'warn', statusManaged: 'neutral' } as const

  return (
    <SettingsCard title={t('admin.members.title')} description={t('admin.members.description')}>
      <form
        className="flex gap-2 py-4"
        onSubmit={(e) => { e.preventDefault(); handleCreateUser() }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('admin.members.createUserPlaceholder')}
          aria-label={t('admin.members.createUserPlaceholder')}
          disabled={createUser.isPending}
          className="h-9"
        />
        <Button type="submit" size="xs" disabled={!newName.trim() || createUser.isPending} className="shrink-0">
          {createUser.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
          <span className="max-sm:sr-only">{t('admin.members.createUser')}</span>
        </Button>
      </form>

      {createUser.isError && (
        <p role="alert" className="py-3 text-[13px] text-destructive">{formatApiError(createUser.error, t)}</p>
      )}

      {link && (
        <div className="space-y-2 py-4">
          <p className="text-sm font-medium text-foreground">{t('admin.members.linkLabel')}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <code className="flex min-h-10 flex-1 items-center rounded-xl bg-muted px-4 py-2 font-mono text-[13px] break-all text-foreground">
              {link.url}
            </code>
            <Button variant="outline" onClick={handleCopy} className="w-full sm:w-auto sm:min-w-36">
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? t('admin.members.copied') : t('admin.members.copyLink')}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="py-4 text-sm text-muted-foreground">{t('admin.members.loading')}</p>
      ) : !members || members.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t('admin.members.noMembers')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {members.map((m) => {
            const isSelf = m.id === currentUser?.memberId
            const isAdminMember = !m.managed
            const status = isAdminMember
              ? 'statusAdmin'
              : m.activated
                ? 'statusActive'
                : m.hasLogin
                  ? 'statusPending'
                  : 'statusManaged'
            const canResetMfa = m.mfaEnabled && !isSelf
            const canDelete = !isSelf && m.managed

            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-on-class"
                  style={{ backgroundColor: m.avatarColor }}
                  aria-hidden
                >
                  {deriveMonogram(m.displayName).slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-baseline gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">{m.displayName}</span>
                    {isSelf && <span className="shrink-0 text-[13px] text-muted-foreground">{t('admin.members.you')}</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
                    <span className="font-mono">{m.loginName ?? t('admin.members.noLogin')}</span>
                    <StatusText tone={statusTone[status]}>{t(`admin.members.${status}`)}</StatusText>
                    {m.mfaEnabled && (
                      <span className="inline-flex items-center gap-1 font-medium text-foreground">
                        <ShieldCheck className="size-3.5 text-gain" aria-hidden="true" />
                        {t('admin.members.mfaOn')}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 max-sm:w-full max-sm:justify-end">
                  {/* Create login OR regenerate activation link (non-activated) */}
                  {m.managed && !m.activated && (
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={generateActivation.isPending}
                      onClick={() => {
                        generateActivation.mutate(m.id, {
                          onSuccess: (d) => showLink(m.id, d.activationLink),
                        })
                      }}
                    >
                      <LinkIcon aria-hidden="true" />
                      {m.hasLogin
                        ? t('admin.members.regenerateLink')
                        : t('admin.members.createLogin')}
                    </Button>
                  )}

                  {/* Reset password (only for active accounts that the admin doesn't own) */}
                  {m.activated && !isSelf && (
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={resetPassword.isPending}
                      onClick={() => {
                        resetPassword.mutate(m.id, {
                          onSuccess: (d) => showLink(m.id, d.resetLink),
                        })
                      }}
                    >
                      <KeyRound aria-hidden="true" />
                      {t('admin.members.resetPassword')}
                    </Button>
                  )}

                  {/* Destructive actions, grouped behind one menu */}
                  {(canResetMfa || canDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={t('admin.members.moreActions', { name: m.displayName })}>
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-auto">
                        {/* Reset 2FA — locked-out account recovery */}
                        {canResetMfa && (
                          <DropdownMenuItem variant="destructive" onSelect={() => setResetMfaId(m.id)}>
                            <ShieldOff aria-hidden="true" />
                            {t('admin.members.resetMfa')}
                          </DropdownMenuItem>
                        )}
                        {/* Delete (anyone but self and the seed admin) */}
                        {canDelete && (
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeletingId(m.id)}>
                            <Trash2 aria-hidden="true" />
                            {t('admin.members.delete')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(o) => { if (!o) { setDeletingId(null); deleteMember.reset() } }}
        title={t('admin.members.deleteConfirmTitle')}
        description={t('admin.members.deleteConfirmDesc')}
        onConfirm={handleConfirmDelete}
        loading={deleteMember.isPending}
        error={deleteMember.isError ? formatApiError(deleteMember.error, t) : undefined}
        variant="destructive"
        // Activated members own private data; require retyping their name.
        confirmPhrase={
          members?.find((m) => m.id === deletingId)?.activated
            ? members.find((m) => m.id === deletingId)?.displayName
            : undefined
        }
      />

      <ConfirmDialog
        open={resetMfaId !== null}
        onOpenChange={(o) => { if (!o) setResetMfaId(null) }}
        title={t('admin.members.resetMfaConfirmTitle')}
        description={t('admin.members.resetMfaConfirmDesc')}
        onConfirm={handleConfirmResetMfa}
        loading={forceDisableMfa.isPending}
        variant="destructive"
      />
    </SettingsCard>
  )
}
