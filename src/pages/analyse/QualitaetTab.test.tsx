import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QualitaetTab } from './QualitaetTab'
import { buildAnalysisPdf } from '../../utils/pdfExport'
import type { CriterionEntry, StockAnalysis } from '../../types/database'

function analysis(criteria: CriterionEntry[]): StockAnalysis {
  return {
    id: '1',
    ticker: 'TEST',
    status: 'done',
    company_name: 'Test AG',
    sector: null,
    currency: 'USD',
    current_price: null,
    score_total: 50,
    score_fundamental: 50,
    score_qualitaet: 50,
    score_krise: 50,
    score_trend: 50,
    score_stabilitaet: null,
    criteria,
    warnings: null,
    fazit: 'Fazit.',
    bewertung: null,
    prognose: null,
    chart_data: null,
    data_source: null,
    error_message: null,
    error_message_public: null,
    last_run_status: null,
    last_run_error_public: null,
    last_run_error_code: null,
    last_run_at: null,
    created_at: '',
    updated_at: '',
  }
}

const crit = (name: string, ampel: CriterionEntry['ampel']): CriterionEntry => ({ dimension: 'Qualitaet', name, ampel })

describe('K.O.-Liste mit vier Namen', () => {
  it('Qualitaet-Tab zeigt rotes "Geschaeftsmodell verstanden" als K.O. verletzt', () => {
    const html = renderToStaticMarkup(<QualitaetTab analysis={analysis([crit('Geschaeftsmodell verstanden', 'rot')])} />)
    expect(html).toContain('K.O. verletzt: Geschaeftsmodell verstanden')
  })

  it('Qualitaet-Tab: ein nicht rotes Geschaeftsmodell-Kriterium ist keine Verletzung', () => {
    const html = renderToStaticMarkup(<QualitaetTab analysis={analysis([crit('Geschaeftsmodell verstanden', 'gelb')])} />)
    expect(html).not.toContain('K.O. verletzt')
    expect(html).toContain('Keine verletzt')
  })

  it('Qualitaet-Tab: die drei bisherigen Namen bleiben K.O.-Kriterien', () => {
    for (const name of ['Keine Skandale', 'Keine schweren Vorwuerfe gegen Unternehmen', 'Keine schweren Vorwuerfe gegen Management']) {
      const html = renderToStaticMarkup(<QualitaetTab analysis={analysis([crit(name, 'rot')])} />)
      expect(html).toContain(`K.O. verletzt: ${name}`)
    }
  })

  it('PDF nennt rotes "Geschaeftsmodell verstanden" unter den K.O.-Kriterien', () => {
    const pdf = buildAnalysisPdf(analysis([crit('Geschaeftsmodell verstanden', 'rot')])).output()
    expect(pdf).toContain('K.O. verletzt: Geschaeftsmodell verstanden')
  })
})
