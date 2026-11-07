import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (key) => m.get(key) ?? null,
    setItem: (key, value) => void m.set(key, String(value)),
    removeItem: (key) => void m.delete(key),
    clear: () => m.clear(),
    key: (index) => [...m.keys()][index] ?? null,
    get length() { return m.size },
  } as Storage
}

vi.stubGlobal('localStorage', memoryStorage())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr', changeLanguage: () => {} },
  }),
}))

const { SidebarStylePromptModal } = await import('./SidebarStylePromptModal')
const { NAV_ITEMS } = await import('./sidebar-nav-items')

function sketch(optionLabel: string) {
  render(<SidebarStylePromptModal open onOpenChange={() => {}} />)
  const column = screen.getByRole('radio', { name: optionLabel }).querySelector<HTMLElement>('[data-slot="preview-sidebar"]')
  if (!column) throw new Error(`no sidebar sketch for ${optionLabel}`)
  const [header, nav, member] = Array.from(column.children)
  return { column, header, nav, member }
}

describe('SidebarStylePromptModal miniatures', () => {
  it('sketches the classic sidebar with the member row right under the routes, Settings last among them', () => {
    const { column, nav, member } = sketch('settings.sidebarStyleClassic')
    const rows = Array.from(nav.children)

    expect(column.children).toHaveLength(3)
    expect(member).not.toHaveClass('mt-auto')
    expect(member.children).toHaveLength(1)
    expect(member.querySelector('.lucide-chevron-down')).not.toBeNull()
    expect(rows).toHaveLength(NAV_ITEMS.length + 1)
    expect(rows.at(-1)?.querySelector('.lucide-settings')).not.toBeNull()
  })

  it('sketches the current sidebar with Sync, Settings and the member row pinned to the bottom', () => {
    const { nav, member } = sketch('settings.sidebarStyleCurrent')

    expect(member).toHaveClass('mt-auto')
    expect(member.querySelector('.lucide-refresh-cw')).not.toBeNull()
    expect(member.querySelector('.lucide-settings')).not.toBeNull()
    expect(nav.children).toHaveLength(NAV_ITEMS.length)
  })

  it.each(['settings.sidebarStyleClassic', 'settings.sidebarStyleCurrent'])(
    'draws %s with the logo on top and single-line nav rows',
    (label) => {
      const { header, nav } = sketch(label)

      expect(header.firstElementChild?.tagName).toBe('IMG')
      for (const row of Array.from(nav.children)) {
        expect(row.children).toHaveLength(2)
      }
    },
  )
})
