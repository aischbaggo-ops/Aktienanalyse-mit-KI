import { describe, expect, it } from 'vitest'
import {
  batchRunOutcome,
  formatAnalysisDate,
  KEPT_OLD_ANALYSIS_MESSAGE,
  needsPolling,
  refreshNotice,
  STALE_RUN_MS,
} from './analysisRun'

const NOW = Date.parse('2026-10-07T10:00:00.000Z')
const ANALYSIS_DATE = '2026-10-05T08:00:00.000Z'

const valid = (overrides: Record<string, unknown> = {}) => ({
  status: 'done' as const,
  score_total: 70,
  updated_at: ANALYSIS_DATE,
  last_run_status: 'done' as const,
  last_run_at: '2026-10-05T07:59:30.000Z',
  last_run_error_public: null,
  ...overrides,
})

describe('refreshNotice', () => {
  it('zeigt bei done + error das Banner mit Datum der gueltigen Analyse und oeffentlicher Meldung', () => {
    const n = refreshNotice(
      valid({ last_run_status: 'error', last_run_at: '2026-10-07T09:58:00.000Z', last_run_error_public: 'FMP-Limit erreicht.' }),
      NOW,
    )
    expect(n).toEqual({
      kind: 'failed',
      text: `Aktualisierung fehlgeschlagen, angezeigt wird die Analyse vom ${formatAnalysisDate(ANALYSIS_DATE)}.`,
      detail: 'FMP-Limit erreicht.',
    })
  })

  it('zeigt das Banner auch ohne oeffentliche Meldung', () => {
    const n = refreshNotice(valid({ last_run_status: 'error' }), NOW)
    expect(n?.kind).toBe('failed')
    expect(n?.kind === 'failed' && n.detail).toBeNull()
  })

  it('zeigt bei laufendem Refresh den Hinweis "Aktualisierung läuft"', () => {
    const n = refreshNotice(valid({ last_run_status: 'running', last_run_at: '2026-10-07T09:59:40.000Z' }), NOW)
    expect(n?.kind).toBe('running')
    expect(n?.text).toContain('Aktualisierung läuft')
    expect(n?.text).toContain(formatAnalysisDate(ANALYSIS_DATE))
  })

  it('zeigt keinen Hinweis bei erfolgreichem Lauf, alten Zeilen oder ohne gueltige Analyse', () => {
    expect(refreshNotice(valid(), NOW)).toBeNull()
    expect(refreshNotice(valid({ last_run_status: null, last_run_at: null }), NOW)).toBeNull()
    expect(refreshNotice(valid({ status: 'error', score_total: null, last_run_status: 'error' }), NOW)).toBeNull()
  })

  it('ignoriert einen haengengebliebenen Lauf', () => {
    const stale = new Date(NOW - STALE_RUN_MS - 1000).toISOString()
    expect(refreshNotice(valid({ last_run_status: 'running', last_run_at: stale }), NOW)).toBeNull()
  })
})

describe('needsPolling', () => {
  it('pollt bei Erstlauf und laufendem Refresh, nicht bei Endstand', () => {
    expect(needsPolling(null, NOW)).toBe(true)
    expect(needsPolling(valid({ status: 'running', score_total: null, last_run_status: 'running' }), NOW)).toBe(true)
    expect(needsPolling(valid({ last_run_status: 'running', last_run_at: '2026-10-07T09:59:40.000Z' }), NOW)).toBe(true)
    expect(needsPolling(valid(), NOW)).toBe(false)
    expect(needsPolling(valid({ last_run_status: 'error' }), NOW)).toBe(false)
  })
})

describe('batchRunOutcome', () => {
  it('Erfolg nur bei last_run_status done', () => {
    expect(batchRunOutcome(valid())).toBe('done')
  })

  it('Fehlschlag mit alter Analyse wird als "alte Analyse behalten" gemeldet, nicht als Erfolg', () => {
    expect(batchRunOutcome(valid({ last_run_status: 'error' }))).toBe('error_kept')
    expect(KEPT_OLD_ANALYSIS_MESSAGE).toBe('Aktualisierung fehlgeschlagen, alte Analyse behalten')
  })

  it('Fehlschlag ohne gueltige Analyse ist ein Fehler', () => {
    expect(batchRunOutcome({ status: 'error', score_total: null, last_run_status: 'error' })).toBe('error')
  })

  it('ein laufender Refresh ist noch nicht beendet, auch wenn status done ist', () => {
    expect(batchRunOutcome(valid({ last_run_status: 'running' }))).toBe('pending')
    expect(batchRunOutcome(null)).toBe('pending')
  })

  it('Zeilen ohne last_run_status werden wie bisher am status ausgewertet', () => {
    expect(batchRunOutcome({ status: 'done', score_total: 70, last_run_status: null })).toBe('done')
    expect(batchRunOutcome({ status: 'error', score_total: null, last_run_status: null })).toBe('error')
    expect(batchRunOutcome({ status: 'running', score_total: null, last_run_status: null })).toBe('pending')
  })
})
