// Kleine Einstellungen nur fuer die laufende Browser-Sitzung (sessionStorage,
// nicht dauerhaft). Jeder Zugriff ist abgesichert: ohne Speicher gelten die
// Standards.

export type MaxAge = '1' | '7' | '30' | 'always'

export const MAX_AGE_OPTIONS: { value: MaxAge; label: string }[] = [
  { value: '1', label: '24 Stunden' },
  { value: '7', label: '7 Tage (Standard)' },
  { value: '30', label: '30 Tage' },
  { value: 'always', label: 'Immer neu laden' },
]

export const DEFAULT_MAX_AGE: MaxAge = '7'
const MAX_AGE_KEY = 'dashboard.maxAge'

// Grobe Kosten eines frischen Laufs: Claude ca. 0,036 USD im US-Lauf
// (api_call_log, 521 Aufrufe), dazu 15 FMP-Abrufe im Abo.
export const FRESH_RUN_COST_HINT = 'ca. 0,04 USD Claude-Kosten und 15 FMP-Abrufe pro Analyse'

// Dropdown "Aktie analysieren": die Wahl bleibt in dieser Sitzung erhalten,
// wenn man von der Analyseseite zurueckkommt (vorher stand es dann wieder
// auf "7 Tage" und lieferte unbemerkt den Cache). Neue Sitzung = Standard.
export function readMaxAge(): MaxAge {
  try {
    const v = sessionStorage.getItem(MAX_AGE_KEY)
    return MAX_AGE_OPTIONS.some((o) => o.value === v) ? (v as MaxAge) : DEFAULT_MAX_AGE
  } catch {
    return DEFAULT_MAX_AGE
  }
}

export function storeMaxAge(value: MaxAge) {
  try {
    sessionStorage.setItem(MAX_AGE_KEY, value)
  } catch {
    // Ohne Speicher gilt beim naechsten Aufruf wieder der Standard.
  }
}

// Sichtbarer Hinweis neben dem Dropdown, solange "Immer neu laden" aktiv ist.
export function maxAgeCostHint(value: MaxAge): string | null {
  return value === 'always' ? `Immer neu laden ist aktiv: jede Analyse rechnet neu (${FRESH_RUN_COST_HINT}).` : null
}
