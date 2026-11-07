import { NavLink, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, LogOut, RefreshCw, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFamilyMembers } from '@/features/family/hooks'
import { selectSwitchableMembers } from '@/features/family/members'
import { useAuthStore } from '@/stores/auth-store'
import { useAppStore } from '@/stores/app-store'
import { useLogout } from '@/features/auth/hooks'
import { useProfileStore } from '@/stores/profile-store'
import { cn } from '@/lib/utils'
import picsouLogo from '@/assets/horizontal-white-picsou.svg'
import { NAV_ITEMS, CLASSIC_SETTINGS_NAV_ITEM, SYNC_NAV_ITEM, isNavActive } from './sidebar-nav-items'

function AccountMenuFooterItems({
  isAdmin,
  onAdminClick,
  onLogoutClick,
  logoutPending,
}: {
  isAdmin: boolean
  onAdminClick: () => void
  onLogoutClick: () => void
  logoutPending: boolean
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const syncActive = location.pathname.startsWith('/sync')
  return (
    <>
      <DropdownMenuItem asChild className={cn(syncActive && 'bg-muted text-foreground')}>
        <NavLink to="/sync">
          <RefreshCw className="size-4" aria-hidden="true" />
          <span>{t('nav.sync')}</span>
        </NavLink>
      </DropdownMenuItem>

      {isAdmin && (
        <DropdownMenuItem onClick={onAdminClick}>
          <Shield className="size-4" aria-hidden="true" />
          <span>{t('nav.admin')}</span>
        </DropdownMenuItem>
      )}

      <DropdownMenuItem onClick={onLogoutClick} disabled={logoutPending}>
        <LogOut className="size-4" aria-hidden="true" />
        <span>{t('settings.logout')}</span>
      </DropdownMenuItem>
    </>
  )
}

/** One 40px row: icon and label, the active row tinted with the primary colour. */
function NavItem({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  const { pathname } = useLocation()
  const active = isNavActive(pathname, to)
  return (
    <NavLink
      to={to}
      end={to === '/'}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-[background-color,color]',
        active ? 'bg-primary/12 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className={cn('size-[18px] shrink-0', active && 'text-primary')} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

export function AppSidebar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const demoMode = useAppStore((s) => s.demoMode)
  const sidebarStyle = useAppStore((s) => s.sidebarStyle)
  const activeMemberId = useProfileStore((s) => s.activeMemberId)
  const setActiveMember = useProfileStore((s) => s.setActiveMember)
  const canSwitchProfile = !demoMode && user?.role === 'ADMIN'
  const isAdmin = user?.role === 'ADMIN'
  const { data: familyMembers = [] } = useFamilyMembers({ enabled: canSwitchProfile })
  const switchableMembers = selectSwitchableMembers(familyMembers)
  const activeMember = switchableMembers.find((member) => member.id === activeMemberId)
  const displayName = demoMode ? 'Demo' : user?.displayName ?? ''
  const activeDisplayName = activeMember?.displayName ?? (activeMemberId ? t('nav.unknownProfile') : displayName)
  const activeDescription = activeMemberId ? t('nav.managedProfile') : demoMode ? 'Demo' : t('nav.account')
  const initial = displayName.charAt(0).toUpperCase()
  const activeInitial = activeDisplayName.charAt(0).toUpperCase()
  const activeProfileValue = activeMemberId == null ? 'own' : `member-${activeMemberId}`
  const logoutMutation = useLogout()
  // Classic keeps Settings among the routes and the profile row right under them;
  // the default pins Sync, Settings and the profile to the bottom of the column.
  const isClassic = sidebarStyle === 'classic'
  const navItems = isClassic ? [...NAV_ITEMS, CLASSIC_SETTINGS_NAV_ITEM] : NAV_ITEMS
  const triggerLabel = isClassic && canSwitchProfile ? t('nav.switchProfile') : t('nav.account')

  function handleProfileValueChange(value: string) {
    const nextMemberId = value === 'own' ? null : Number(value.replace('member-', ''))
    if (nextMemberId !== null && !Number.isFinite(nextMemberId)) return
    if (nextMemberId === activeMemberId) return
    setActiveMember(nextMemberId)
    void queryClient.invalidateQueries()
  }

  const profileMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-[background-color] hover:bg-muted"
        >
          <Avatar className="size-8 shrink-0 rounded-full">
            <AvatarFallback
              className={cn('text-xs font-bold', activeMember ? 'text-white' : 'bg-primary/12 text-foreground')}
              style={activeMember ? { backgroundColor: activeMember.avatarColor } : undefined}
            >
              {activeInitial}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{activeDisplayName}</span>
            <span className="block truncate text-xs text-muted-foreground">{activeDescription}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side={isClassic ? 'bottom' : 'top'} align="start" className="w-64">
        {isClassic && (
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              {demoMode && <p className="text-xs text-muted-foreground">{t('auth.demoMode')}</p>}
            </div>
          </DropdownMenuLabel>
        )}
        {canSwitchProfile && switchableMembers.length > 0 && (
          <>
            {isClassic && <DropdownMenuSeparator />}
            <DropdownMenuRadioGroup value={activeProfileValue} onValueChange={handleProfileValueChange}>
              <DropdownMenuRadioItem value="own">
                <Avatar className="size-8 shrink-0 rounded-full">
                  <AvatarFallback className="bg-muted text-xs font-bold text-muted-foreground">{initial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{t('nav.account')}</p>
                </div>
              </DropdownMenuRadioItem>
              {switchableMembers.map((member) => (
                <DropdownMenuRadioItem key={member.id} value={`member-${member.id}`}>
                  <span
                    className="size-8 shrink-0 rounded-full"
                    style={{ backgroundColor: member.avatarColor }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{t('nav.managedProfile')}</p>
                  </div>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        {(isClassic || (canSwitchProfile && switchableMembers.length > 0)) && <DropdownMenuSeparator />}
        <AccountMenuFooterItems
          isAdmin={isAdmin}
          onAdminClick={() => navigate('/admin')}
          onLogoutClick={() => logoutMutation.mutate()}
          logoutPending={logoutMutation.isPending}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <nav
      aria-label={t('nav.main')}
      className="hidden h-screen w-58 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex"
    >
      <img src={picsouLogo} alt="Picsou" className="mb-6 ml-3 h-7 w-auto self-start opacity-90 brightness-0 dark:invert" />

      <div className="flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavItem key={item.path} to={item.path} icon={item.icon} label={t(item.labelKey)} />
        ))}
      </div>

      {isClassic ? (
        <div className="mt-3 border-t border-sidebar-border pt-3">{profileMenu}</div>
      ) : (
        <div className="mt-auto flex flex-col gap-0.5">
          <NavItem to={SYNC_NAV_ITEM.path} icon={SYNC_NAV_ITEM.icon} label={t(SYNC_NAV_ITEM.labelKey)} />
          <NavItem
            to={CLASSIC_SETTINGS_NAV_ITEM.path}
            icon={CLASSIC_SETTINGS_NAV_ITEM.icon}
            label={t(CLASSIC_SETTINGS_NAV_ITEM.labelKey)}
          />
          <div className="mt-2 border-t border-sidebar-border pt-3">{profileMenu}</div>
        </div>
      )}
    </nav>
  )
}
