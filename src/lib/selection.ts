// Auswahl in den Analyse-Tabellen (Watchlist: Batch-Auswahl, "Letzte
// Analysen": Kandidaten fuer die Watchlist). Rein, testbar in
// selection.test.ts. max = Obergrenze (Watchlist: MAX_BATCH_SIZE).

export interface SelectionResult {
  next: Set<string>
  // true, wenn wegen max nicht alles uebernommen wurde.
  capped: boolean
}

export function toggleSelection(current: Set<string>, ticker: string, max = Infinity): SelectionResult {
  const next = new Set(current)
  if (next.has(ticker)) {
    next.delete(ticker)
    return { next, capped: false }
  }
  if (next.size >= max) return { next: current, capped: true }
  next.add(ticker)
  return { next, capped: false }
}

// Kopfzeilen-Checkbox / "Alle angezeigten auswählen": ergaenzt die
// angezeigten Ticker bis zur Obergrenze, in Anzeigereihenfolge.
export function selectShown(current: Set<string>, shown: string[], max = Infinity): SelectionResult {
  const next = new Set(current)
  let capped = false
  for (const t of shown) {
    if (next.has(t)) continue
    if (next.size >= max) {
      capped = true
      break
    }
    next.add(t)
  }
  return { next, capped }
}

// Kopfzeilen-Checkbox abwaehlen: nur die angezeigten Ticker entfernen.
export function deselectShown(current: Set<string>, shown: string[]): Set<string> {
  const hide = new Set(shown)
  return new Set([...current].filter((t) => !hide.has(t)))
}

export type HeaderState = 'none' | 'some' | 'all'

export function headerState(current: Set<string>, shown: string[]): HeaderState {
  if (shown.length === 0) return 'none'
  const n = shown.filter((t) => current.has(t)).length
  return n === 0 ? 'none' : n === shown.length ? 'all' : 'some'
}
