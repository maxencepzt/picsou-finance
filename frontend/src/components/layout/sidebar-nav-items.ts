import {
  Building2,
  Coins,
  Compass,
  LayoutDashboard,
  LineChart,
  PieChart,
  RefreshCw,
  Settings,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/** The primary destinations, in sidebar order. Mobile shows the first entries and folds the rest into "More". */
export const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/accounts', icon: Wallet, labelKey: 'nav.accounts' },
  { path: '/investments', icon: LineChart, labelKey: 'nav.investments' },
  { path: '/income', icon: Coins, labelKey: 'nav.income' },
  { path: '/budget', icon: PieChart, labelKey: 'nav.budget' },
  { path: '/real-estate', icon: Building2, labelKey: 'nav.realEstate' },
  { path: '/goals', icon: Target, labelKey: 'nav.goals' },
  { path: '/analysis', icon: Compass, labelKey: 'nav.analysis' },
] as const

export const FAMILY_NAV_ITEM = { path: '/family', icon: Users, labelKey: 'nav.family' } as const

export const SYNC_NAV_ITEM = { path: '/sync', icon: RefreshCw, labelKey: 'nav.sync' } as const

// The "classic" sidebar style lists Settings with the routes instead of beside the profile row.
export const CLASSIC_SETTINGS_NAV_ITEM = { path: '/settings', icon: Settings, labelKey: 'nav.settings' } as const

export type NavEntry = { path: string; icon: LucideIcon; labelKey: string }

/** Active when the location is the entry or below it; the root only matches itself. */
export function isNavActive(pathname: string, path: string): boolean {
  return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)
}
