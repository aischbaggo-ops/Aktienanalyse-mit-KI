// Kleine, je Browser gespeicherte Einstellungen (nur Komfort). Jeder Zugriff
// auf localStorage ist abgesichert: ohne Speicher gelten die Standards.

export type MaxAge = '1' | '7' | '30' | 'always'

export const MAX_AGE_OPTIONS: { value: MaxAge; label: string }[] = [
  { value: '1', label: '24 Stunden' },
  { value: '7', label: '7 Tage (Standard)' },
  { value: '30', label: '30 Tage' },
  { value: 'always', label: 'Immer neu laden' },
]

export const DEFAULT_MAX_AGE: MaxAge = '7'
const MAX_AGE_KEY = 'dashboard.maxAge'

// Dropdown "Aktie analysieren": die Wahl bleibt erhalten, wenn man von der
// Analyseseite zurueckkommt (vorher stand es dann wieder auf "7 Tage" und
// lieferte unbemerkt den Cache).
export function readMaxAge(): MaxAge {
  try {
    const v = localStorage.getItem(MAX_AGE_KEY)
    return MAX_AGE_OPTIONS.some((o) => o.value === v) ? (v as MaxAge) : DEFAULT_MAX_AGE
  } catch {
    return DEFAULT_MAX_AGE
  }
}

export function storeMaxAge(value: MaxAge) {
  try {
    localStorage.setItem(MAX_AGE_KEY, value)
  } catch {
    // Ohne Speicher gilt beim naechsten Aufruf wieder der Standard.
  }
}
