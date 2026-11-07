import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Link as LinkIcon, Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  useFamilyMembers,
  useCreateMember,
  useDeleteMember,
  useGenerateActivationLink,
  useSharingSettings,
  useUpdateSharingSettings,
} from '@/features/family/hooks'
import type { FamilyMemberItem } from '@/features/family/api'
import { useAccounts } from '@/features/accounts/hooks'
import { useGoals } from '@/features/goals/hooks'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { formatApiError } from '@/lib/errors'
import { logoKeyUrl, providerLogoUrl } from '@/lib/provider-logos'
import { cn, deriveMonogram } from '@/lib/utils'
import type { Account } from '@/types/api'
import { SettingsShell } from './SettingsShell'
import { ROW_BUTTON, SettingRow, SettingsCard, StatusDot } from './SettingRow'

export function FamilySettingsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN')

  return (
    <SettingsShell active="family">
      {isAdmin && <MemberManagement />}
      <SharingSection />
    </SettingsShell>
  )
}

/** Where a member stands: an independent login, an invitation not yet used, a managed profile, the admin. */
function memberStatus(member: FamilyMemberItem): { tone: 'on' | 'warn' | 'off'; key: string; independent: boolean } {
  const independent = member.managed && member.hasLogin && member.activated
  if (independent) return { tone: 'on', key: 'family.settings.memberIndependent', independent }
  if (!member.managed) return { tone: 'off', key: 'family.settings.memberAdmin', independent }
  if (member.hasLogin) return { tone: 'warn', key: 'family.settings.memberPending', independent }
  return { tone: 'off', key: 'family.settings.memberManaged', independent }
}

function MemberManagement() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const { data: members, isLoading } = useFamilyMembers()
  const createMember = useCreateMember()
  const deleteMember = useDeleteMember()
  const generateLink = useGenerateActivationLink()
  const [newName, setNewName] = useState('')
  const [activationLink, setActivationLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Independent members own private data; deletion is irreversible, so we require
  // the admin to retype the display name before the destructive call is enabled.
  const [memberToDelete, setMemberToDelete] = useState<
    { id: number; displayName: string; independent: boolean } | null
  >(null)

  function addMember() {
    if (!newName.trim()) return
    createMember.mutate({ displayName: newName.trim() })
    setNewName('')
  }

  function invite(id: number) {
    generateLink.mutate(id, {
      onSuccess: (data) => {
        setActivationLink(data.activationLink)
        setCopied(false)
      },
    })
  }

  const fullLink = activationLink ? `${window.location.origin}${activationLink}` : ''

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be unavailable over plain HTTP; the link stays selectable */
    }
  }

  return (
    <SettingsCard title={t('family.settings.members')} description={t('family.settings.membersDesc')}>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : members && members.length > 0 && (
        <ul className="divide-y divide-border">
          {members.map((member) => {
            const isOwnProfile = member.id === user?.memberId
            const status = memberStatus(member)
            const canInvite = !status.independent && member.managed && !member.hasLogin
            const canReinvite = !status.independent && !member.activated && member.hasLogin
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-on-class"
                  style={{ backgroundColor: member.avatarColor }}
                  aria-hidden="true"
                >
                  {deriveMonogram(member.displayName)}
                </span>
                {/* The min width pushes the actions onto their own line on a phone, rather than squeezing the name. */}
                <div className="min-w-40 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{member.displayName}</span>
                    {isOwnProfile && <Badge variant="secondary">{t('family.settings.you')}</Badge>}
                  </div>
                  <StatusDot tone={status.tone}>{t(status.key)}</StatusDot>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {(canInvite || canReinvite) && (
                    <Button
                      variant="outline"
                      size="xs"
                      className={ROW_BUTTON}
                      onClick={() => invite(member.id)}
                      disabled={generateLink.isPending && generateLink.variables === member.id}
                    >
                      <LinkIcon aria-hidden="true" />
                      {canInvite ? t('family.settings.createLogin') : t('family.settings.regenerateLink')}
                    </Button>
                  )}
                  {!isOwnProfile && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive hover:text-destructive pointer-coarse:size-10"
                      aria-label={`${t('common.labelColon', { label: t('family.settings.deleteMemberTitle') })} ${member.displayName}`}
                      onClick={() =>
                        setMemberToDelete({
                          id: member.id,
                          displayName: member.displayName,
                          independent: status.independent,
                        })
                      }
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* The invitation to pass on: the activation link of the member just given a login. */}
      {activationLink && (
        <div className="space-y-1.5 py-3">
          <p className="text-[13px] font-medium text-foreground">{t('family.settings.activationLink')}</p>
          <div className="flex flex-col gap-2 @md:flex-row @md:items-center">
            <code className="flex min-h-9 flex-1 items-center break-all rounded-lg bg-muted px-3 py-1.5 font-mono text-xs text-foreground">
              {fullLink}
            </code>
            <Button variant="outline" size="xs" className={cn(ROW_BUTTON, 'self-start @md:self-auto')} onClick={copyLink}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? t('settings.mfaCopied') : t('settings.mfaCopy')}
            </Button>
          </div>
        </div>
      )}

      <form
        className="flex gap-2 pt-3"
        onSubmit={(e) => {
          e.preventDefault()
          addMember()
        }}
      >
        <Input
          aria-label={t('family.settings.memberName')}
          placeholder={t('family.settings.memberName')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="h-9 min-w-0 flex-1 px-3 pointer-coarse:h-10"
        />
        <Button type="submit" size="xs" className="h-9 px-3 pointer-coarse:h-10" disabled={!newName.trim()}>
          <Plus aria-hidden="true" />
          {t('common.add')}
        </Button>
      </form>

      <ConfirmDialog
        open={memberToDelete !== null}
        onOpenChange={(open) => { if (!open) { setMemberToDelete(null); deleteMember.reset() } }}
        title={t('family.settings.deleteMemberTitle')}
        description={t('family.settings.deleteMemberWarning', { name: memberToDelete?.displayName })}
        onConfirm={() => {
          if (memberToDelete) {
            // Close only on success — on error the dialog stays open and shows why.
            deleteMember.mutate(memberToDelete.id, {
              onSuccess: () => setMemberToDelete(null),
            })
          }
        }}
        loading={deleteMember.isPending}
        error={deleteMember.isError ? formatApiError(deleteMember.error, t) : undefined}
        variant="destructive"
        // Independent members own private data; require retyping their name.
        confirmPhrase={memberToDelete?.independent ? memberToDelete.displayName : undefined}
      />
    </SettingsCard>
  )
}

function SharingSection() {
  const { t } = useTranslation()

  return (
    <SettingsCard title={t('family.settings.sharing')} description={t('family.settings.sharingDesc')}>
      <SharingRow resourceType="ACCOUNT" title={t('family.settings.shareAccounts')} />
      <SharingRow resourceType="GOAL" title={t('family.settings.shareGoals')} />
    </SettingsCard>
  )
}

type SharingLevel = 'NONE' | 'ALL' | 'MANUAL'

/** A bank logo with the monogram behind it, for the account picker. */
function AccountMark({ account }: { account: Account }) {
  const src = logoKeyUrl(account.logoKey) ?? account.logoUrl ?? providerLogoUrl(account.provider)
  return (
    <Avatar className={cn('size-6 rounded-md after:rounded-md', src && 'bg-white')}>
      {src && <AvatarImage src={src} alt="" className="rounded-md object-contain p-0.5" />}
      <AvatarFallback className="rounded-md text-[10px] font-bold text-foreground">
        {deriveMonogram(account.name)}
      </AvatarFallback>
    </Avatar>
  )
}

function SharingRow({ resourceType, title }: { resourceType: 'ACCOUNT' | 'GOAL'; title: string }) {
  const { t } = useTranslation()
  const { data: settings, isLoading } = useSharingSettings(resourceType)
  const updateSettings = useUpdateSharingSettings()
  const { data: accounts } = useAccounts()
  const { data: goals } = useGoals()

  if (isLoading) {
    return (
      <div className="py-3 first:pt-0 last:pb-0">
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  const items: { id: number; name: string; account?: Account }[] | undefined =
    resourceType === 'ACCOUNT' ? accounts?.map((a) => ({ id: a.id, name: a.name, account: a })) : goals
  const currentLevel: SharingLevel = settings?.sharingLevel || 'NONE'

  function handleLevelChange(level: SharingLevel) {
    updateSettings.mutate({
      resourceType,
      sharingLevel: level,
      sharedResourceIds: level === 'MANUAL' ? settings?.sharedResourceIds?.filter(id => id !== -1) : undefined,
    })
  }

  function toggleResource(id: number) {
    const currentIds = (settings?.sharedResourceIds || []).filter(i => i !== -1)
    const newIds = currentIds.includes(id)
      ? currentIds.filter(i => i !== id)
      : [...currentIds, id]
    updateSettings.mutate({ resourceType, sharingLevel: 'MANUAL', sharedResourceIds: newIds })
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <SettingRow label={title} className="py-0">
        <SegmentedControl<SharingLevel>
          ariaLabel={title}
          value={currentLevel}
          onChange={handleLevelChange}
          options={[
            { value: 'NONE', label: t('family.settings.shareNone') },
            { value: 'ALL', label: t('family.settings.shareAll') },
            { value: 'MANUAL', label: t('family.settings.shareManual') },
          ]}
        />
      </SettingRow>

      {currentLevel === 'MANUAL' && items && (
        <ul className="mt-3 max-h-64 overflow-y-auto rounded-xl bg-muted/50 p-1">
          {items.map((item) => {
            const id = `share-${resourceType}-${item.id}`
            return (
              <li key={item.id}>
                <label
                  htmlFor={id}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-foreground hover:bg-muted"
                >
                  <Checkbox
                    id={id}
                    className="border-muted-foreground/60"
                    checked={(settings?.sharedResourceIds || []).includes(item.id)}
                    onCheckedChange={() => toggleResource(item.id)}
                  />
                  {item.account && <AccountMark account={item.account} />}
                  <span className="min-w-0 truncate">{item.name}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
