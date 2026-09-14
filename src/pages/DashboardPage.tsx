import { useEffect, useRef, useState } from 'react'
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

type BatchPhase = 'idle' | 'confirming' | 'running' | 'done'
interface BatchResult {
  ticker: string
  success: boolean
  error?: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

  const [batchPhase, setBatchPhase] = useState<BatchPhase>('idle')
  const [batchTickers, setBatchTickers] = useState<string[]>([])
  const [batchIndex, setBatchIndex] = useState(0)
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])
  const [batchCostEstimate, setBatchCostEstimate] = useState<number | null>(null)
  const [batchEstimating, setBatchEstimating] = useState(false)
  const batchCancelRef = useRef(false)

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
    if (batchPhase !== 'idle') return
    setSelectedTickers((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  async function openBatchConfirm() {
    const tickers = [...selectedTickers]
    if (tickers.length === 0) return
    setBatchTickers(tickers)
    setBatchPhase('confirming')
    setBatchEstimating(true)
    const { data } = await supabase
      .from('stock_analyses')
      .select('cost_usd_claude')
      .not('cost_usd_claude', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(20)
    const costs = (data ?? [])
      .map((r) => r.cost_usd_claude as number | null)
      .filter((c): c is number => typeof c === 'number')
    setBatchCostEstimate(costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : null)
    setBatchEstimating(false)
  }

  function cancelBatchConfirm() {
    setBatchPhase('idle')
    setBatchTickers([])
    setBatchCostEstimate(null)
  }

  // Wartet auf den tatsaechlichen Abschluss einer Analyse (Polling auf
  // status), statt nur auf die HTTP-Antwort von requestAnalyse() - die
  // kehrt sofort zurueck, waehrend die eigentliche Analyse per waitUntil()
  // im Hintergrund weiterlaeuft. Ohne dieses Warten wuerde "sequenziell"
  // nur die Request-Ausloesung betreffen, nicht die tatsaechliche
  // FMP/Claude-Arbeit - und genau die soll wegen Rate-Limits nicht
  // parallel laufen.
  async function waitForAnalysisDone(ticker: string, timeoutMs = 90_000): Promise<'done' | 'error' | 'timeout'> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const { data } = await supabase.from('stock_analyses').select('status').eq('ticker', ticker).maybeSingle()
      if (data?.status === 'done') return 'done'
      if (data?.status === 'error') return 'error'
      await sleep(2500)
    }
    return 'timeout'
  }

  async function startBatch() {
    if (!user) return
    const tickers = batchTickers
    setBatchPhase('running')
    setBatchIndex(0)
    setBatchResults([])
    batchCancelRef.current = false

    const forceRefresh = maxAge === 'always'

    for (let i = 0; i < tickers.length; i++) {
      if (batchCancelRef.current) break
      setBatchIndex(i)
      const ticker = tickers[i]
      try {
        await requestAnalyse({
          ticker,
          user_id: user.id,
          max_age_days: forceRefresh ? null : Number(maxAge),
          force_refresh: forceRefresh,
        })
        const outcome = await waitForAnalysisDone(ticker)
        if (outcome === 'done') {
          setBatchResults((prev) => [...prev, { ticker, success: true }])
        } else if (outcome === 'error') {
          setBatchResults((prev) => [...prev, { ticker, success: false, error: 'Analyse fehlgeschlagen' }])
        } else {
          setBatchResults((prev) => [...prev, { ticker, success: false, error: 'Zeitüberschreitung beim Warten auf Ergebnis' }])
        }
      } catch (err) {
        setBatchResults((prev) => [
          ...prev,
          { ticker, success: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
        ])
      }
    }

    setBatchPhase('done')
    setSelectedTickers(new Set())
    loadWatchlist()
    loadRecent()
  }

  function cancelRunningBatch() {
    batchCancelRef.current = true
  }

  function closeBatchSummary() {
    setBatchPhase('idle')
    setBatchTickers([])
    setBatchResults([])
    setBatchCostEstimate(null)
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

      <section className="rounded-xl border border-memo-line bg-white p-6 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-navy-950">Aktie analysieren</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <SymbolSearch onSelect={setSelected} />
          <select
            value={maxAge}
            onChange={(e) => setMaxAge(e.target.value as MaxAge)}
            className="rounded-lg border border-memo-line bg-white px-3 py-2.5 text-sm text-navy-950 outline-none focus:border-memo-ink"
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
            className="rounded-lg bg-memo-ink px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {analysing ? 'Analysiere...' : 'Analysieren'}
          </button>
        </div>
        {selected && (
          <p className="mt-2 text-xs text-memo-muted">
            Ausgewählt: <span className="font-analyst text-memo-ink">{selected.symbol}</span> —{' '}
            {selected.name}
          </p>
        )}
        {analyseError && <p className="mt-2 text-sm text-ampel-red">{analyseError}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-navy-950">Letzte Analysen (24h)</h2>
        {recentLoading ? (
          <p className="text-sm text-memo-muted">Lade...</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-memo-muted">Noch keine Analysen in den letzten 24h.</p>
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
          {selectedTickers.size > 0 && batchPhase === 'idle' && (
            <>
              <span className="text-xs text-memo-muted">{selectedTickers.size} ausgewählt</span>
              <button
                onClick={openBatchConfirm}
                className="rounded-md border border-memo-line px-3 py-1 text-xs font-medium text-memo-ink transition-colors hover:border-memo-ink"
              >
                Batch-Analyse starten
              </button>
            </>
          )}
        </div>

        {batchPhase === 'confirming' && (
          <div className="mb-4 rounded-lg border border-memo-line bg-white p-4">
            <p className="text-sm text-memo-ink">
              {batchTickers.length} Analysen werden gestartet
              {batchEstimating
                ? ' — Kostenschätzung wird geladen...'
                : batchCostEstimate != null
                  ? ` — geschätzte Kosten ca. $${(batchCostEstimate * batchTickers.length).toFixed(2)} (Ø $${batchCostEstimate.toFixed(4)}/Analyse aus den letzten 20 Läufen).`
                  : ' — keine Kostenschätzung verfügbar (noch keine historischen Daten).'}{' '}
              Das kostet echtes Geld. Fortfahren?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={startBatch}
                disabled={batchEstimating}
                className="rounded-md bg-memo-ink px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Ja, starten
              </button>
              <button
                onClick={cancelBatchConfirm}
                className="rounded-md border border-memo-line px-4 py-1.5 text-xs font-medium text-memo-muted transition-colors hover:border-memo-ink hover:text-memo-ink"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {batchPhase === 'running' && (
          <div className="mb-4 rounded-lg border border-memo-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-memo-ink">
                {batchIndex + 1} von {batchTickers.length}:{' '}
                <span className="font-analyst text-memo-ink">{batchTickers[batchIndex]}</span> läuft...
              </p>
              <button onClick={cancelRunningBatch} className="whitespace-nowrap text-xs text-memo-muted hover:text-memo-ink">
                Abbrechen
              </button>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-memo-paper">
              <div
                className="h-full bg-memo-ink transition-all duration-500"
                style={{ width: `${(batchIndex / batchTickers.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {batchPhase === 'done' && (
          <div className="mb-4 rounded-lg border border-memo-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-memo-ink">
                Batch abgeschlossen: {batchResults.filter((r) => r.success).length} erfolgreich
                {batchResults.some((r) => !r.success) &&
                  `, ${batchResults.filter((r) => !r.success).length} fehlgeschlagen`}
              </p>
              <button onClick={closeBatchSummary} className="whitespace-nowrap text-xs text-memo-muted hover:text-memo-ink">
                Schließen
              </button>
            </div>
            {batchResults.some((r) => !r.success) && (
              <ul className="mt-2 space-y-1 text-xs text-memo-minusText">
                {batchResults
                  .filter((r) => !r.success)
                  .map((r) => (
                    <li key={r.ticker}>
                      {r.ticker}: {r.error}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {watchlistLoading ? (
          <p className="text-sm text-memo-muted">Lade...</p>
        ) : watchlist.length === 0 ? (
          <p className="text-sm text-memo-muted">Deine Watchlist ist leer.</p>
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
                highlighted={batchPhase === 'running' && batchTickers[batchIndex] === w.ticker}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function scoreBorderClass(score: number | null): string {
  if (score == null) return 'border-memo-grau'
  if (score >= 70) return 'border-memo-plus'
  if (score >= 40) return 'border-ampel-yellow'
  return 'border-memo-minus'
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
  highlighted,
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
  highlighted?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`relative cursor-pointer rounded-lg border-2 bg-white p-4 transition-shadow hover:shadow-md ${scoreBorderClass(score)} ${
        highlighted ? 'ring-2 ring-memo-ink ring-offset-2' : ''
      }`}
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
      <p className="truncate pr-6 text-xs text-memo-muted">
        {ticker}
        {sector ? ` · ${sector}` : ''}
      </p>
      <p className="mb-2.5 mt-0.5 truncate pr-6 font-analyst text-lg text-navy-950">{name}</p>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className={`text-2xl font-semibold ${score == null ? 'text-memo-grau' : 'text-navy-950'}`}>
          {score ?? '–'}
        </span>
        <span className="whitespace-nowrap text-[11px] text-memo-muted">{scoreLabel}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-memo-muted">{meta ?? ''}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDownloadPdf()
          }}
          disabled={downloading}
          title={`PDF für ${ticker} herunterladen`}
          aria-label={`PDF für ${ticker} herunterladen`}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-memo-muted transition-colors hover:bg-memo-paper hover:text-memo-ink disabled:opacity-50"
        >
          {downloading ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-memo-line border-t-memo-ink" />
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
