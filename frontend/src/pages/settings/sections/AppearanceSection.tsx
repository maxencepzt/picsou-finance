import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { Switch } from '@/components/ui/switch'
import { SUPPORTED_LOCALES, resolveLocale } from '@/i18n/locales'
import { type Theme, applyTheme, getStoredTheme } from '@/lib/theme'
import { useAppStore, type DateFormat, type SidebarStyle } from '@/stores/app-store'
import { SettingRow, SettingsCard } from '../SettingRow'

export function AppearanceSection() {
  const { t, i18n } = useTranslation()
  const { dateFormat, setDateFormat, sidebarStyle, setSidebarStyle, hideAmounts, setHideAmounts } = useAppStore()

  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // i18next persists the choice itself (localStorage key "picsou-locale").
  const [locale, setLocale] = useState(i18n.language)
  const handleLocaleChange = (lng: string) => {
    i18n.changeLanguage(lng)
    setLocale(lng)
  }

  return (
    <SettingsCard>
      <SettingRow label={t('settings.theme')} description={t('settings.themeHint')}>
        <SegmentedControl<Theme>
          ariaLabel={t('settings.theme')}
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
            { value: 'system', label: t('settings.themeSystem') },
          ]}
        />
      </SettingRow>

      <SettingRow label={t('settings.language')} description={t('settings.languageHint')}>
        <SegmentedControl
          ariaLabel={t('settings.language')}
          value={resolveLocale(locale).code}
          onChange={handleLocaleChange}
          options={SUPPORTED_LOCALES.map((l) => ({ value: l.code, label: l.label }))}
        />
      </SettingRow>

      <SettingRow label={t('settings.dateFormat')} description={t('settings.dateFormatHint')}>
        <SegmentedControl<DateFormat>
          ariaLabel={t('settings.dateFormat')}
          value={dateFormat}
          onChange={setDateFormat}
          options={[
            { value: 'locale', label: t('settings.dateFormatLocale') },
            { value: 'iso', label: t('settings.dateFormatIso') },
          ]}
        />
      </SettingRow>

      {/* Duplicated from the top bar's eye button on purpose: shoulder-surfing is likelier on a
          phone, and a setting is where people look for it. */}
      <SettingRow
        label={t('nav.hideAmounts')}
        description={t('settings.amountsHint')}
        htmlFor="settings-hide-amounts"
        className="flex-row items-center justify-between gap-4"
      >
        <Switch
          id="settings-hide-amounts"
          checked={hideAmounts}
          onCheckedChange={setHideAmounts}
          className="data-unchecked:bg-muted-foreground/35"
        />
      </SettingRow>

      <SettingRow label={t('settings.sidebarStyle')} description={t('settings.sidebarStyleHint')}>
        <SegmentedControl<SidebarStyle>
          ariaLabel={t('settings.sidebarStyle')}
          value={sidebarStyle}
          onChange={setSidebarStyle}
          options={[
            { value: 'current', label: t('settings.sidebarStyleCurrent') },
            { value: 'classic', label: t('settings.sidebarStyleClassic') },
          ]}
        />
      </SettingRow>
    </SettingsCard>
  )
}
