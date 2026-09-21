import { describe, expect, it } from 'vitest'
import { buildAccessRequest } from './accessRequest'

describe('buildAccessRequest', () => {
  it('lehnt einen fehlenden oder leeren Kontaktweg ab', () => {
    expect('error' in buildAccessRequest({ name: 'A', contact: '', message: 'x' })).toBe(true)
    expect('error' in buildAccessRequest({ name: '', contact: '   ', message: '' })).toBe(true)
  })

  it('akzeptiert nur den Kontaktweg, leere Felder werden NULL', () => {
    expect(buildAccessRequest({ name: '', contact: ' 0170 123456 ', message: '  ' })).toEqual({
      payload: { name: null, contact: '0170 123456', message: null },
    })
  })

  it('erzwingt kein E-Mail-Format', () => {
    expect('payload' in buildAccessRequest({ name: '', contact: '@signal_handle', message: '' })).toBe(true)
  })

  it('übernimmt Name und Nachricht getrimmt', () => {
    expect(buildAccessRequest({ name: ' Anna ', contact: 'a@b.de', message: ' kenne dich von X ' })).toEqual({
      payload: { name: 'Anna', contact: 'a@b.de', message: 'kenne dich von X' },
    })
  })

  it('lehnt zu lange Eingaben ab', () => {
    expect('error' in buildAccessRequest({ name: '', contact: 'x'.repeat(201), message: '' })).toBe(true)
    expect('error' in buildAccessRequest({ name: 'n'.repeat(101), contact: 'x', message: '' })).toBe(true)
    expect('error' in buildAccessRequest({ name: '', contact: 'x', message: 'm'.repeat(2001) })).toBe(true)
  })
})
