import type { TickerKollision } from './webhooks'

// Umgang mit verwechselten Kürzeln in "Ticker erkennen". Eigenes Modul, weil
// es der Teil ist, der im Ernstfall zählt: am 21.10.2026 wurden die DAX- und
// MDAX-Listen ohne ".DE" eingefügt, FMP lieferte zu 14 davon gleichnamige
// US-Firmen, und die liefen mit vollständiger Analyse durch. Die Regel lautet
// seither: gültig ja, vorausgewählt nein.

// Alles außer den verdächtigen Kürzeln. Sie bleiben in der Liste sichtbar und
// lassen sich von Hand ankreuzen - der Vorschlag kann ja falsch sein.
export function ohneVerdaechtige(bestaetigt: string[], kollisionen: TickerKollision[]): string[] {
  const verdaechtig = new Set(kollisionen.map((k) => k.eingabe))
  return bestaetigt.filter((t) => !verdaechtig.has(t))
}

// Ersetzt jedes verdächtige Kürzel durch die Schreibweise mit Börsenzusatz
// (ADS -> ADS.DE) und behält die Reihenfolge der Eingabe. Doppelte entstehen,
// wenn jemand ADS und ADS.DE zugleich eingibt - sie fallen hier weg.
export function mitVorschlaegen(liste: string[], kollisionen: TickerKollision[]): string[] {
  const ersatz = new Map(kollisionen.map((k) => [k.eingabe, k.vorschlag]))
  return [...new Set(liste.map((t) => ersatz.get(t) ?? t))]
}
