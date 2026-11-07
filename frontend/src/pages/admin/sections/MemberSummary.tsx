import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import type { FamilyMemberItem } from '@/features/family/api'
import { deriveMonogram } from '@/lib/utils'
import { StatusText } from '../components/SettingsBlocks'

const STATUS_TONE = { statusAdmin: 'neutral', statusActive: 'ok', statusPending: 'warn', statusManaged: 'neutral' } as const

/** Who a member is, their account status and how they sign in: the leading part of a member row. */
export function MemberSummary({ member: m, isSelf }: { member: FamilyMemberItem; isSelf: boolean }) {
  const { t } = useTranslation()
  const isAdminMember = !m.managed
  const status = isAdminMember
    ? 'statusAdmin'
    : m.activated
      ? 'statusActive'
      : m.hasLogin
        ? 'statusPending'
        : 'statusManaged'

  return (
    <>
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
          <StatusText tone={STATUS_TONE[status]}>{t(`admin.members.${status}`)}</StatusText>
          {m.mfaEnabled && (
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <ShieldCheck className="size-3.5 text-gain" aria-hidden="true" />
              {t('admin.members.mfaOn')}
            </span>
          )}
        </p>
        {(m.hasPassword || m.ssoLinked) && (
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            {m.hasPassword && <span className="rounded-md bg-muted px-1.5 text-xs text-muted-foreground">{t('admin.members.signInPassword')}</span>}
            {m.ssoLinked && <span className="rounded-md bg-muted px-1.5 text-xs text-muted-foreground">{t('admin.members.signInSso')}</span>}
          </p>
        )}
      </div>
    </>
  )
}
