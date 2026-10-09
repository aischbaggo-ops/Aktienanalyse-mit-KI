import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MAX_AGE, readMaxAge, storeMaxAge } from './preferences'

// Minimaler localStorage-Ersatz (Tests laufen ohne Browser).
function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('Dropdown "Aktie analysieren" merken', () => {
  it('merkt "Immer neu laden" über einen Seitenwechsel hinweg', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(readMaxAge()).toBe(DEFAULT_MAX_AGE)
    storeMaxAge('always')
    expect(readMaxAge()).toBe('always')
  })

  it('unbekannte Werte und fehlender Speicher ergeben den Standard (7 Tage)', () => {
    const s = fakeStorage()
    s.setItem('dashboard.maxAge', 'quatsch')
    vi.stubGlobal('localStorage', s)
    expect(readMaxAge()).toBe('7')
    vi.stubGlobal('localStorage', {
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
