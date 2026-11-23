import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminPage } from './AdminPage'

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', resolvedLanguage: 'en' } }) }))
vi.mock('@/features/admin/hooks', () => ({ useAdminSettings: () => ({ data: {}, isLoading: false }) }))
vi.mock('./sections/MembersSection', () => ({ MembersSection: () => null }))
vi.mock('./sections/SecuritySection', () => ({ SecuritySection: () => null }))
vi.mock('./sections/EnableBankingSection', () => ({ EnableBankingSection: () => null }))
vi.mock('./sections/EnableBankingDebugSection', () => ({ EnableBankingDebugSection: () => null }))
vi.mock('./sections/AiCategorizationSection', () => ({ AiCategorizationSection: () => null }))
vi.mock('./sections/AiActivitySection', () => ({ AiActivitySection: () => null }))
vi.mock('./sections/IntegrationsSection', () => ({ IntegrationsSection: () => null }))
vi.mock('./sections/TelemetrySection', () => ({ TelemetrySection: () => null }))

describe('AdminPage', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('scrolls to the section named in the address once the sections exist', () => {
    window.history.replaceState(null, '', '/admin#enable-banking')
    const scrolled: string[] = []
    Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.id) }

    render(<AdminPage />)

    expect(scrolled).toEqual(['enable-banking'])
  })

  it('leaves the scroll alone without a known section in the address', () => {
    window.history.replaceState(null, '', '/admin#nowhere')
    const scrolled: string[] = []
    Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.id) }

    render(<AdminPage />)

    expect(scrolled).toEqual([])
  })
})
