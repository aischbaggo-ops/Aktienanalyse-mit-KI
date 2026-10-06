import { describe, expect, it } from 'vitest'
import { KO_WITHOUT_NEWS_NOTE, PROGNOSE_MULTIPLES_NOTE, koWithoutNewsHint } from './dataFlags'
import type { ChartData } from '../types/database'

const withStatus = (news_status?: 'ok' | 'blocked' | 'error' | 'empty') => ({
  chart_data: (news_status ? { data_flags: { news_status } } : {}) as ChartData,
})

describe('koWithoutNewsHint', () => {
  it('zeigt den Hinweis bei blocked, error und empty', () => {
    for (const s of ['blocked', 'error', 'empty'] as const) {
      expect(koWithoutNewsHint(withStatus(s))).toBe('K.O.-Kriterien ohne aktuelle News bewertet')
    }
  })

  it('zeigt keinen Hinweis bei ok', () => {
    expect(koWithoutNewsHint(withStatus('ok'))).toBeNull()
  })

  it('zeigt keinen Hinweis ohne data_flags (aeltere Zeilen) oder ohne chart_data', () => {
    expect(koWithoutNewsHint(withStatus())).toBeNull()
    expect(koWithoutNewsHint({ chart_data: null })).toBeNull()
  })
})

describe('Texte', () => {
  it('nennen weder einen Plan noch weichen sie vom vereinbarten Wortlaut ab', () => {
    expect(KO_WITHOUT_NEWS_NOTE).toBe('K.O.-Kriterien ohne aktuelle News bewertet')
    expect(PROGNOSE_MULTIPLES_NOTE).toContain('Standard-Multiples')
    expect(PROGNOSE_MULTIPLES_NOTE).toContain('Reife und Wachstum')
    expect(`${KO_WITHOUT_NEWS_NOTE} ${PROGNOSE_MULTIPLES_NOTE}`).not.toMatch(/free|plan|premium/i)
  })
})
