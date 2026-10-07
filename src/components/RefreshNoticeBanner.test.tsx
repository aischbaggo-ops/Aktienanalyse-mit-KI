import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RefreshNoticeBanner } from './RefreshNoticeBanner'
import { formatAnalysisDate } from '../lib/analysisRun'
import type { StockAnalysis } from '../types/database'

const NOW = Date.parse('2026-10-07T10:00:00.000Z')
const ANALYSIS_DATE = '2026-10-05T08:00:00.000Z'

function analysis(overrides: Partial<StockAnalysis>): StockAnalysis {
  return {
    id: '1',
    ticker: 'TEST',
    status: 'done',
    company_name: 'Test AG',
    sector: null,
    currency: 'USD',
    current_price: null,
    score_total: 70,
    score_fundamental: 70,
    score_qualitaet: 70,
    score_krise: 70,
    score_trend: 70,
    score_stabilitaet: null,
    criteria: null,
    warnings: null,
    fazit: 'Fazit.',
    bewertung: null,
    prognose: null,
    chart_data: null,
    data_source: null,
    error_message: null,
    error_message_public: null,
    last_run_status: 'done',
    last_run_error_public: null,
    last_run_error_code: null,
    last_run_at: '2026-10-05T07:59:30.000Z',
    created_at: '',
    updated_at: ANALYSIS_DATE,
    ...overrides,
  }
}

const render = (a: StockAnalysis) => renderToStaticMarkup(<RefreshNoticeBanner analysis={a} now={NOW} />)

describe('RefreshNoticeBanner', () => {
  it('zeigt bei done + error das Banner mit Datum und oeffentlicher Fehlermeldung', () => {
    const html = render(
      analysis({ last_run_status: 'error', last_run_at: '2026-10-07T09:58:00.000Z', last_run_error_public: 'FMP-Limit erreicht.' }),
    )
    expect(html).toContain(`Aktualisierung fehlgeschlagen, angezeigt wird die Analyse vom ${formatAnalysisDate(ANALYSIS_DATE)}.`)
    expect(html).toContain('FMP-Limit erreicht.')
  })

  it('zeigt bei laufendem Refresh den Hinweis "Aktualisierung läuft"', () => {
    const html = render(analysis({ last_run_status: 'running', last_run_at: '2026-10-07T09:59:40.000Z' }))
    expect(html).toContain('Aktualisierung läuft')
    expect(html).not.toContain('fehlgeschlagen')
  })

  it('rendert nichts nach erfolgreichem Lauf', () => {
    expect(render(analysis({}))).toBe('')
  })
})
