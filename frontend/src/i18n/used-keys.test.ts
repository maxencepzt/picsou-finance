import { describe, expect, it } from 'vitest'
import fr from './locales/fr.json'
import { ACCOUNT_TYPES } from '@/lib/constants'
import { PROVIDER_CATEGORIES } from '@/pages/sync/catalog'
import type { AccountType, PeerLoanRepaymentKind } from '@/types/api'

type Tree = string | Tree[] | { [key: string]: Tree }

// Every leaf and every object path (objects are read with returnObjects).
function collectPaths(tree: Tree, prefix: string, into: Set<string>): Set<string> {
  if (prefix) into.add(prefix)
  if (typeof tree !== 'string') {
    for (const [key, value] of Object.entries(tree)) collectPaths(value, prefix ? `${prefix}.${key}` : key, into)
  }
  return into
}

const known = collectPaths(fr as Tree, '', new Set())
const PLURAL_SUFFIXES = ['', '_zero', '_one', '_two', '_few', '_many', '_other']
const exists = (key: string) => PLURAL_SUFFIXES.some((suffix) => known.has(key + suffix))

// Keyed relative to this file (`../pages/…`); tests and the demo fixtures are not UI.
const sources = Object.entries(
  import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
).filter(([file]) => !/\.(test|spec)\.tsx?$/.test(file) && !file.startsWith('../demo/'))

const KEY = `([a-z][a-zA-Z0-9_]*(?:\\.[a-zA-Z0-9_]+)+)`
const PATTERNS = [
  // t('a.b'), i18n.t("a.b"), t(`a.b`) without interpolation
  new RegExp(`\\bt\\(\\s*['"\`]${KEY}['"\`]`, 'g'),
  // t(cond ? 'a.b' : 'c.d')
  new RegExp(`\\bt\\(\\s*[^'"\`()]+\\?\\s*'${KEY}'\\s*:\\s*'${KEY}'`, 'g'),
  // labelKey: 'a.b', descKey="a.b", i18nKey: 'a.b'
  new RegExp(`\\b(?:[a-z][a-zA-Z]*Key|i18nKey)\\s*[:=]\\s*\\{?\\s*['"]${KEY}['"]`, 'g'),
]

// Any other string literal under a top-level namespace: keys kept in maps (`WEEKLY: 'budget.…'`) or fallbacks.
const NAMESPACES = new Set(Object.keys(fr))
const ANY_LITERAL = new RegExp(`(?<![\\w$])(['"\`])${KEY}\\1`, 'g')

function usedKeys(): Map<string, string> {
  const used = new Map<string, string>()
  const record = (key: string | undefined, file: string) => {
    if (key && !used.has(key)) used.set(key, file.slice(3))
  }
  for (const [file, raw] of sources) {
    // Comments quote field paths (`realEstate.costBasis`) that are not keys.
    const text = raw.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '')
    for (const pattern of PATTERNS) {
      for (const match of text.matchAll(pattern)) match.slice(1).forEach((key) => record(key, file))
    }
    for (const [, , key] of text.matchAll(ANY_LITERAL)) if (NAMESPACES.has(key.split('.')[0])) record(key, file)
  }
  return used
}

describe('translation keys used in the source', () => {
  it('exist in fr.json', () => {
    const missing = [...usedKeys()].filter(([key]) => !exists(key)).map(([key, file]) => `${key} (${file})`)
    expect(missing).toEqual([])
  })
})

// Records, so tsc fails when a backend value is added to the union without being listed here.
const EVERY_ACCOUNT_TYPE: Record<AccountType, true> = {
  LEP: true, LIVRET_A: true, LDDS: true, LIVRET_JEUNE: true, PEL: true, CEL: true, PEA: true, COMPTE_TITRES: true,
  CRYPTO: true, CHECKING: true, SAVINGS: true, REAL_ESTATE: true, SCPI: true, LOAN: true, CREDIT_CARD: true,
  PEER_LOAN: true, EMPLOYEE_SAVINGS: true, ASSURANCE_VIE: true, PER: true, PRECIOUS_METALS: true, BROKERAGE: true, OTHER: true,
}
const EVERY_PEER_LOAN_KIND: Record<PeerLoanRepaymentKind, true> = { PRINCIPAL: true, INTEREST: true, WRITE_OFF: true }

describe('translation keys built from enumerable values', () => {
  it('label every account type', () => {
    const labelled = new Map(ACCOUNT_TYPES.map((type) => [type.value, type.labelKey]))
    const missing = Object.keys(EVERY_ACCOUNT_TYPE).filter((type) => !exists(labelled.get(type as AccountType) ?? ''))
    expect(missing).toEqual([])
  })

  it('label every sync catalog category and peer-loan repayment kind', () => {
    const keys = [
      ...['all', ...PROVIDER_CATEGORIES].map((c) => `sync.catalog.categories.${c}`),
      ...PROVIDER_CATEGORIES.map((c) => `sync.catalog.kind.${c}`),
      ...Object.keys(EVERY_PEER_LOAN_KIND).map((kind) => `peerLoan.kinds.${kind}`),
    ]
    expect(keys.filter((key) => !exists(key))).toEqual([])
  })
})
