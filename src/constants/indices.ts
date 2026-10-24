// Unterstuetzte Indizes fuer die Batch-Auswahl. Muss inhaltlich mit
// supabase/functions/_shared/indexDefinitions.ts uebereinstimmen (index_id,
// enabled-Flag) - die beiden Repos werden unabhaengig versioniert, daher
// hier bewusst dupliziert statt geteilt.
export interface IndexOption {
  id: string
  label: string
  enabled: boolean
}

// DAX und MDAX waren seit dem 22.09.2026 abgeschaltet, weil FMP
// Deutschland/XETRA erst ab dem Ultimate-Plan abdeckt und deutsche Ticker
// durchgehend HTTP 402 lieferten. Seit dem 20.10.2026 liegt der
// Ultimate-Schluessel vor (rund 6850 Tageskurse ab 2000, Abschluesse in
// EUR), dazu kommen Methodik 4 mit dem Heimatindex und der
// Kollisionsschutz in validate-tickers - der Grund ist damit entfallen.
//
// SDAX bleibt aus: fuer die 70 Titel fehlen die Ticker-Symbole, die
// Tabelle index_constituents hat dafuer keine Zeilen. Das Backend lehnt
// einen deaktivierten Index ohnehin serverseitig ab.
export const SUPPORTED_INDICES: IndexOption[] = [
  { id: 'dax', label: 'DAX', enabled: true },
  { id: 'mdax', label: 'MDAX', enabled: true },
  { id: 'sdax', label: 'SDAX', enabled: false },
  { id: 'sp500', label: 'S&P 500', enabled: true },
  { id: 'nasdaq100', label: 'NASDAQ 100', enabled: true },
  { id: 'dowjones', label: 'Dow Jones', enabled: true },
]

// "Top N" = die ersten N Werte in der von der Datenquelle gelieferten
// Reihenfolge (keine Gewichtungsdaten verfuegbar, siehe index-constituents).
export const TOP_N_OPTIONS = [10, 20, 50, 100] as const
