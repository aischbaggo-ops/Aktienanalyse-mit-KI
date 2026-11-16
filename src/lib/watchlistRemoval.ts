// Werte von der Watchlist entfernen: die reine Logik, ohne Netz und ohne React,
// testbar in watchlistRemoval.test.ts. Der Datenbankaufruf steht in
// analysisData.ts (removeTickersFromWatchlist).
//
// Anlass (16.11.2026): Die Dashboard-Watchlist hatte keinen Entfernen-Knopf.
// Der einzige Weg war der Stern auf der Analyse-Seite des einzelnen Werts.

// Je Anfrage hoechstens so viele Ticker: der ticker-Filter steht in der URL,
// und die Auswahl ist ohnehin auf MAX_BATCH_SIZE (100) begrenzt.
export const REMOVE_CHUNK_SIZE = 50

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export interface RemovalResult {
  // Tatsaechlich geloeschte Ticker (von der Datenbank zurueckgemeldet).
  removed: string[]
  // Angefragt, aber noch auf der Watchlist.
  missing: string[]
  error: string | null
}

// Wertet das Ergebnis aus. Eine Zeile, die Row-Level-Security nicht loeschen
// darf, wird von Supabase STILL uebersprungen und ohne Fehler gemeldet - nur
// die zurueckgegebenen Zeilen zeigen, was wirklich geloescht wurde. Ohne
// diesen Vergleich saehe das Entfernen "erfolgreich" aus, obwohl nichts
// passiert ist.
export function removalOutcome(requested: string[], removed: string[], dbError: string | null): RemovalResult {
  const gone = new Set(removed)
  const missing = requested.filter((t) => !gone.has(t))
  if (dbError) {
    return { removed, missing, error: `Entfernen fehlgeschlagen: ${dbError}` }
  }
  if (missing.length > 0) {
    const nenne = missing.slice(0, 5).join(', ') + (missing.length > 5 ? ` und ${missing.length - 5} weitere` : '')
    return {
      removed,
      missing,
      error: `Nur ${removed.length} von ${requested.length} entfernt (${nenne} sind noch auf der Watchlist).`,
    }
  }
  return { removed, missing, error: null }
}

// Rueckfrage vor dem Entfernen. Sagt ausdruecklich, dass die Analysen bleiben:
// nur der Eintrag auf der Watchlist verschwindet.
export function removalConfirmText(tickers: string[]): string {
  const zeigen = 12
  const liste = tickers.slice(0, zeigen).join(', ') + (tickers.length > zeigen ? ` und ${tickers.length - zeigen} weitere` : '')
  const was = tickers.length === 1 ? '1 Wert' : `${tickers.length} Werte`
  return `${was} von der Watchlist entfernen?\n\n${liste}\n\nDie Analysen bleiben erhalten, nur der Eintrag auf der Watchlist verschwindet. Du kannst die Werte jederzeit wieder hinzufügen.`
}
