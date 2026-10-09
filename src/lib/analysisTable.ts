// Gemeinsame Analyse-Tabelle (Watchlist, "Letzte Analysen", spaeter "Alle
// Analysen"): Datenzeile, Abfrage, Suche, Filter und Sortierung. Rein, ohne
// React und ohne Netz - testbar in analysisTable.test.ts.
import { scoreLabel } from './score'

// Spalten der View analysis_ranking (Migration 20261007120000), die die
// Tabelle braucht. Die View liefert nur einzelne Werte, keine ganzen
// JSON-Spalten; alle ~520 Zeilen sind so ~160 kB statt ~26 MB mit
// stock_analyses(*).
export const ANALYSIS_TABLE_SELECT = [
  'ticker',
  'name',
  'status',
  'analysed_at',
  'last_run_status',
  'sector',
  'industry',
  'currency',
  'price',
  'logo_url',
  'market_cap',
  'score_total',
  'score_fundamental',
  'score_qualitaet',
  'score_krise',
  'score_trend',
  'no_go_hart',
  'ko_count',
  'news_status',
].join(', ')

export interface AnalysisTableRow {
  ticker: string
  name: string | null
  status: string | null
  analysed_at: string | null
  last_run_status: string | null
  sector: string | null
  industry: string | null
  currency: string | null
  // Kurs und Marktkapitalisierung stammen von FMP: nur in der App-Tabelle
  // anzeigen, nicht in PDF- oder CSV-Export (FMP-Lizenzfrage offen).
  price: number | null
  logo_url: string | null
  market_cap: number | null
  score_total: number | null
  score_fundamental: number | null
  score_qualitaet: number | null
  score_krise: number | null
  score_trend: number | null
  no_go_hart: boolean | null
  ko_count: number | null
  news_status: string | null
}

// Zeile fuer einen Ticker ohne gespeicherte Analyse (z.B. frisch auf der
// Watchlist): alles leer, landet bei jeder Sortierung am Ende.
export function emptyRow(ticker: string): AnalysisTableRow {
  return {
    ticker,
    name: null,
    status: null,
    analysed_at: null,
    last_run_status: null,
    sector: null,
    industry: null,
    currency: null,
    price: null,
    logo_url: null,
    market_cap: null,
    score_total: null,
    score_fundamental: null,
    score_qualitaet: null,
    score_krise: null,
    score_trend: null,
    no_go_hart: null,
    ko_count: null,
    news_status: null,
  }
}

// PostgREST liefert numeric als String - fuer Sortierung und Anzeige in
// Zahlen umwandeln.
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function normalizeRow(raw: Record<string, unknown>): AnalysisTableRow {
  const r = { ...emptyRow(String(raw.ticker)), ...(raw as Partial<AnalysisTableRow>) }
  return {
    ...r,
    price: toNum(raw.price),
    market_cap: toNum(raw.market_cap),
    score_total: toNum(raw.score_total),
    score_fundamental: toNum(raw.score_fundamental),
    score_qualitaet: toNum(raw.score_qualitaet),
    score_krise: toNum(raw.score_krise),
    score_trend: toNum(raw.score_trend),
    ko_count: toNum(raw.ko_count),
  }
}

export type SortKey =
  | 'ticker'
  | 'name'
  | 'sector'
  | 'market_cap'
  | 'price'
  | 'analysed_at'
  | 'score_total'
  | 'score_fundamental'
  | 'score_qualitaet'
  | 'score_krise'
  | 'score_trend'

export interface SortState {
  key: SortKey
  dir: 'asc' | 'desc'
}

export const DEFAULT_SORT: SortState = { key: 'score_total', dir: 'desc' }

// Klick auf eine Spaltenueberschrift: gleiche Spalte -> Richtung wechseln,
// neue Spalte -> Zahlen/Datum absteigend, Text aufsteigend.
export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  const textual = key === 'ticker' || key === 'name' || key === 'sector'
  return { key, dir: textual ? 'asc' : 'desc' }
}

export type Assessment = 'Stark' | 'Solide' | 'Durchschnittlich' | 'Schwach'
export const ASSESSMENTS: Assessment[] = ['Stark', 'Solide', 'Durchschnittlich', 'Schwach']

export interface TableFilter {
  search: string
  assessment: Assessment | ''
  minScore: number | null
}

export const EMPTY_FILTER: TableFilter = { search: '', assessment: '', minScore: null }

// Eingabe "Score ab": leer oder keine Zahl = kein Filter.
export function parseMinScore(input: string): number | null {
  const t = input.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function sortValue(r: AnalysisTableRow, key: SortKey): string | number | null {
  const v = r[key]
  if (v === null || v === undefined || v === '') return null
  return key === 'name' || key === 'sector' ? String(v).toLowerCase() : (v as string | number)
}

// Suche (Ticker, Firma, Sektor, Branche), Einschaetzung und "Score ab".
// Zeilen ohne Gesamtscore fallen bei aktivem Score- oder
// Einschaetzungs-Filter heraus und stehen bei jeder Sortierung am Ende.
export function applyTableView(rows: AnalysisTableRow[], filter: TableFilter, sort: SortState): AnalysisTableRow[] {
  const q = filter.search.trim().toLowerCase()
  const filtered = rows.filter((r) => {
    if (q && ![r.ticker, r.name, r.sector, r.industry].some((v) => v?.toLowerCase().includes(q))) return false
    if (filter.minScore !== null && (r.score_total == null || r.score_total < filter.minScore)) return false
    if (filter.assessment && (r.score_total == null || scoreLabel(r.score_total) !== filter.assessment)) return false
    return true
  })
  const sign = sort.dir === 'asc' ? 1 : -1
  const cmp = (a: AnalysisTableRow, b: AnalysisTableRow) => {
    const va = sortValue(a, sort.key)
    const vb = sortValue(b, sort.key)
    if (va === null && vb === null) return a.ticker.localeCompare(b.ticker)
    if (va === null) return 1
    if (vb === null) return -1
    const d = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return d * sign || a.ticker.localeCompare(b.ticker)
  }
  // Ohne Gesamtscore immer ans Ende, unabhaengig von der Sortierspalte.
  const withScore = filtered.filter((r) => r.score_total != null).sort(cmp)
  const withoutScore = filtered.filter((r) => r.score_total == null).sort(cmp)
  return [...withScore, ...withoutScore]
}

export function hasKo(r: AnalysisTableRow): boolean {
  return (r.ko_count ?? 0) > 0 || r.no_go_hart === true
}

export function newsBlocked(r: AnalysisTableRow): boolean {
  return r.news_status === 'blocked'
}

export function formatPrice(price: number | null, currency: string | null): string {
  if (price === null) return '–'
  return `${price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency ?? ''}`.trim()
}

export function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('de-DE') : '–'
}

// Zeitraum fuer "Letzte Analysen".
export type RecentRange = '24h' | '7d'

export const RECENT_RANGES: { value: RecentRange; label: string; hours: number }[] = [
  { value: '24h', label: '24 Stunden', hours: 24 },
  { value: '7d', label: '7 Tage', hours: 7 * 24 },
]

export function recentSince(range: RecentRange, nowMs: number): string {
  const hours = RECENT_RANGES.find((r) => r.value === range)!.hours
  return new Date(nowMs - hours * 60 * 60 * 1000).toISOString()
}
