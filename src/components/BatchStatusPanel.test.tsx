import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BatchStatusPanel } from './BatchStatusPanel'
import { estimateBatch } from '../utils/batchEstimate'
import type { useBatchAnalysis } from '../hooks/useBatchAnalysis'

type Batch = ReturnType<typeof useBatchAnalysis>

function confirming(forceRefresh: boolean): Batch {
  return {
    phase: 'confirming',
    tickers: ['AAPL', 'MSFT'],
    index: 0,
    results: [],
    estimate: estimateBatch(2, forceRefresh ? 0 : 1, 0.036),
    estimating: false,
    forceRefresh,
    intervalSeconds: 30,
    setIntervalSeconds: () => {},
    wait: null,
    wakeLockActive: false,
    summary: { done: 0, cached: 0, skipped: 0, failed: 0, rescued: 0, keptOld: 0 },
    notSuccessful: [],
    prepare: async () => null,
    start: async () => {},
    resume: async () => {},
    cancel: () => {},
    reset: () => {},
  } as unknown as Batch
}

const render = (b: Batch) =>
  renderToStaticMarkup(
    <BatchStatusPanel batch={b} userId="u1" watchlistTickers={new Set()} onWatchlistChanged={() => {}} onOpenTicker={() => {}} />,
  )

describe('BatchStatusPanel: Bestätigung vor dem Start', () => {
  it('Watchlist-Batch (forceRefresh) zeigt Kosten und den Hinweis "erzwingt frische Läufe"', () => {
    const html = render(confirming(true))
    expect(html).toContain('erzwingt frische Läufe')
    expect(html).toContain('geschätzte Claude-Kosten ca. $0.07')
    expect(html).toContain('Ja, starten')
  })

  it('Index-/Freitext-Batch ohne diesen Hinweis', () => {
    expect(render(confirming(false))).not.toContain('erzwingt frische Läufe')
  })
})
