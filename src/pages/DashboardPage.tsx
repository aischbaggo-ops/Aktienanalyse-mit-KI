import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { requestAnalyse, SymbolSearchResult } from '../lib/webhooks'
import { SymbolSearch } from '../components/SymbolSearch'
import { ScoreBadge } from '../components/ScoreBadge'
import { generateAnalysisPdf } from '../utils/pdfExport'
import type { StockAnalysis, WatchlistWithAnalysis } from '../types/database'

type MaxAge = '1' | '7' | '30' | 'always'

const MAX_AGE_OPTIONS: { value: MaxAge; label: string }[] = [
  { value: '1', label: '24 Stunden' },
  { value: '7', label: '7 Tage (Standard)' },
  { value: '30', label: '30 Tage' },
  { value: 'always', label: 'Immer neu laden' },
]

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [selected, setSelected] = useState<SymbolSearchResult | null>(null)
  const [maxAge, setMaxAge] = useState<MaxAge>('7')
  const [analysing, setAnalysing] = useState(false)
  const [analyseError, setAnalyseError] = useState<string | null>(null)

  const [recent, setRecent] = useState<StockAnalysis[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  const [watchlist, setWatchlist] = useState<WatchlistWithAnalysis[]>([])
  const [watchlistLoading, setWatchlistLoading] = useState(true)

  const [downloadingTicker, setDownloadingTicker] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    loadRecent()
    loadWatchlist()
  }, [])

  async function loadRecent() {
    setRecentLoading(true)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('stock_analyses')
      .select('*')
      .gt('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(5)
    setRecent(data ?? [])
    setRecentLoading(false)
  }

  async function loadWatchlist() {
    if (!user) return
    setWatchlistLoading(true)
    const { data } = await supabase
      .from('watchlists')
      .select('*, stock_analyses!watchlists_ticker_fkey(*)')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false })
    setWatchlist((data as unknown as WatchlistWithAnalysis[]) ?? [])
    setWatchlistLoading(false)
  }

  async function handleDownloadPdf(ticker: string) {
    setDownloadError(null)
    setDownloadingTicker(ticker)
    try {
      const { data, error } = await supabase
        .from('stock_analyses')
        .select('*')
        .eq('ticker', ticker)
        .maybeSingle()
      if (error || !data) {
        console.error('PDF-Download fehlgeschlagen (vollständige Analyse konnte nicht geladen werden):', error)
        setDownloadError(`PDF für ${ticker} konnte nicht erstellt werden.`)
        return
      }
      generateAnalysisPdf(data)
    } finally {
      setDownloadingTicker(null)
    }
  }

  async function handleAnalyse() {
    if (!selected || !user) return
    setAnalysing(true)
    setAnalyseError(null)
    try {
      const forceRefresh = maxAge === 'always'
      const payload = {
        ticker: selected.symbol,
        user_id: user.id,
        max_age_days: forceRefresh ? null : Number(maxAge),
        force_refresh: forceRefresh,
      }
      await requestAnalyse(payload)
      navigate(`/analyse/${encodeURIComponent(selected.symbol)}`)
    } catch (err) {
      setAnalyseError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setAnalysing(false)
    }
  }

  return (
    <div className="space-y-8">
      {downloadError && (
        <div className="rounded-xl border border-ampel-red/40 bg-ampel-red/10 p-3 text-sm text-ampel-red">
          {downloadError}
        </div>
      )}

      <section className="rounded-xl border border-navy-200 bg-white p-6 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-navy-950">Aktie analysieren</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <SymbolSearch onSelect={setSelected} />
          <select
            value={maxAge}
            onChange={(e) => setMaxAge(e.target.value as MaxAge)}
            className="rounded-lg border border-navy-200 bg-navy-50 px-3 py-2.5 text-sm text-navy-950 outline-none focus:border-gold-500"
          >
            {MAX_AGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleAnalyse}
            disabled={!selected || analysing}
            className="rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-400 disabled:opacity-50"
          >
            {analysing ? 'Analysiere...' : 'Analysieren'}
          </button>
        </div>
        {selected && (
          <p className="mt-2 text-xs text-navy-600">
            Ausgewählt: <span className="font-semibold text-gold-500">{selected.symbol}</span> —{' '}
            {selected.name}
          </p>
        )}
        {analyseError && <p className="mt-2 text-sm text-ampel-red">{analyseError}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-navy-950">Letzte Analysen (24h)</h2>
        <div className="rounded-xl border border-navy-200 bg-white shadow-card">
          {recentLoading ? (
            <p className="p-5 text-sm text-navy-500">Lade...</p>
          ) : recent.length === 0 ? (
            <p className="p-5 text-sm text-navy-500">Noch keine Analysen in den letzten 24h.</p>
          ) : (
            <ul className="divide-y divide-navy-100">
              {recent.map((a) => (
                <li
                  key={a.ticker}
                  className="flex items-center gap-2 px-5 py-3.5 transition-colors hover:bg-navy-50"
                >
                  <button
                    onClick={() => navigate(`/analyse/${encodeURIComponent(a.ticker)}`)}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  >
                    <ScoreBadge score={a.score_total} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy-950">
                        {a.ticker}
                        {a.company_name ? ` — ${a.company_name}` : ''}
                      </p>
                      <p className="text-xs text-navy-500">
                        {a.sector ?? '–'} · Status: {a.status}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-navy-500">
                      {new Date(a.updated_at).toLocaleString('de-DE')}
                    </span>
                  </button>
                  <DownloadPdfButton
                    ticker={a.ticker}
                    downloading={downloadingTicker === a.ticker}
                    onClick={() => handleDownloadPdf(a.ticker)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-navy-950">Meine Watchlist</h2>
        <div className="rounded-xl border border-navy-200 bg-white shadow-card">
          {watchlistLoading ? (
            <p className="p-5 text-sm text-navy-500">Lade...</p>
          ) : watchlist.length === 0 ? (
            <p className="p-5 text-sm text-navy-500">Deine Watchlist ist leer.</p>
          ) : (
            <ul className="divide-y divide-navy-100">
              {watchlist.map((w) => (
                <li
                  key={w.ticker}
                  className="flex items-center gap-2 px-5 py-3.5 transition-colors hover:bg-navy-50"
                >
                  <button
                    onClick={() => navigate(`/analyse/${encodeURIComponent(w.ticker)}`)}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  >
                    <ScoreBadge score={w.stock_analyses?.score_total ?? null} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy-950">
                        {w.ticker}
                        {w.stock_analyses?.company_name ? ` — ${w.stock_analyses.company_name}` : ''}
                      </p>
                      <p className="text-xs text-navy-500">
                        {w.stock_analyses?.sector ?? '–'}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-navy-500">
                      Hinzugefügt {new Date(w.added_at).toLocaleDateString('de-DE')}
                    </span>
                  </button>
                  <DownloadPdfButton
                    ticker={w.ticker}
                    downloading={downloadingTicker === w.ticker}
                    onClick={() => handleDownloadPdf(w.ticker)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function DownloadPdfButton({
  ticker,
  downloading,
  onClick,
}: {
  ticker: string
  downloading: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={downloading}
      title={`PDF für ${ticker} herunterladen`}
      aria-label={`PDF für ${ticker} herunterladen`}
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-navy-400 transition-colors hover:bg-navy-100 hover:text-gold-500 disabled:opacity-50"
    >
      {downloading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-navy-200 border-t-gold-500" />
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      )}
    </button>
  )
}
