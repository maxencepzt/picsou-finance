export type Theme = 'light' | 'dark' | 'system'

/** Dark is Picsou's primary theme ("Coffre Nocturne"); light and system stay one setting away. */
export const DEFAULT_THEME: Theme = 'dark'

export function getStoredTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) ?? DEFAULT_THEME
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)
  }
  localStorage.setItem('theme', theme)
}

export function initSystemThemeListener() {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredTheme() === 'system') applyTheme('system')
  })
}
