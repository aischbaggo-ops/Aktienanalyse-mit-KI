// Unterstuetzte Indizes fuer die Batch-Auswahl. Muss inhaltlich mit
// supabase/functions/_shared/indexDefinitions.ts uebereinstimmen (index_id) -
// die beiden Repos werden unabhaengig versioniert, daher hier bewusst
// dupliziert statt geteilt.
export interface IndexOption {
  id: string
  label: string
}

export const SUPPORTED_INDICES: IndexOption[] = [
  { id: 'dax', label: 'DAX' },
  { id: 'mdax', label: 'MDAX' },
  { id: 'sdax', label: 'SDAX' },
  { id: 'sp500', label: 'S&P 500' },
  { id: 'nasdaq100', label: 'NASDAQ 100' },
  { id: 'dowjones', label: 'Dow Jones' },
]

// "Top N" = die ersten N Werte in der von der Datenquelle gelieferten
// Reihenfolge (keine Gewichtungsdaten verfuegbar, siehe index-constituents).
export const TOP_N_OPTIONS = [10, 20, 50, 100] as const
