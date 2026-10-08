import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnalysisResultsList } from './AnalysisResultsList'

const rows = [
  { ticker: 'AAPL', name: 'Apple', score: 70 },
  { ticker: 'MSFT', name: 'Microsoft', score: 78 },
]

const render = (showSelectAll?: boolean) =>
  renderToStaticMarkup(
    <AnalysisResultsList
      rows={rows}
      watchlistTickers={new Set(['MSFT'])}
      userId="u1"
      onWatchlistChanged={() => {}}
      onOpenTicker={() => {}}
      showSelectAll={showSelectAll}
    />,
  )

describe('AnalysisResultsList', () => {
  it('zeigt "Alle angezeigten auswählen" nur, wenn showSelectAll gesetzt ist', () => {
    expect(render(true)).toContain('Alle angezeigten auswählen')
    expect(render()).not.toContain('Alle angezeigten auswählen')
  })

  it('ohne showSelectAll bleibt die Liste wie bisher (Batch-Ergebnis)', () => {
    const html = render()
    expect(html).toContain('0 zur Watchlist hinzufügen')
    expect(html).toContain('AAPL')
    expect(html).toContain('auf Watchlist')
  })
})
