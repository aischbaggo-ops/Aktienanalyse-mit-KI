import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { requestAnalyse, SymbolSearchResult } from '../lib/webhooks'
import { SymbolSearch } from '../components/SymbolSearch'
import { FeatureTile } from '../components/FeatureTile'
import { useFeatureAccess } from '../hooks/useFeatureAccess'
import { useBatchAnalysis } from '../hooks/useBatchAnalysis'
import { BatchSelectionPanel } from '../components/BatchSelectionPanel'
import { IndexSelectionPanel } from '../components/IndexSelectionPanel'
import { BatchStatusPanel } from '../components/BatchStatusPanel'
import { AnalysisResultsList, type AnalysisResultRow } from '../components/AnalysisResultsList'
import { generateAnalysisPdf } from '../utils/pdfExport'
import type { StockAnalysis, WatchlistWithAnalysis } from '../types/database'

type MaxAge = '1' | '7' | '30' | 'always'

const MAX_AGE_OPTIONS: { value: MaxAge; label: string }[] = [
  { value: '1', label: '24 Stunden' },
  { value: '7', label: '7 Tage (Standard)' },
  { value: '30', label: '30 Tage' },
  { value: 'always', label: 'Immer neu laden' },
]

const STATUS_LABELS: Record<string, string> = {
  pending: 'wartet',
  running: 'läuft',
  error: 'Fehler',
}

export function DashboardPage() {
  const { user, session } = useAuth()
  const optionenAccess = useFeatureAccess('optionen')
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

  const [missingApiKeys, setMissingApiKeys] = useState(false)

  const batch = useBatchAnalysis(session?.access_token, () => {
    loadWatchlist()
    loadRecent()
  })

  useEffect(() => {
    loadRecent()
    loadWatchlist()
  }, [])

  // Rein informativer Hinweis, kein Blocker - Suche/Analyse selbst geben
  // ohnehin schon eine klare Fehlermeldung, wenn ein Key fehlt (siehe
  // save-api-keys/analyse-Auftrag). Das hier hilft nur neuen Nutzern, gar
  // nicht erst zu raetseln, warum die Suche leer bleibt.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase
      .from('user_api_keys')
      .select('fmp_key_last4, claude_key_last4')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setMissingApiKeys(!data || !data.fmp_key_last4 || !data.claude_key_last4)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  async function loadRecent() {
    setRecentLoading(true)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('stock_analyses')
      .select('*')
      .gt('updated_at', since)
      .order('updated_at', { ascending: false })
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

  // Watchlist-Batch erzwingt weiterhin frische Laeufe (bisheriges Verhalten):
  // wer bewusst Watchlist-Werte auswaehlt, will aktuelle Ergebnisse. Der
  // Index-/Freitext-Batch nutzt dagegen den 7-Tage-Cache.
  async function startWatchlistBatch() {
    await batch.prepare([...selectedTickers], { forceRefresh: true })
  }

  function toggleTicker(ticker: string) {
    if (batch.phase !== 'idle') return
    setSelectedTickers((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  // Verhindert versehentliches Verlassen der Seite waehrend ein Batch
  // laeuft (Klick auf eine Kachel wuerde sonst kommentarlos mitten in der
  // Warteschlange wegnavigieren). Bei Bestaetigung wird die Warteschlange
  // ueber denselben Mechanismus wie der "Abbrechen"-Button gestoppt -
  // laufende Einzelanalyse laeuft zu Ende, keine weiteren werden gestartet.
  function navigateToAnalyse(ticker: string) {
    if (batch.phase === 'running') {
      const proceed = window.confirm(
        `Ein Batch-Lauf ist noch aktiv (${batch.results.length} von ${batch.tickers.length}). Seite trotzdem verlassen? Die restliche Warteschlange wird dann abgebrochen.`
      )
      if (!proceed) return
      batch.cancel()
    }
    navigate(`/analyse/${encodeURIComponent(ticker)}`)
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
    if (!selected || !user || !session?.access_token) return
    setAnalysing(true)
    setAnalyseError(null)
    try {
      const forceRefresh = maxAge === 'always'
      const payload = {
        ticker: selected.symbol,
        max_age_days: forceRefresh ? null : Number(maxAge),
        force_refresh: forceRefresh,
      }
      await requestAnalyse(payload, session.access_token)
      navigate(`/analyse/${encodeURIComponent(selected.symbol)}`)
    } catch (err) {
      setAnalyseError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setAnalysing(false)
    }
  }

  const watchlistTickerSet = new Set(watchlist.map((w) => w.ticker))

  // Bereits nach updated_at absteigend sortiert (siehe loadRecent). Bei
  // einem Status ungleich "done" (pending/running/error) steht statt des
  // Datums der Status davor, damit das nicht wie eine fertige Analyse
  // aussieht.
  const recentRows: AnalysisResultRow[] = recent.map((a) => ({
    ticker: a.ticker,
    name: a.company_name ?? a.ticker,
    image: a.chart_data?.profileMeta?.image,
    score: a.score_total,
    metaLabel:
      a.status === 'done'
        ? new Date(a.updated_at).toLocaleString('de-DE')
        : `${STATUS_LABELS[a.status] ?? a.status} · ${new Date(a.updated_at).toLocaleString('de-DE')}`,
  }))

  return (
    <div className="space-y-8">
      {missingApiKeys && (
        <div className="rounded-sm border border-memo-line bg-white p-4 text-sm text-memo-ink">
          Bitte hinterlege deinen FMP- und Claude-API-Key unter{' '}
          <Link to="/konto" className="underline hover:text-memo-muted">
            Konto
          </Link>
          , um Suche und Analyse zu nutzen.
        </div>
      )}

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
        <h2 className="mb-3 text-base font-semibold text-navy-950">Mehrere Aktien auf einmal analysieren</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <IndexSelectionPanel
            disabled={batch.phase !== 'idle'}
            accessToken={session?.access_token}
            onStart={(list) => batch.prepare(list, { forceRefresh: false })}
          />
          <BatchSelectionPanel
            disabled={batch.phase !== 'idle'}
            onStart={(list) => batch.prepare(list, { forceRefresh: false })}
          />
        </div>
        {!batch.forceRefresh && (
          <div className="mt-4">
            <BatchStatusPanel
              batch={batch}
              userId={user?.id}
              watchlistTickers={watchlistTickerSet}
              onWatchlistChanged={loadWatchlist}
              onOpenTicker={navigateToAnalyse}
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-navy-950">Bausteine</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureTile
            title="Optionen"
            description="Strategien planen, berechnen und durchspielen."
            to="/optionen"
            loading={optionenAccess.loading}
            unlocked={optionenAccess.unlocked}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-navy-950">Letzte Analysen (24h)</h2>
        {recentLoading ? (
          <p className="text-sm text-memo-muted">Lade...</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-memo-muted">Noch keine Analysen in den letzten 24h.</p>
        ) : (
          <AnalysisResultsList
            rows={recentRows}
            watchlistTickers={watchlistTickerSet}
            userId={user?.id}
            onWatchlistChanged={loadWatchlist}
            onOpenTicker={navigateToAnalyse}
          />
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-navy-950">Meine Watchlist</h2>
          {selectedTickers.size > 0 && batch.phase === 'idle' && (
            <>
              <span className="text-xs text-memo-muted">{selectedTickers.size} ausgewählt</span>
              <button
                onClick={startWatchlistBatch}
                className="rounded-md border border-memo-line px-3 py-1 text-xs font-medium text-memo-ink transition-colors hover:border-memo-ink"
              >
                Batch-Analyse starten
              </button>
            </>
          )}
        </div>

        {batch.forceRefresh && (
          <div className="mb-4">
            <BatchStatusPanel
              batch={batch}
              userId={user?.id}
              watchlistTickers={watchlistTickerSet}
              onWatchlistChanged={loadWatchlist}
              onOpenTicker={navigateToAnalyse}
            />
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
                image={w.stock_analyses?.chart_data?.profileMeta?.image}
                score={w.stock_analyses?.score_total ?? null}
                scoreLabel={
                  w.stock_analyses?.updated_at
                    ? `Analysiert: ${new Date(w.stock_analyses.updated_at).toLocaleString('de-DE')}`
                    : 'Noch nicht analysiert'
                }
                meta={`In Watchlist seit ${new Date(w.added_at).toLocaleDateString('de-DE')}`}
                onClick={() => navigateToAnalyse(w.ticker)}
                onDownloadPdf={() => handleDownloadPdf(w.ticker)}
                downloading={downloadingTicker === w.ticker}
                checked={selectedTickers.has(w.ticker)}
                onToggleChecked={() => toggleTicker(w.ticker)}
                highlighted={batch.phase === 'running' && batch.tickers[batch.index] === w.ticker}
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
  image,
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
  image?: string | null
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
      {highlighted ? (
        <span
          aria-label="Analyse läuft"
          className="absolute right-3.5 top-3.5 h-4 w-4 animate-spin rounded-full border-2 border-memo-line border-t-memo-ink"
        />
      ) : (
        onToggleChecked && (
          <input
            type="checkbox"
            checked={checked ?? false}
            onClick={(e) => e.stopPropagation()}
            onChange={onToggleChecked}
            className="absolute right-3.5 top-3.5 h-4 w-4 accent-navy-700"
          />
        )
      )}
      <div className="flex items-start gap-2">
        {image && (
          <img
            src={image}
            alt=""
            className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-sm border border-memo-line2 bg-white object-contain"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate pr-6 text-xs text-memo-muted">
            {ticker}
            {sector ? ` · ${sector}` : ''}
          </p>
          <p className="mb-2.5 mt-0.5 truncate pr-6 font-analyst text-lg text-navy-950">{name}</p>
        </div>
      </div>
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
