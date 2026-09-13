import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { requestAnalyse, SymbolSearchResult } from '../lib/webhooks'
import { SymbolSearch } from '../components/SymbolSearch'
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
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set())

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

  function toggleTicker(ticker: string) {
    setSelectedTickers((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
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
        {recentLoading ? (
          <p className="text-sm text-navy-500">Lade...</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-navy-500">Noch keine Analysen in den letzten 24h.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((a) => (
              <DashboardTile
                key={a.ticker}
                ticker={a.ticker}
                sector={a.sector}
                name={a.company_name ?? a.ticker}
                score={a.score_total}
                scoreLabel={`Status: ${a.status}`}
                meta={new Date(a.updated_at).toLocaleString('de-DE')}
                onClick={() => navigate(`/analyse/${encodeURIComponent(a.ticker)}`)}
                onDownloadPdf={() => handleDownloadPdf(a.ticker)}
                downloading={downloadingTicker === a.ticker}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-navy-950">Meine Watchlist</h2>
          {selectedTickers.size > 0 && (
            <>
              <span className="text-xs text-navy-500">{selectedTickers.size} ausgewählt</span>
              <button
                disabled
                title="Batch-Analyse folgt in einem späteren Update"
                className="cursor-not-allowed rounded-md border border-navy-200 px-3 py-1 text-xs font-medium text-navy-400"
              >
                Batch-Analyse (bald verfügbar)
              </button>
            </>
          )}
        </div>
        {watchlistLoading ? (
          <p className="text-sm text-navy-500">Lade...</p>
        ) : watchlist.length === 0 ? (
          <p className="text-sm text-navy-500">Deine Watchlist ist leer.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {watchlist.map((w) => (
              <DashboardTile
                key={w.ticker}
                ticker={w.ticker}
                sector={w.stock_analyses?.sector ?? null}
                name={w.stock_analyses?.company_name ?? w.ticker}
                score={w.stock_analyses?.score_total ?? null}
                scoreLabel={`seit ${new Date(w.added_at).toLocaleDateString('de-DE')}`}
                onClick={() => navigate(`/analyse/${encodeURIComponent(w.ticker)}`)}
                onDownloadPdf={() => handleDownloadPdf(w.ticker)}
                downloading={downloadingTicker === w.ticker}
                checked={selectedTickers.has(w.ticker)}
                onToggleChecked={() => toggleTicker(w.ticker)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function DashboardTile({
  ticker,
  sector,
  name,
  score,
  scoreLabel,
  meta,
  onClick,
  onDownloadPdf,
  downloading,
  checked,
  onToggleChecked,
}: {
  ticker: string
  sector: string | null
  name: string
  score: number | null
  scoreLabel: string
  meta?: string
  onClick: () => void
  onDownloadPdf: () => void
  downloading: boolean
  checked?: boolean
  onToggleChecked?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="relative cursor-pointer rounded-lg border border-navy-200 bg-white p-4 transition-colors hover:border-gold-500"
    >
      {onToggleChecked && (
        <input
          type="checkbox"
          checked={checked ?? false}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggleChecked}
          className="absolute right-3.5 top-3.5 h-4 w-4 accent-navy-700"
        />
      )}
      <p className="truncate pr-6 text-xs text-navy-500">
        {ticker}
        {sector ? ` · ${sector}` : ''}
      </p>
      <p className="mb-2.5 mt-0.5 truncate pr-6 font-analyst text-lg text-navy-950">{name}</p>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className={`text-2xl font-semibold ${score == null ? 'text-memo-grau' : 'text-navy-950'}`}>
          {score ?? '–'}
        </span>
        <span className="whitespace-nowrap text-[11px] text-navy-400">{scoreLabel}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-navy-400">{meta ?? ''}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDownloadPdf()
          }}
          disabled={downloading}
          title={`PDF für ${ticker} herunterladen`}
          aria-label={`PDF für ${ticker} herunterladen`}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-navy-400 transition-colors hover:bg-navy-100 hover:text-gold-500 disabled:opacity-50"
        >
          {downloading ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-navy-200 border-t-gold-500" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
