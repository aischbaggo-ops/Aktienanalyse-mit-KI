import { describe, expect, it } from 'vitest'
import { REMOVE_CHUNK_SIZE, chunk, removalConfirmText, removalOutcome } from './watchlistRemoval'

describe('chunk', () => {
  it('teilt in Stuecke gegebener Groesse, der Rest bleibt', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
    expect(chunk(['A'], 50)).toEqual([['A']])
  })

  it('eine volle Auswahl (100) braucht zwei Anfragen', () => {
    const hundert = Array.from({ length: 100 }, (_, i) => `T${i}`)
    expect(chunk(hundert, REMOVE_CHUNK_SIZE)).toHaveLength(2)
  })
})

describe('removalOutcome', () => {
  it('alles entfernt: kein Fehler, nichts fehlt', () => {
    const r = removalOutcome(['AAPL', 'MSFT'], ['MSFT', 'AAPL'], null)
    expect(r.error).toBeNull()
    expect(r.missing).toEqual([])
    expect(r.removed).toHaveLength(2)
  })

  it('stilles Nicht-Loeschen (Row-Level-Security) wird als Fehler gemeldet', () => {
    // Supabase liefert hier KEINEN Fehler, nur weniger Zeilen zurueck.
    const r = removalOutcome(['AAPL', 'MSFT', 'KO'], ['AAPL'], null)
    expect(r.missing).toEqual(['MSFT', 'KO'])
    expect(r.error).toBe('Nur 1 von 3 entfernt (MSFT, KO sind noch auf der Watchlist).')
  })

  it('nennt hoechstens fuenf Ticker und zaehlt den Rest', () => {
    const viele = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const r = removalOutcome(viele, [], null)
    expect(r.error).toBe('Nur 0 von 8 entfernt (A, B, C, D, E und 3 weitere sind noch auf der Watchlist).')
  })

  it('Datenbankfehler: Meldung mit Ursache, bisher Entferntes bleibt erfasst', () => {
    const r = removalOutcome(['AAPL', 'MSFT', 'KO'], ['AAPL'], 'permission denied')
    expect(r.error).toBe('Entfernen fehlgeschlagen: permission denied')
    expect(r.removed).toEqual(['AAPL'])
    expect(r.missing).toEqual(['MSFT', 'KO'])
  })

  it('leere Anfrage ist kein Fehler', () => {
    expect(removalOutcome([], [], null)).toEqual({ removed: [], missing: [], error: null })
  })
})

describe('removalConfirmText', () => {
  it('nennt Anzahl und Werte und sagt, dass die Analysen bleiben', () => {
    const t = removalConfirmText(['DASH', 'HOOD'])
    expect(t).toContain('2 Werte von der Watchlist entfernen?')
    expect(t).toContain('DASH, HOOD')
    expect(t).toContain('Die Analysen bleiben erhalten')
  })

  it('Einzahl bei einem Wert', () => {
    expect(removalConfirmText(['UBER'])).toContain('1 Wert von der Watchlist entfernen?')
  })

  it('kuerzt lange Listen auf zwoelf und zaehlt den Rest', () => {
    const viele = Array.from({ length: 34 }, (_, i) => `T${i}`)
    const t = removalConfirmText(viele)
    expect(t).toContain('34 Werte')
    expect(t).toContain('T0, T1')
    expect(t).toContain('T11 und 22 weitere')
    expect(t).not.toContain('T12,')
  })
})
