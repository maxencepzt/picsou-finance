import { IdCard, Info, KeyRound, Paintbrush, Shield, User, Users } from 'lucide-react'

/** The settings sections, in navigation order. Family has its own route; every other one is `?section=`. */
export const SETTINGS_SECTIONS = [
  { id: 'appearance', labelKey: 'settings.appearance', descriptionKey: 'settings.appearanceDescription', icon: Paintbrush },
  { id: 'account', labelKey: 'settings.account', descriptionKey: 'settings.accountDescription', icon: User },
  { id: 'profile', labelKey: 'settings.profile.title', descriptionKey: 'settings.profile.description', icon: IdCard },
  { id: 'security', labelKey: 'settings.security', descriptionKey: 'settings.securityDescription', icon: Shield },
  { id: 'family', labelKey: 'settings.family', descriptionKey: 'settings.familyDescription', icon: Users },
  { id: 'mcp', labelKey: 'accessKeys.sectionTitle', descriptionKey: 'accessKeys.sectionDescription', icon: KeyRound },
  { id: 'about', labelKey: 'settings.about', descriptionKey: 'settings.aboutDescription', icon: Info },
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

export function settingsSectionHref(id: SettingsSectionId): string {
  return id === 'family' ? '/settings/family' : `/settings?section=${id}`
}

/** `?section=` of /settings: an unknown or missing value opens the first section. */
export function resolveSettingsSection(param: string | null): Exclude<SettingsSectionId, 'family'> {
  const match = SETTINGS_SECTIONS.find((s) => s.id === param && s.id !== 'family')
  return (match?.id ?? 'appearance') as Exclude<SettingsSectionId, 'family'>
}
