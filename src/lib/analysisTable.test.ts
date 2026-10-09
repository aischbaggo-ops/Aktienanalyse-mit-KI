import { describe, expect, it } from 'vitest'
import {
  ANALYSIS_TABLE_SELECT,
  applyTableView,
  DEFAULT_SORT,
  EMPTY_FILTER,
  emptyRow,
  formatPrice,
  hasKo,
  newsBlocked,
  nextSort,
  normalizeRow,
  parseMinScore,
  recentSince,
  type AnalysisTableRow,
} from './analysisTable'

const row = (ticker: string, score: number | null, extra: Partial<AnalysisTableRow> = {}): AnalysisTableRow => ({
  ...emptyRow(ticker),
  name: `${ticker} Inc.`,
  sector: 'Technology',
  score_total: score,
  analysed_at: '2026-10-08T07:00:00Z',
  ...extra,
})

const rows = [
  row('MSFT', 78, { analysed_at: '2026-10-08T07:23:00Z', market_cap: 3.1e12, score_krise: 46 }),
  row('AAPL', 70, { analysed_at: '2026-10-09T06:00:00Z', market_cap: 3.4e12, score_krise: null }),
  row('FDXF', null, { status: 'error', analysed_at: '2026-10-09T08:00:00Z' }),
  row('COST', 85, { sector: 'Consumer Defensive', industry: 'Discount Stores', market_cap: 4e11, score_krise: 74 }),
  row('PSKY', 28, { sector: 'Communication Services', market_cap: 1e10, score_krise: 10 }),
]
const t = (r: AnalysisTableRow[]) => r.map((x) => x.ticker)
const view = (filter = {}, sort = DEFAULT_SORT) => t(applyTableView(rows, { ...EMPTY_FILTER, ...filter }, sort))

describe('Sortierung', () => {
  it('Standard: Score absteigend, ohne Score am Ende', () => {
    expect(view()).toEqual(['COST', 'MSFT', 'AAPL', 'PSKY', 'FDXF'])
  })

  it('Klick auf Spalte: gleiche Spalte dreht, Zahlen absteigend, Text aufsteigend', () => {
    expect(nextSort(DEFAULT_SORT, 'score_total')).toEqual({ key: 'score_total', dir: 'asc' })
    expect(nextSort(DEFAULT_SORT, 'ticker')).toEqual({ key: 'ticker', dir: 'asc' })
    expect(nextSort(DEFAULT_SORT, 'market_cap')).toEqual({ key: 'market_cap', dir: 'desc' })
  })

  it('Score aufsteigend, Ticker A-Z, Analysedatum, Marktkapitalisierung', () => {
    expect(view({}, { key: 'score_total', dir: 'asc' })).toEqual(['PSKY', 'AAPL', 'MSFT', 'COST', 'FDXF'])
    expect(view({}, { key: 'ticker', dir: 'asc' })).toEqual(['AAPL', 'COST', 'MSFT', 'PSKY', 'FDXF'])
    expect(view({}, { key: 'analysed_at', dir: 'desc' })[0]).toBe('AAPL')
    expect(view({}, { key: 'market_cap', dir: 'desc' })).toEqual(['AAPL', 'MSFT', 'COST', 'PSKY', 'FDXF'])
  })

  it('Teilscore ohne Wert (null) steht bei Sortierung nach dieser Spalte hinten', () => {
    expect(view({}, { key: 'score_krise', dir: 'desc' })).toEqual(['COST', 'MSFT', 'PSKY', 'AAPL', 'FDXF'])
    expect(view({}, { key: 'score_krise', dir: 'asc' })).toEqual(['PSKY', 'MSFT', 'COST', 'AAPL', 'FDXF'])
  })
})

describe('Filter', () => {
  it('Suche in Ticker, Firma, Sektor und Branche', () => {
    expect(view({ search: 'cost' })).toEqual(['COST'])
    expect(view({ search: 'discount' })).toEqual(['COST'])
    expect(view({ search: 'communication' })).toEqual(['PSKY'])
  })

  it('Einschätzung nach scoreLabel (ab 85 Stark, ab 70 Solide, ab 40 Durchschnittlich, sonst Schwach)', () => {
    expect(view({ assessment: 'Stark' })).toEqual(['COST'])
    expect(view({ assessment: 'Solide' })).toEqual(['MSFT', 'AAPL'])
    expect(view({ assessment: 'Schwach' })).toEqual(['PSKY'])
  })

  it('Score ab blendet Zeilen ohne Score aus, Grenze inklusive', () => {
    expect(view({ minScore: 78 })).toEqual(['COST', 'MSFT'])
    expect(view({ minScore: 0 })).not.toContain('FDXF')
  })

  it('parseMinScore: leer = kein Filter, Komma erlaubt', () => {
    expect(parseMinScore('')).toBeNull()
    expect(parseMinScore('x')).toBeNull()
    expect(parseMinScore('72,5')).toBe(72.5)
  })
})

describe('Daten', () => {
  it('Abfrage nutzt nur Einzelwerte der View, keine ganzen JSON-Spalten', () => {
    const cols = ANALYSIS_TABLE_SELECT.split(',').map((c) => c.trim())
    for (const c of ['logo_url', 'price', 'market_cap', 'ko_count', 'news_status', 'score_krise']) expect(cols).toContain(c)
    for (const big of ['*', 'chart_data', 'criteria', 'bewertung', 'prognose', 'fazit']) expect(cols).not.toContain(big)
  })

  it('normalizeRow wandelt numeric-Strings in Zahlen, leere Werte bleiben null', () => {
    const r = normalizeRow({ ticker: 'X', market_cap: '3100000000000', price: '412.5', score_total: 78, ko_count: '0', score_trend: null })
    expect(r.market_cap).toBe(3.1e12)
    expect(r.price).toBe(412.5)
    expect(r.ko_count).toBe(0)
    expect(r.score_trend).toBeNull()
  })

  it('Hinweise: K.O. bei rotem K.O.-Kriterium oder no_go_hart, News gesperrt bei blocked', () => {
    expect(hasKo(row('A', 50, { ko_count: 1 }))).toBe(true)
    expect(hasKo(row('A', 50, { no_go_hart: true }))).toBe(true)
    expect(hasKo(row('A', 50, { ko_count: 0 }))).toBe(false)
    expect(newsBlocked(row('V', 87, { news_status: 'blocked' }))).toBe(true)
    expect(newsBlocked(row('V', 87, { news_status: 'ok' }))).toBe(false)
  })

  it('Kurs und Zeitraum', () => {
    expect(formatPrice(null, 'USD')).toBe('–')
    expect(formatPrice(412.5, 'USD')).toBe('412,50 USD')
    expect(recentSince('7d', Date.parse('2026-10-08T12:00:00Z'))).toBe('2026-10-01T12:00:00.000Z')
  })
})
