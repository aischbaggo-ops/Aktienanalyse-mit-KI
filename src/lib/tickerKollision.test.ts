import { describe, expect, it } from 'vitest'
import { mitVorschlaegen, ohneVerdaechtige } from './tickerKollision'
import type { TickerKollision } from './webhooks'

const k = (eingabe: string, vorschlag: string): TickerKollision => ({
  eingabe,
  gefunden: 'Fremde Firma Inc.',
  waehrung: 'USD',
  land: 'US',
  vorschlag,
  vorschlag_name: 'Gemeinte AG',
  meldung: `${eingabe} ist Fremde Firma Inc. (USD, US). Gemeint war vermutlich ${vorschlag} - Gemeinte AG.`,
})

describe('Verwechselte Kürzel', () => {
  const kollisionen = [k('ADS', 'ADS.DE'), k('ALV', 'ALV.DE')]

  it('nimmt verdächtige Kürzel aus der Vorauswahl, lässt sie aber in der Liste', () => {
    const bestaetigt = ['NVDA', 'ADS', 'MSFT', 'ALV']
    expect(ohneVerdaechtige(bestaetigt, kollisionen)).toEqual(['NVDA', 'MSFT'])
  })

  it('ohne Verwechslung bleibt alles vorausgewählt', () => {
    expect(ohneVerdaechtige(['NVDA', 'MSFT'], [])).toEqual(['NVDA', 'MSFT'])
  })

  it('übernimmt die Vorschläge und behält die Reihenfolge', () => {
    expect(mitVorschlaegen(['NVDA', 'ADS', 'ALV'], kollisionen)).toEqual(['NVDA', 'ADS.DE', 'ALV.DE'])
  })

  it('erzeugt keine Dubletten, wenn beide Schreibweisen eingegeben wurden', () => {
    expect(mitVorschlaegen(['ADS.DE', 'ADS'], kollisionen)).toEqual(['ADS.DE'])
  })

  it('lässt unbeteiligte Ticker unangetastet', () => {
    expect(mitVorschlaegen(['NVDA', 'BRK.B'], kollisionen)).toEqual(['NVDA', 'BRK.B'])
  })
})
