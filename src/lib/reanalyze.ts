import { FRESH_RUN_COST_HINT } from './preferences'

// Start fuer "Neu analysieren": Bestaetigung mit Kostenhinweis und Schutz
// gegen Doppelklick (ein zweiter Klick waehrend des Starts tut nichts).
// Rein, testbar in reanalyze.test.ts.

export function reanalyzeConfirmText(ticker: string): string {
  return `Neue Analyse für ${ticker} starten? Der 7-Tage-Cache wird übergangen, es entstehen Kosten (${FRESH_RUN_COST_HINT}). Die bisherige Analyse bleibt sichtbar, bis die neue fertig ist.`
}

export type ReanalyzeOutcome = 'started' | 'cancelled' | 'busy'

export function createReanalyzeStarter(deps: {
  ticker: string
  confirm: (message: string) => boolean
  request: () => Promise<void>
}): () => Promise<ReanalyzeOutcome> {
  let inFlight = false
  return async () => {
    if (inFlight) return 'busy'
    // Sperre schon vor der Rueckfrage setzen: ein zweiter Klick waehrend des
    // offenen Dialogs startet keinen zweiten Lauf.
    inFlight = true
    try {
      if (!deps.confirm(reanalyzeConfirmText(deps.ticker))) return 'cancelled'
      await deps.request()
      return 'started'
    } finally {
      inFlight = false
    }
  }
}
