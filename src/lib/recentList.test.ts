import { describe, expect, it } from 'vitest'
import { applyRecentView, applyWatchlistView, parseMinScore, RECENT_SELECT, recentSince, WATCHLIST_SELECT, type RecentRow } from './recentList'

const row = (ticker: string, score: number | null, updated_at: string): RecentRow => ({
  ticker,
  company_name: ticker,
  score_total: score,
  status: score == null ? 'error' : 'done',
  updated_at,
  image: null,
})

const rows: RecentRow[] = [
  row('MSFT', 78, '2026-10-08T07:23:00Z'),
  row('AAPL', 70, '2026-10-08T06:00:00Z'),
  row('PG', null, '2026-10-08T08:00:00Z'),
  row('COST', 85, '2026-10-08T07:21:00Z'),
  row('ABBV', 70, '2026-10-07T18:00:00Z'),
]
const tickers = (r: RecentRow[]) => r.map((x) => x.ticker)

describe('applyRecentView: Sortierung', () => {
  it('Score absteigend (Standard), gleicher Score nach Ticker, ohne Score am Ende', () => {
    expect(tickers(applyRecentView(rows, 'score_desc', null))).toEqual(['COST', 'MSFT', 'AAPL', 'ABBV', 'PG'])
  })

  it('Score aufsteigend, ohne Score am Ende', () => {
    expect(tickers(applyRecentView(rows, 'score_asc', null))).toEqual(['AAPL', 'ABBV', 'MSFT', 'COST', 'PG'])
  })

  it('Ticker A-Z, ohne Score am Ende', () => {
    expect(tickers(applyRecentView(rows, 'ticker', null))).toEqual(['AAPL', 'ABBV', 'COST', 'MSFT', 'PG'])
  })

  it('neueste zuerst, ohne Score am Ende (auch wenn sie die neueste ist)', () => {
    expect(tickers(applyRecentView(rows, 'newest', null))).toEqual(['MSFT', 'COST', 'AAPL', 'ABBV', 'PG'])
  })

  it('veraendert die Ausgangsliste nicht', () => {
    const before = tickers(rows)
    applyRecentView(rows, 'ticker', null)
    expect(tickers(rows)).toEqual(before)
  })
})

describe('applyRecentView: Filter "Score ab"', () => {
  it('blendet Zeilen unter der Grenze und ohne Score aus, Grenze inklusive', () => {
    expect(tickers(applyRecentView(rows, 'score_desc', 78))).toEqual(['COST', 'MSFT'])
    expect(tickers(applyRecentView(rows, 'ticker', 70))).toEqual(['AAPL', 'ABBV', 'COST', 'MSFT'])
  })

  it('Filter 0 blendet nur Zeilen ohne Score aus', () => {
    expect(applyRecentView(rows, 'score_desc', 0)).toHaveLength(4)
  })
})

describe('parseMinScore', () => {
  it('leer oder keine Zahl = kein Filter, Komma wird akzeptiert', () => {
    expect(parseMinScore('')).toBeNull()
    expect(parseMinScore('  ')).toBeNull()
    expect(parseMinScore('abc')).toBeNull()
    expect(parseMinScore('70')).toBe(70)
    expect(parseMinScore('72,5')).toBe(72.5)
  })
})

describe('Abfrage', () => {
  it('laedt nur Listenspalten, kein chart_data und keine grossen JSON-Spalten', () => {
    const cols = RECENT_SELECT.split(',').map((c) => c.trim())
    expect(cols).toContain('image:chart_data->profileMeta->>image')
    for (const big of ['*', 'chart_data', 'criteria', 'bewertung', 'prognose', 'fazit', 'warnings']) {
      expect(cols).not.toContain(big)
    }
  })

  it('Zeitraum 24 Stunden und 7 Tage', () => {
    const now = Date.parse('2026-10-08T12:00:00Z')
    expect(recentSince('24h', now)).toBe('2026-10-07T12:00:00.000Z')
    expect(recentSince('7d', now)).toBe('2026-10-01T12:00:00.000Z')
  })
})

describe('applyWatchlistView (Watchlist als Liste)', () => {
  const w = (ticker: string, score: number | null, updated_at: string | null) => ({
    user_id: 'u1',
    ticker,
    analysis_id: null,
    added_at: '2026-10-01T00:00:00Z',
    stock_analyses:
      updated_at === null
        ? null
        : { ticker, company_name: ticker, sector: 'Tech', score_total: score, status: 'done', updated_at, image: null },
  })
  const list = [
    w('MSFT', 78, '2026-10-08T07:23:00Z'),
    w('NEU', null, null), // noch nicht analysiert
    w('COST', 85, '2026-10-08T07:21:00Z'),
    w('AAPL', 70, '2026-10-09T06:00:00Z'),
  ]
  const t = (r: { ticker: string }[]) => r.map((x) => x.ticker)

  it('sortiert nach Score, Ticker und Analysedatum, ohne Analyse immer am Ende', () => {
    expect(t(applyWatchlistView(list, 'score_desc', null))).toEqual(['COST', 'MSFT', 'AAPL', 'NEU'])
    expect(t(applyWatchlistView(list, 'score_asc', null))).toEqual(['AAPL', 'MSFT', 'COST', 'NEU'])
    expect(t(applyWatchlistView(list, 'ticker', null))).toEqual(['AAPL', 'COST', 'MSFT', 'NEU'])
    expect(t(applyWatchlistView(list, 'newest', null))).toEqual(['AAPL', 'MSFT', 'COST', 'NEU'])
  })

  it('Filter "Score ab" blendet Zeilen ohne Analyse aus', () => {
    expect(t(applyWatchlistView(list, 'score_desc', 75))).toEqual(['COST', 'MSFT'])
  })

  it('Watchlist-Abfrage laedt die Analyse schlank, ohne chart_data als Ganzes', () => {
    expect(WATCHLIST_SELECT).toContain('stock_analyses!watchlists_ticker_fkey(')
    expect(WATCHLIST_SELECT).toContain('image:chart_data->profileMeta->>image')
    expect(WATCHLIST_SELECT).not.toMatch(/\(\*\)|chart_data[,)]|criteria|bewertung|prognose|fazit/)
  })
})
