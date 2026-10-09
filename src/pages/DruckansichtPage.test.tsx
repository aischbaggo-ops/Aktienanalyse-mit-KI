import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { PrintableAnalysis } from './DruckansichtPage'
import { printFooterLines, PRINT_SECTIONS } from '../lib/printView'
import type { StockAnalysis } from '../types/database'

const LONG_DESC =
  'Fastenal ist ein Grosshaendler fuer Industrie- und Baubedarf mit Sitz in Winona, Minnesota. ' +
  'Das Unternehmen betreibt ein dichtes Netz aus Filialen, Vor-Ort-Lagern bei Kunden und Verkaufsautomaten. ' +
  'Zum Sortiment gehoeren Befestigungstechnik, Werkzeuge, Arbeitsschutz und Verbrauchsmaterial. Dieser Satz steht am Ende.'

function analysis(): StockAnalysis {
  return {
    id: '1',
    ticker: 'FAST',
    status: 'done',
    company_name: 'Fastenal Company',
    sector: 'Industrials',
    currency: 'USD',
    current_price: 41.5,
    score_total: 93,
    score_fundamental: 98,
    score_qualitaet: 90,
    score_krise: 80,
    score_trend: 100,
    score_stabilitaet: null,
    criteria: [],
    warnings: ['Testwarnung'],
    fazit: 'Solides Geschäftsmodell.',
    bewertung: null,
    prognose: null,
    chart_data: {
      profileMeta: { image: 'https://example.invalid/fast.png', marketCap: 4.7e10, exchange: 'NASDAQ', industry: 'Industrial Distribution', description: LONG_DESC },
      data_flags: { news_status: 'ok', methodik_version: 2 },
      swot: { staerken: ['Netz'], schwaechen: ['Zyklik'], chancen: ['Onsite'], risiken: ['Konjunktur'] },
    },
    data_source: 'fmp_full',
    error_message: null,
    error_message_public: null,
    last_run_status: 'done',
    last_run_error_public: null,
    last_run_error_code: null,
    last_run_at: '2026-10-09T12:09:40Z',
    created_at: '',
    updated_at: '2026-10-09T12:10:11Z',
  } as StockAnalysis
}

const printedAt = new Date('2026-10-10T08:00:00Z')
const html = renderToStaticMarkup(
  <MemoryRouter>
    <PrintableAnalysis analysis={analysis()} indexWeightings={[]} printedAt={printedAt} />
  </MemoryRouter>,
)

describe('Druckansicht', () => {
  it('zeigt alle vier Bereiche untereinander, ab dem zweiten mit Seitenumbruch', () => {
    for (const s of PRINT_SECTIONS) expect(html).toContain(`>${s.title}</h2>`)
    expect(html.match(/druck-neue-seite/g)).toHaveLength(PRINT_SECTIONS.length - 1)
    expect(html).toContain('class="druck ')
  })

  it('Kopf mit Logo, Marktkapitalisierung und vollständiger Beschreibung (ohne "mehr anzeigen")', () => {
    expect(html).toContain('https://example.invalid/fast.png')
    expect(html).toContain('47 Mrd. USD')
    expect(html).toContain('Dieser Satz steht am Ende.')
    expect(html).not.toContain('line-clamp-3')
    expect(html).not.toContain('mehr anzeigen')
  })

  it('Warnungen und Fazit sind enthalten, keine Bedienknöpfe der Analyseseite', () => {
    expect(html).toContain('Testwarnung')
    expect(html).toContain('Solides Geschäftsmodell.')
    expect(html).not.toContain('PDF herunterladen')
    expect(html).not.toContain('Neu analysieren')
  })

  it('Fußzeile: Datenquelle FMP, Analysedatum, Methodik, Hinweis Eigengebrauch', () => {
    const lines = printFooterLines(analysis(), printedAt)
    expect(lines[0]).toBe('Datenquelle: Financial Modeling Prep (FMP)')
    expect(lines[1]).toContain('Methodik 2')
    expect(lines[3]).toContain('Nur für den Eigengebrauch')
    for (const l of lines) expect(html).toContain(l)
  })
})
