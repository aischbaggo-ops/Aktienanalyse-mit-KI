import { describe, expect, it } from 'vitest'
import { presenceStatus, validateUsername } from './userActivity'

describe('validateUsername', () => {
  it('akzeptiert gültige Namen', () => {
    expect(validateUsername('Alice_01')).toBeNull()
    expect(validateUsername('a-b')).toBeNull()
    expect(validateUsername('x'.repeat(24))).toBeNull()
  })
  it('lehnt leer, Leerzeichen, Länge und Sonderzeichen ab', () => {
    expect(validateUsername('')).not.toBeNull()
    expect(validateUsername('   ')).not.toBeNull()
    expect(validateUsername('a b c')).toMatch(/Leerzeichen/)
    expect(validateUsername('ab')).toMatch(/3 bis 24/)
    expect(validateUsername('x'.repeat(25))).toMatch(/3 bis 24/)
    expect(validateUsername('nö!')).toMatch(/Erlaubt/)
  })
})

describe('presenceStatus', () => {
  const now = new Date('2026-09-21T12:00:00Z').getTime()
  const ago = (ms: number) => new Date(now - ms).toISOString()

  it('null => noch nie aktiv', () => {
    expect(presenceStatus(null, now)).toEqual({ online: false, label: 'noch nie aktiv' })
  })
  it('unter 3 Minuten => online', () => {
    expect(presenceStatus(ago(30_000), now).online).toBe(true)
    expect(presenceStatus(ago(179_000), now).online).toBe(true)
  })
  it('ab 3 Minuten => relative Zeit', () => {
    expect(presenceStatus(ago(180_000), now)).toEqual({ online: false, label: 'zuletzt aktiv vor 3 Min' })
    expect(presenceStatus(ago(2 * 3600_000), now).label).toBe('zuletzt aktiv vor 2 Std')
    expect(presenceStatus(ago(3 * 86400_000), now).label).toBe('zuletzt aktiv vor 3 Tagen')
  })
})
