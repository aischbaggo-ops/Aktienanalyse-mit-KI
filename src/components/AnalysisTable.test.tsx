import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnalysisTable } from './AnalysisTable'
import { emptyRow, type AnalysisTableRow } from '../lib/analysisTable'

const row = (ticker: string, extra: Partial<AnalysisTableRow>): AnalysisTableRow => ({
  ...emptyRow(ticker),
  name: `${ticker} Corp`,
  status: 'done',
  analysed_at: '2026-10-08T07:00:00Z',
  ...extra,
})

const rows = [
  row('COST', {
    sector: 'Consumer Defensive',
    industry: 'Discount Stores',
    market_cap: 4.1e11,
    price: 912.4,
    currency: 'USD',
    score_total: 85,
    score_fundamental: 98,
    score_qualitaet: 100,
    score_krise: 74,
    score_trend: 63,
  }),
  row('V', { score_total: 87, news_status: 'blocked', ko_count: 0 }),
  row('BA', { score_total: 48, ko_count: 2 }),
  row('FDXF', { status: 'error', score_total: null }),
]

const html = renderToStaticMarkup(
  <AnalysisTable
    rows={rows}
    storageKey="test"
    selected={new Set(['COST'])}
    onToggle={() => {}}
    onSelectShown={() => {}}
    isRowLocked={(t) => t === 'V'}
    rowTag={(t) => (t === 'V' ? 'auf Watchlist' : null)}
    onOpenTicker={() => {}}
    onDownloadPdf={() => {}}
  />,
)

describe('AnalysisTable', () => {
  it('zeigt Werkzeugleiste: Suche, Einschätzung, Score ab, Umbruch, Spaltenbreiten, Zähler, Alle auswählen', () => {
    for (const text of [
      'Suche: Ticker, Firma, Sektor',
      'Alle Einschätzungen',
      'Score ab',
      'Text abschneiden statt umbrechen',
      'Spaltenbreiten zurücksetzen',
      '4 von 4 angezeigt',
      'Alle angezeigten auswählen',
    ]) {
      expect(html).toContain(text)
    }
  })

  it('Spaltenköpfe mit Sortierung; Standard Score absteigend; Krise mit Tooltip Krisenstabilität', () => {
    expect(html).toContain('aria-sort="descending"')
    expect(html).toContain('Score ▼')
    expect(html).toContain('title="Krisenstabilität"')
    for (const h of ['Ticker', 'Name', 'Sektor / Branche', 'Marktkap.', 'Kurs', 'Analyse vom', 'Einschätzung', 'Fund.', 'Qual.', 'Krise', 'Trend', 'Hinweise', 'Analyse']) {
      expect(html).toContain(`>${h}`)
    }
  })

  it('Reihenfolge: Score absteigend, Zeile ohne Score am Ende', () => {
    const order = ['V', 'COST', 'BA', 'FDXF'].map((tk) => html.indexOf(`>${tk}</span>`))
    expect(order.every((pos) => pos > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('Werte: Marktkapitalisierung, Kurs, Einschätzung, Teilscores, fehlender Wert als –', () => {
    expect(html).toContain('410 Mrd. USD')
    expect(html).toContain('912,40 USD')
    expect(html).toContain('Stark')
    expect(html).toContain('Durchschnittlich')
    expect(html).toContain('>98<')
    expect(html).toContain('Fehler')
    expect(html).toMatch(/>–</)
  })

  it('Hinweis-Symbole: K.O. und News gesperrt', () => {
    expect(html).toContain('K.O.-Kriterium rot (2)')
    expect(html).toContain('News gesperrt')
  })

  it('Auswahl, gesperrte Zeile mit Hinweis, Öffnen und PDF (nicht bei Zeile ohne Score)', () => {
    expect(html).toContain('auf Watchlist')
    expect(html.match(/Öffnen/g)).toHaveLength(4)
    expect(html.match(/PDF für/g)?.length).toBe(6) // 3 Zeilen mit Score: title + aria-label
    expect(html).not.toContain('PDF für FDXF')
  })
})
