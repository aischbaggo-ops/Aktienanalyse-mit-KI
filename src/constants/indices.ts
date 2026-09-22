// Unterstuetzte Indizes fuer die Batch-Auswahl. Muss inhaltlich mit
// supabase/functions/_shared/indexDefinitions.ts uebereinstimmen (index_id,
// enabled-Flag) - die beiden Repos werden unabhaengig versioniert, daher
// hier bewusst dupliziert statt geteilt.
export interface IndexOption {
  id: string
  label: string
  enabled: boolean
}

// enabled: false = DAX/MDAX/SDAX sind zurueckgestellt (Scope-Reduzierung
// 2026-09-22): FMP deckt Deutschland/XETRA erst ab dem Ultimate-Plan
// ($149/Monat) ab, SAP.DE/DTE.DE etc. liefern im aktuellen Plan
// durchgehend HTTP 402 - das betrifft nicht nur die Index-Auswahl, sondern
// JEDE Einzelanalyse eines deutschen Tickers (eigenstaendiges, separates
// Thema). NICHT ohne geklaerte Datenquelle wieder auf true setzen - das
// Backend lehnt einen deaktivierten Index ohnehin serverseitig ab.
export const SUPPORTED_INDICES: IndexOption[] = [
  { id: 'dax', label: 'DAX', enabled: false },
  { id: 'mdax', label: 'MDAX', enabled: false },
  { id: 'sdax', label: 'SDAX', enabled: false },
  { id: 'sp500', label: 'S&P 500', enabled: true },
  { id: 'nasdaq100', label: 'NASDAQ 100', enabled: true },
  { id: 'dowjones', label: 'Dow Jones', enabled: true },
]

// "Top N" = die ersten N Werte in der von der Datenquelle gelieferten
// Reihenfolge (keine Gewichtungsdaten verfuegbar, siehe index-constituents).
export const TOP_N_OPTIONS = [10, 20, 50, 100] as const
