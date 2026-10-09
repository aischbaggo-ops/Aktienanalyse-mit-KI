import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { AnalysisTable } from '../components/AnalysisTable'
import {
  ALL_ANALYSES_SELECT,
  filterByIndex,
  INDEX_FILTERS,
  normalizeRow,
  type AnalysisTableRow,
  type IndexFilter,
} from '../lib/analysisTable'
import { addTickersToWatchlist, attachErrorInfo, downloadAnalysisPdf } from '../lib/analysisData'

// "Alle Analysen": alle gespeicherten Analysen aus der View analysis_ranking
// in der gemeinsamen Tabelle (Suche, Filter, Sortierung wie Watchlist und
// "Letzte Analysen"). Auswahl -> "zur Watchlist hinzufügen".
export function AlleAnalysenPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [rows, setRows] = useState<AnalysisTableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [indexFilter, setIndexFilter] = useState<IndexFilter>('us')
  const [watchlistTickers, setWatchlistTickers] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [downloadingTicker, setDownloadingTicker] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase.from('analysis_ranking').select(ALL_ANALYSES_SELECT).order('ticker')
      if (cancelled) return
      if (error) {
        console.error('Alle Analysen konnten nicht geladen werden:', error.message)
        setLoadError('Analysen konnten nicht geladen werden.')
      }
      const normalized = ((data ?? []) as unknown as Record<string, unknown>[]).map((raw) => ({
        ...normalizeRow(raw),
        indices: Array.isArray(raw.indices) ? (raw.indices as string[]) : null,
      }))
      const withInfo = await attachErrorInfo(normalized)
      if (cancelled) return
      setRows(withInfo)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function loadWatchlistTickers() {
    if (!user) return
    const { data } = await supabase.from('watchlists').select('ticker').eq('user_id', user.id)
    setWatchlistTickers(new Set(((data ?? []) as { ticker: string }[]).map((w) => w.ticker)))
  }

  useEffect(() => {
    loadWatchlistTickers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const shownRows = useMemo(() => filterByIndex(rows, indexFilter), [rows, indexFilter])
  const pickable = [...picked].filter((t) => !watchlistTickers.has(t))

  async function addToWatchlist() {
    if (!user || pickable.length === 0) return
    setAddBusy(true)
    setAddError(null)
    const error = await addTickersToWatchlist(user.id, pickable)
    setAddBusy(false)
    if (error) {
      setAddError(error)
      return
    }
    setPicked(new Set())
    loadWatchlistTickers()
  }

  async function handleDownloadPdf(ticker: string) {
    setDownloadError(null)
    setDownloadingTicker(ticker)
    try {
      const error = await downloadAnalysisPdf(ticker)
      if (error) setDownloadError(error)
    } finally {
      setDownloadingTicker(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-navy-950">Alle Analysen</h1>
        <select
          value={indexFilter}
          onChange={(e) => setIndexFilter(e.target.value as IndexFilter)}
          aria-label="Index"
          className="rounded-md border border-memo-line bg-white px-2 py-1 text-xs text-memo-ink"
        >
          {INDEX_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {downloadError && (
        <div className="rounded-xl border border-ampel-red/40 bg-ampel-red/10 p-3 text-sm text-ampel-red">{downloadError}</div>
      )}

      {loading ? (
        <p className="text-sm text-memo-muted">Lade...</p>
      ) : loadError ? (
        <p className="text-sm text-ampel-red">{loadError}</p>
      ) : shownRows.length === 0 ? (
        <p className="text-sm text-memo-muted">Keine Analysen für diese Auswahl.</p>
      ) : (
        <>
          <AnalysisTable
            rows={shownRows}
            storageKey="alle-analysen"
            selected={picked}
            onSelectionChange={setPicked}
            isRowLocked={(t) => watchlistTickers.has(t)}
            rowTag={(t) => (watchlistTickers.has(t) ? 'auf Watchlist' : null)}
            onOpenTicker={(t) => navigate(`/analyse/${encodeURIComponent(t)}`)}
            onDownloadPdf={handleDownloadPdf}
            downloadingTicker={downloadingTicker}
            actions={
              <button
                onClick={addToWatchlist}
                disabled={addBusy || pickable.length === 0}
                className="rounded-md border border-memo-line px-3 py-1 text-xs font-medium text-memo-ink transition-colors hover:border-memo-ink disabled:opacity-50"
              >
                {pickable.length} zur Watchlist hinzufügen
              </button>
            }
          />
          {addError && <p className="text-xs text-ampel-red">Watchlist-Aktion fehlgeschlagen: {addError}</p>}
        </>
      )}
    </div>
  )
}
