import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MAX_AGE, maxAgeCostHint, readMaxAge, storeMaxAge } from './preferences'

// Minimaler Storage-Ersatz (Tests laufen ohne Browser).
function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('Dropdown "Aktie analysieren" für die Sitzung merken', () => {
  it('merkt "Immer neu laden" in sessionStorage, nicht dauerhaft in localStorage', () => {
    const session = fakeStorage()
    const local = fakeStorage()
    vi.stubGlobal('sessionStorage', session)
    vi.stubGlobal('localStorage', local)
    expect(readMaxAge()).toBe(DEFAULT_MAX_AGE)
    storeMaxAge('always')
    expect(readMaxAge()).toBe('always')
    expect(session.getItem('dashboard.maxAge')).toBe('always')
    expect(local.getItem('dashboard.maxAge')).toBeNull()
  })

  it('neue Sitzung, unbekannte Werte oder blockierter Speicher ergeben den Standard (7 Tage)', () => {
    vi.stubGlobal('sessionStorage', fakeStorage())
    expect(readMaxAge()).toBe('7')
    const s = fakeStorage()
    s.setItem('dashboard.maxAge', 'quatsch')
    vi.stubGlobal('sessionStorage', s)
    expect(readMaxAge()).toBe('7')
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blockiert')
      },
      setItem: () => {
        throw new Error('blockiert')
      },
    })
    expect(readMaxAge()).toBe('7')
    expect(() => storeMaxAge('always')).not.toThrow()
  })
})

describe('Kostenhinweis neben dem Dropdown', () => {
  it('erscheint nur bei "Immer neu laden"', () => {
    expect(maxAgeCostHint('always')).toContain('ca. 0,04 USD')
    expect(maxAgeCostHint('always')).toContain('Immer neu laden ist aktiv')
    expect(maxAgeCostHint('7')).toBeNull()
    expect(maxAgeCostHint('1')).toBeNull()
  })
})
