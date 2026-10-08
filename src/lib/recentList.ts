// "Letzte Analysen" im Dashboard: schlanke Abfrage, Sortierung und Filter.
// Rein, ohne React und ohne Netz - testbar in recentList.test.ts.

// Nur die Spalten, die die Liste braucht. Bewusst NICHT select('*'): eine
// volle Zeile ist im Schnitt ~52 kB (chart_data allein ~42 kB), bei 7 Tagen
// und ~500 Zeilen waeren das ~26 MB. Das Logo kommt per JSON-Pfad, damit
// chart_data nicht mitgeladen wird.
export const RECENT_SELECT = 'ticker, company_name, score_total, status, updated_at, image:chart_data->profileMeta->>image'

export interface RecentRow {
  ticker: string
  company_name: string | null
  score_total: number | null
  status: string
  updated_at: string
  image: string | null
}

export type RecentRange = '24h' | '7d'

export const RECENT_RANGES: { value: RecentRange; label: string; hours: number }[] = [
  { value: '24h', label: '24 Stunden', hours: 24 },
  { value: '7d', label: '7 Tage', hours: 7 * 24 },
]

export function recentSince(range: RecentRange, nowMs: number): string {
  const hours = RECENT_RANGES.find((r) => r.value === range)!.hours
  return new Date(nowMs - hours * 60 * 60 * 1000).toISOString()
}

export type RecentSort = 'score_desc' | 'score_asc' | 'ticker' | 'newest'

export const RECENT_SORTS: { value: RecentSort; label: string }[] = [
  { value: 'score_desc', label: 'Score absteigend' },
  { value: 'score_asc', label: 'Score aufsteigend' },
  { value: 'ticker', label: 'Ticker A–Z' },
  { value: 'newest', label: 'Neueste zuerst' },
]

export const DEFAULT_RECENT_SORT: RecentSort = 'score_desc'

// Eingabe "Score ab": leer oder keine Zahl = kein Filter.
export function parseMinScore(input: string): number | null {
  const t = input.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// Filter und Sortierung. Zeilen ohne Score stehen bei jeder Sortierung am
// Ende und fallen bei aktivem Filter heraus.
export function applyRecentView(rows: RecentRow[], sort: RecentSort, minScore: number | null): RecentRow[] {
  const filtered = minScore === null ? rows : rows.filter((r) => r.score_total != null && r.score_total >= minScore)
  const byTicker = (a: RecentRow, b: RecentRow) => a.ticker.localeCompare(b.ticker)
  const byNewest = (a: RecentRow, b: RecentRow) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0)
  const scoreCmp = (dir: 1 | -1) => (a: RecentRow, b: RecentRow) => {
    if (a.score_total == null && b.score_total == null) return byTicker(a, b)
    if (a.score_total == null) return 1
    if (b.score_total == null) return -1
    return (a.score_total - b.score_total) * dir || byTicker(a, b)
  }
  const cmp =
    sort === 'score_desc' ? scoreCmp(-1)
    : sort === 'score_asc' ? scoreCmp(1)
    : sort === 'ticker' ? byTicker
    : byNewest
  // Ohne Score immer ans Ende, auch bei A-Z und "neueste zuerst".
  const withScore = filtered.filter((r) => r.score_total != null).sort(cmp)
  const withoutScore = filtered.filter((r) => r.score_total == null).sort(cmp)
  return [...withScore, ...withoutScore]
}
