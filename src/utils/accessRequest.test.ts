import { describe, expect, it } from 'vitest'
import { buildAccessRequest } from './accessRequest'

const base = { name: '', email: 'a@b.de', contact: '0170 123456', message: '' }

describe('buildAccessRequest', () => {
  it('lehnt eine fehlende oder leere E-Mail-Adresse ab', () => {
    expect('error' in buildAccessRequest({ ...base, email: '' })).toBe(true)
    expect('error' in buildAccessRequest({ ...base, email: '   ' })).toBe(true)
  })

  it('lehnt eine E-Mail-Adresse ohne gueltiges Format ab', () => {
    expect('error' in buildAccessRequest({ ...base, email: '@signal_handle' })).toBe(true)
    expect('error' in buildAccessRequest({ ...base, email: 'keine-email' })).toBe(true)
    expect('error' in buildAccessRequest({ ...base, email: 'a@b' })).toBe(true)
  })

  it('lehnt einen fehlenden oder leeren Kontaktweg ab', () => {
    expect('error' in buildAccessRequest({ ...base, contact: '' })).toBe(true)
    expect('error' in buildAccessRequest({ ...base, contact: '   ' })).toBe(true)
  })

  it('akzeptiert E-Mail + Kontaktweg, leere optionale Felder werden NULL', () => {
    expect(buildAccessRequest({ name: '', email: ' a@b.de ', contact: ' 0170 123456 ', message: '  ' })).toEqual({
      payload: { name: null, email: 'a@b.de', contact: '0170 123456', message: null },
    })
  })

  it('erzwingt beim Kontaktweg (anders als bei E-Mail) kein E-Mail-Format', () => {
    expect('payload' in buildAccessRequest({ ...base, contact: '@signal_handle' })).toBe(true)
  })

  it('übernimmt Name und Nachricht getrimmt', () => {
    expect(buildAccessRequest({ ...base, name: ' Anna ', message: ' kenne dich von X ' })).toEqual({
      payload: { name: 'Anna', email: 'a@b.de', contact: '0170 123456', message: 'kenne dich von X' },
    })
  })

  it('lehnt zu lange Eingaben ab', () => {
    expect('error' in buildAccessRequest({ ...base, email: `${'x'.repeat(250)}@b.de` })).toBe(true)
    expect('error' in buildAccessRequest({ ...base, contact: 'x'.repeat(201) })).toBe(true)
    expect('error' in buildAccessRequest({ ...base, name: 'n'.repeat(101) })).toBe(true)
    expect('error' in buildAccessRequest({ ...base, message: 'm'.repeat(2001) })).toBe(true)
  })
})
