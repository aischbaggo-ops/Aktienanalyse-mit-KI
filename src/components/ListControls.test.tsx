import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ListControls, emptyFilterText } from './ListControls'

describe('ListControls', () => {
  it('zeigt Sortierung, Filter, Zuruecksetzen und Zaehler', () => {
    const html = renderToStaticMarkup(
      <ListControls
        sort="score_desc"
        onSortChange={() => {}}
        minScoreInput="70"
        onMinScoreInputChange={() => {}}
        shown={12}
        total={245}
        dateSortLabel="Analysedatum (neueste zuerst)"
      />,
    )
    expect(html).toContain('Score absteigend')
    expect(html).toContain('Analysedatum (neueste zuerst)')
    expect(html).toContain('Score ab')
    expect(html).toContain('Zurücksetzen')
    expect(html).toContain('12 von 245 angezeigt')
  })

  it('Text bei leerem Filterergebnis', () => {
    expect(emptyFilterText('80')).toBe('Keine Analyse mit Score ab 80.')
  })
})
