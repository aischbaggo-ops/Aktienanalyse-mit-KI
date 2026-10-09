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

describe('AnalysisResultsList mit externer Auswahl (Watchlist-Liste)', () => {
  const html = renderToStaticMarkup(
    <AnalysisResultsList
      rows={[
        { ticker: 'AAPL', name: 'Apple', sector: 'Technology', score: 72, metaLabel: '08.10.2026, 09:00:00' },
        { ticker: 'MSFT', name: 'Microsoft', score: 35 },
      ]}
      watchlistTickers={new Set(['AAPL', 'MSFT'])}
      userId="u1"
      onWatchlistChanged={() => {}}
      onOpenTicker={() => {}}
      showSelectAll
      colorMarker
      selection={{ selected: new Set(['AAPL']), onToggle: () => {}, onSelectShown: () => {} }}
    />,
  )

  it('zeigt Auswahl statt "zur Watchlist", ohne "auf Watchlist"-Hinweis', () => {
    expect(html).toContain('Alle angezeigten auswählen')
    expect(html).not.toContain('zur Watchlist hinzufügen')
    expect(html).not.toContain('auf Watchlist')
    expect(html).toContain('AAPL für Batch auswählen')
  })

  it('spiegelt die externe Auswahl in den Checkboxen', () => {
    const boxes = html.match(/<input[^>]*>/g) ?? []
    expect(boxes).toHaveLength(2)
    expect(boxes[0]).toContain('checked')
    expect(boxes[1]).not.toContain('checked')
  })

  it('zeigt Sektor, Analysedatum und die Farbmarkierung der Karten', () => {
    expect(html).toContain('Technology')
    expect(html).toContain('08.10.2026, 09:00:00')
    expect(html).toContain('border-memo-plus')
    expect(html).toContain('border-memo-minus')
  })
})
