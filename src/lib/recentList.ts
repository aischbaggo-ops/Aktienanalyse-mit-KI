// Listen im Dashboard ("Letzte Analysen", Watchlist als Liste): schlanke
// Abfragen, Sortierung und Filter. Rein, ohne React und ohne Netz - testbar
// in recentList.test.ts.

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

// Watchlist: dieselbe schlanke Auswahl fuer die verknuepfte Analyse (vorher
// stock_analyses(*) - bei ~250 Eintraegen grob 12 MB). PDF-Download und
// Analyseseite laden die volle Zeile weiterhin selbst.
export const WATCHLIST_SELECT =
  'user_id, ticker, analysis_id, added_at, stock_analyses!watchlists_ticker_fkey(ticker, company_name, sector, score_total, status, updated_at, image:chart_data->profileMeta->>image)'

export interface WatchlistAnalysisSlim {
  ticker: string
  company_name: string | null
  sector: string | null
  score_total: number | null
  status: string
  updated_at: string
  image: string | null
}

export interface WatchlistRow {
  user_id: string
  ticker: string
  analysis_id: string | null
  added_at: string
  stock_analyses: WatchlistAnalysisSlim | null
}

// Fuer Sortierung/Filter: was applyScoreView() je Zeile braucht.
export interface ScoreViewItem {
  ticker: string
  score_total: number | null
  updated_at: string | null
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

// Filter und Sortierung fuer beide Listen. Zeilen ohne Score stehen bei
// jeder Sortierung am Ende und fallen bei aktivem Filter heraus.
export function applyScoreView<T>(
  rows: T[],
  sort: RecentSort,
  minScore: number | null,
  pick: (row: T) => ScoreViewItem,
): T[] {
  const filtered =
    minScore === null
      ? rows
      : rows.filter((r) => {
          const s = pick(r).score_total
          return s != null && s >= minScore
        })
  const byTicker = (a: T, b: T) => pick(a).ticker.localeCompare(pick(b).ticker)
  const byNewest = (a: T, b: T) => {
    const da = pick(a).updated_at ?? ''
    const db = pick(b).updated_at ?? ''
    return da < db ? 1 : da > db ? -1 : 0
  }
  const scoreCmp = (dir: 1 | -1) => (x: T, y: T) => {
    const a = pick(x)
    const b = pick(y)
    if (a.score_total == null && b.score_total == null) return byTicker(x, y)
    if (a.score_total == null) return 1
    if (b.score_total == null) return -1
    return (a.score_total - b.score_total) * dir || byTicker(x, y)
  }
  const cmp =
    sort === 'score_desc' ? scoreCmp(-1)
    : sort === 'score_asc' ? scoreCmp(1)
    : sort === 'ticker' ? byTicker
    : byNewest
  // Ohne Score immer ans Ende, auch bei A-Z und "neueste zuerst".
  const withScore = filtered.filter((r) => pick(r).score_total != null).sort(cmp)
  const withoutScore = filtered.filter((r) => pick(r).score_total == null).sort(cmp)
  return [...withScore, ...withoutScore]
}

export function applyRecentView(rows: RecentRow[], sort: RecentSort, minScore: number | null): RecentRow[] {
  return applyScoreView(rows, sort, minScore, (r) => r)
}

// Watchlist: Score und Datum kommen aus der verknuepften Analyse; ohne
// Analyse zaehlt die Zeile als "ohne Score".
export function applyWatchlistView(rows: WatchlistRow[], sort: RecentSort, minScore: number | null): WatchlistRow[] {
  return applyScoreView(rows, sort, minScore, (r) => ({
    ticker: r.ticker,
    score_total: r.stock_analyses?.score_total ?? null,
    updated_at: r.stock_analyses?.updated_at ?? null,
  }))
}
