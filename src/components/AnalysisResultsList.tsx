import { useState } from 'react'
import { supabase } from '../lib/supabase'

export interface AnalysisResultRow {
  ticker: string
  name?: string | null
  image?: string | null
  score: number | null
  analysisId?: string | null
  // true = Ergebnis kam aus dem Cache (nur bei Batch-Laeufen relevant).
  cached?: boolean
  // optionales kleines Label rechts vor dem Score, z.B. ein formatiertes
  // Datum oder ein Status ("läuft") - vom Aufrufer frei belegbar.
  metaLabel?: string
}

// Scrollbare Ergebnisliste mit Checkbox-Mehrfachauswahl und Sammel-Button
// "X zur Watchlist hinzufügen". Urspruenglich nur im Batch-Ergebnis-Panel,
// jetzt auch von "Letzte Analysen" genutzt (siehe DashboardPage) - beide
// nutzen dieselbe Komponente statt zwei aehnliche UIs zu pflegen.
//
// Sortierung liegt bewusst beim Aufrufer (Batch: nach Score, "Letzte
// Analysen": nach Datum) - die Liste rendert nur die uebergebene
// Reihenfolge.
export function AnalysisResultsList({
  rows,
  watchlistTickers,
  userId,
  onWatchlistChanged,
  onOpenTicker,
  heading,
}: {
  rows: AnalysisResultRow[]
  watchlistTickers: Set<string>
  userId: string | undefined
  onWatchlistChanged: () => void
  onOpenTicker: (ticker: string) => void
  heading?: string
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (rows.length === 0) return null

  function toggle(ticker: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  async function addToWatchlist() {
    if (!userId || picked.size === 0) return
    setBusy(true)
    setError(null)
    const now = new Date().toISOString()
    const toAdd = rows.filter((r) => picked.has(r.ticker) && !watchlistTickers.has(r.ticker))
    const insertRows = toAdd.map((r) => ({
      user_id: userId,
      ticker: r.ticker,
      analysis_id: r.analysisId ?? null,
      added_at: now,
    }))
    const { error: err } = insertRows.length > 0 ? await supabase.from('watchlists').insert(insertRows) : { error: null }
    setBusy(false)
    if (err) {
      console.error('Watchlist insert fehlgeschlagen:', err)
      setError(err.message)
      return
    }
    setPicked(new Set())
    onWatchlistChanged()
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        {heading ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-memo-muted">{heading}</p>
        ) : (
          <span />
        )}
        <button
          onClick={addToWatchlist}
          disabled={busy || picked.size === 0}
          className="rounded-md border border-memo-line px-3 py-1 text-xs font-medium text-memo-ink transition-colors hover:border-memo-ink disabled:opacity-50"
        >
          {picked.size} zur Watchlist hinzufügen
        </button>
      </div>
      <ul className="max-h-80 divide-y divide-memo-line2 overflow-y-auto rounded-lg border border-memo-line">
        {rows.map((r) => {
          const onList = watchlistTickers.has(r.ticker)
          return (
            <li
              key={r.ticker}
              onClick={() => onOpenTicker(r.ticker)}
              className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-memo-paper"
            >
              <input
                type="checkbox"
                checked={onList || picked.has(r.ticker)}
                disabled={onList}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggle(r.ticker)}
                aria-label={`${r.ticker} zur Watchlist`}
                className="h-4 w-4 flex-shrink-0 accent-navy-700"
              />
              {r.image && (
                <img
                  src={r.image}
                  alt=""
                  className="h-6 w-6 flex-shrink-0 rounded-sm border border-memo-line2 bg-white object-contain"
                />
              )}
              <span className="min-w-0 flex-1 truncate">
                <span className="font-analyst text-memo-ink">{r.ticker}</span>{' '}
                <span className="text-xs text-memo-muted">{r.name ?? ''}</span>
              </span>
              {r.metaLabel && <span className="whitespace-nowrap text-[11px] text-memo-muted">{r.metaLabel}</span>}
              {r.cached && <span className="whitespace-nowrap text-[11px] text-memo-muted">Cache</span>}
              {onList && <span className="whitespace-nowrap text-[11px] text-memo-muted">auf Watchlist</span>}
              <span className="w-8 flex-shrink-0 text-right font-semibold text-navy-950">{r.score ?? '–'}</span>
            </li>
          )
        })}
      </ul>
      {error && <p className="mt-2 text-xs text-ampel-red">Watchlist-Aktion fehlgeschlagen: {error}</p>}
    </div>
  )
}
