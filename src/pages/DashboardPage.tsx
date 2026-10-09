import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { requestAnalyse, SymbolSearchResult } from '../lib/webhooks'
import { SymbolSearch } from '../components/SymbolSearch'
import { FeatureTile } from '../components/FeatureTile'
import { useFeatureAccess } from '../hooks/useFeatureAccess'
import { useBatchAnalysis } from '../hooks/useBatchAnalysis'
import { MAX_BATCH_SIZE } from '../utils/batchEstimate'
import { toggleSelection } from '../lib/selection'
import { BatchSelectionPanel } from '../components/BatchSelectionPanel'
import { IndexSelectionPanel } from '../components/IndexSelectionPanel'
import { BatchStatusPanel } from '../components/BatchStatusPanel'
import { AnalysisTable } from '../components/AnalysisTable'
import {
  ANALYSIS_TABLE_SELECT,
  emptyRow,
  normalizeRow,
  RECENT_RANGES,
  recentSince,
  type AnalysisTableRow,
  type RecentRange,
} from '../lib/analysisTable'
import { scoreBorderClass } from '../lib/score'
import { addTickersToWatchlist, attachErrorInfo, downloadAnalysisPdf } from '../lib/analysisData'
import { MAX_AGE_OPTIONS, maxAgeCostHint, readMaxAge, storeMaxAge, type MaxAge } from '../lib/preferences'


// Watchlist-Eintrag mit den Tabellenwerten aus analysis_ranking (ohne
// Analyse: leere Zeile, siehe emptyRow).
interface WatchlistItem {
  ticker: string
  added_at: string
  row: AnalysisTableRow
}

type WatchlistView = 'cards' | 'table'

const WATCHLIST_VIEWS: { value: WatchlistView; label: string }[] = [
  { value: 'cards', label: 'Karten' },
  { value: 'table', label: 'Tabelle' },
]

const WATCHLIST_VIEW_KEY = 'dashboard.watchlistView'

// Zuletzt gewaehlte Ansicht je Browser (nur Komfort).
function readWatchlistView(): WatchlistView {
  try {
    return localStorage.getItem(WATCHLIST_VIEW_KEY) === 'table' ? 'table' : 'cards'
  } catch {
    return 'cards'
  }
}

export function DashboardPage() {
  const { user, session } = useAuth()
  const optionenAccess = useFeatureAccess('optionen')
  const navigate = useNavigate()

  const [selected, setSelected] = useState<SymbolSearchResult | null>(null)
  // Gemerkt fuer die Browser-Sitzung (lib/preferences.ts), damit "Immer neu
  // laden" nach dem Zurueckkehren von der Analyseseite nicht wieder auf 7
  // Tage steht.
  const [maxAge, setMaxAge] = useState<MaxAge>(readMaxAge)
  const [analysing, setAnalysing] = useState(false)
  const [analyseError, setAnalyseError] = useState<string | null>(null)

  const [recent, setRecent] = useState<AnalysisTableRow[]>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentRange, setRecentRange] = useState<RecentRange>('24h')
  // Auswahl in "Letzte Analysen" = Kandidaten fuer "zur Watchlist".
  const [recentPicked, setRecentPicked] = useState<Set<string>>(new Set())
  const [recentAddBusy, setRecentAddBusy] = useState(false)
  const [recentAddError, setRecentAddError] = useState<string | null>(null)

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [watchlistLoading, setWatchlistLoading] = useState(true)
  const [watchlistView, setWatchlistView] = useState<WatchlistView>(readWatchlistView)
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set())
  const [watchlistBatchError, setWatchlistBatchError] = useState<string | null>(null)

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

  // Schlanke Abfrage ueber die View analysis_ranking: nur einzelne Werte,
  // keine ganzen JSON-Spalten (vorher stock_analyses(*), ~52 kB je Zeile).
  async function loadRecent(range: RecentRange = recentRange) {
    setRecentLoading(true)
    const { data, error } = await supabase
      .from('analysis_ranking')
      .select(ANALYSIS_TABLE_SELECT)
      .gt('analysed_at', recentSince(range, Date.now()))
      .order('analysed_at', { ascending: false })
    if (error) console.error('Letzte Analysen konnten nicht geladen werden:', error.message)
    setRecent(await attachErrorInfo(((data ?? []) as unknown as Record<string, unknown>[]).map(normalizeRow)))
    setRecentLoading(false)
  }

  function changeRecentRange(range: RecentRange) {
    setRecentRange(range)
    loadRecent(range)
  }

  // Watchlist: Eintraege des Nutzers, dazu die Tabellenwerte aus
  // analysis_ranking (vorher stock_analyses!...(*) mit kompletten Zeilen,
  // bei ~250 Eintraegen grob 12 MB).
  async function loadWatchlist() {
    if (!user) return
    setWatchlistLoading(true)
    const { data: entries, error } = await supabase
      .from('watchlists')
      .select('ticker, added_at')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false })
    if (error) console.error('Watchlist konnte nicht geladen werden:', error.message)
    const list = (entries ?? []) as { ticker: string; added_at: string }[]
    const byTicker = new Map<string, AnalysisTableRow>()
    if (list.length > 0) {
      const { data: rows, error: rowsError } = await supabase
        .from('analysis_ranking')
        .select(ANALYSIS_TABLE_SELECT)
        .in('ticker', list.map((e) => e.ticker))
      if (rowsError) console.error('Watchlist-Analysen konnten nicht geladen werden:', rowsError.message)
      for (const raw of (rows ?? []) as unknown as Record<string, unknown>[]) {
        const row = normalizeRow(raw)
        byTicker.set(row.ticker, row)
      }
    }
    const rowsWithInfo = await attachErrorInfo(list.map((e) => byTicker.get(e.ticker) ?? emptyRow(e.ticker)))
    setWatchlist(list.map((e, i) => ({ ...e, row: rowsWithInfo[i] })))
    setWatchlistLoading(false)
  }

  // Ausgewaehlte Zeilen aus "Letzte Analysen" auf die Watchlist setzen
  // (wie bisher in AnalysisResultsList).
  async function addRecentToWatchlist() {
    if (!user) return
    const toAdd = [...recentPicked].filter((t) => !watchlistTickerSet.has(t))
    if (toAdd.length === 0) return
    setRecentAddBusy(true)
    setRecentAddError(null)
    const error = await addTickersToWatchlist(user.id, toAdd)
    setRecentAddBusy(false)
    if (error) {
      setRecentAddError(error)
      return
    }
    setRecentPicked(new Set())
    loadWatchlist()
  }

  function changeWatchlistView(view: WatchlistView) {
    setWatchlistView(view)
    try {
      localStorage.setItem(WATCHLIST_VIEW_KEY, view)
    } catch {
      // Nur Komfort - ohne Speicher startet die Ansicht wieder als Karten.
    }
  }

  // Watchlist-Batch erzwingt weiterhin frische Laeufe (bisheriges Verhalten):
  // wer bewusst Watchlist-Werte auswaehlt, will aktuelle Ergebnisse. Der
  // Index-/Freitext-Batch nutzt dagegen den 7-Tage-Cache.
  async function startWatchlistBatch() {
    setWatchlistBatchError(null)
    // prepare() lehnt mehr als MAX_BATCH_SIZE ab - die Meldung anzeigen statt
    // still nichts zu tun.
    const err = await batch.prepare([...selectedTickers], { forceRefresh: true })
    if (err) setWatchlistBatchError(err)
  }

  // Auswahl gesperrt, solange ein Batch bestaetigt wird oder laeuft. Nach
  // dem Ende ("done") ist sie wieder frei.
  const batchBusy = batch.phase === 'confirming' || batch.phase === 'running' || batch.phase === 'paused'

  function changeWatchlistSelection(next: Set<string>) {
    if (batchBusy) return
    setWatchlistBatchError(null)
    setSelectedTickers(next)
  }

  // Karten-Ansicht: einzelne Kachel umschalten, gleiche Obergrenze wie die Tabelle.
  function toggleTicker(ticker: string) {
    if (batchBusy) return
    const { next, capped } = toggleSelection(selectedTickers, ticker, MAX_BATCH_SIZE)
    setWatchlistBatchError(capped ? `Höchstens ${MAX_BATCH_SIZE} Werte pro Batch-Lauf.` : null)
    setSelectedTickers(next)
  }

  // Verhindert versehentliches Verlassen der Seite waehrend ein Batch
  // laeuft (Klick auf eine Kachel wuerde sonst kommentarlos mitten in der
  // Warteschlange wegnavigieren). Bei Bestaetigung wird die Warteschlange
  // ueber denselben Mechanismus wie der "Abbrechen"-Button gestoppt -
  // laufende Einzelanalyse laeuft zu Ende, keine weiteren werden gestartet.
  function navigateToAnalyse(ticker: string) {
    if (batch.phase === 'running' || batch.phase === 'paused') {
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
      const error = await downloadAnalysisPdf(ticker)
      if (error) setDownloadError(error)
    } finally {
      setDownloadingTicker(null)
    }
  }

  async function handleAnalyse() {
    if (!selected) {
      setAnalyseError('Bitte zuerst einen Ticker auswählen.')
      return
    }
    if (!user || !session?.access_token) return
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

  const watchlistTickerSet = useMemo(() => new Set(watchlist.map((w) => w.ticker)), [watchlist])
  const watchlistRows = useMemo(() => watchlist.map((w) => w.row), [watchlist])

  // Nur Ticker zaehlen, die noch nicht auf der Watchlist stehen.
  const recentPickable = [...recentPicked].filter((t) => !watchlistTickerSet.has(t))

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
            onChange={(e) => {
              const v = e.target.value as MaxAge
              setMaxAge(v)
              storeMaxAge(v)
            }}
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
            disabled={analysing}
            className="rounded-lg bg-memo-ink px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {analysing ? 'Analysiere...' : 'Analysieren'}
          </button>
        </div>
        {maxAgeCostHint(maxAge) && (
          <p role="note" className="mt-2 text-xs text-memo-minusText">
            {maxAgeCostHint(maxAge)}
          </p>
        )}
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
            accessToken={session?.access_token}
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
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-navy-950">Letzte Analysen</h2>
          <select
            value={recentRange}
            onChange={(e) => changeRecentRange(e.target.value as RecentRange)}
            aria-label="Zeitraum"
            className="rounded-md border border-memo-line bg-white px-2 py-1 text-xs text-memo-ink"
          >
            {RECENT_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {recentLoading ? (
          <p className="text-sm text-memo-muted">Lade...</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-memo-muted">
            Noch keine Analysen in den letzten {recentRange === '24h' ? '24 Stunden' : '7 Tagen'}.
          </p>
        ) : (
          <>
            <AnalysisTable
              rows={recent}
              storageKey="dashboard.recent"
              selected={recentPicked}
              onSelectionChange={setRecentPicked}
              isRowLocked={(t) => watchlistTickerSet.has(t)}
              rowTag={(t) => (watchlistTickerSet.has(t) ? 'auf Watchlist' : null)}
              onOpenTicker={navigateToAnalyse}
              onDownloadPdf={handleDownloadPdf}
              downloadingTicker={downloadingTicker}
              actions={
                <button
                  onClick={addRecentToWatchlist}
                  disabled={recentAddBusy || recentPickable.length === 0}
                  className="rounded-md border border-memo-line px-3 py-1 text-xs font-medium text-memo-ink transition-colors hover:border-memo-ink disabled:opacity-50"
                >
                  {recentPickable.length} zur Watchlist hinzufügen
                </button>
              }
            />
            {recentAddError && (
              <p className="mt-2 text-xs text-ampel-red">Watchlist-Aktion fehlgeschlagen: {recentAddError}</p>
            )}
          </>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-navy-950">Meine Watchlist</h2>
          {watchlist.length > 0 && (
            <div role="group" aria-label="Ansicht" className="flex overflow-hidden rounded-md border border-memo-line text-xs">
              {WATCHLIST_VIEWS.map((v) => (
                <button
                  key={v.value}
                  onClick={() => changeWatchlistView(v.value)}
                  aria-pressed={watchlistView === v.value}
                  className={`px-2.5 py-1 ${
                    watchlistView === v.value ? 'bg-memo-ink text-white' : 'bg-white text-memo-muted hover:text-memo-ink'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
          {selectedTickers.size > 0 && batch.phase === 'idle' && (
            <>
              <span className="text-xs text-memo-muted">
                {selectedTickers.size} ausgewählt (max. {MAX_BATCH_SIZE} pro Lauf)
              </span>
              <button
                onClick={startWatchlistBatch}
                disabled={selectedTickers.size > MAX_BATCH_SIZE}
                className="rounded-md border border-memo-line px-3 py-1 text-xs font-medium text-memo-ink transition-colors hover:border-memo-ink disabled:opacity-50"
              >
                Batch-Analyse starten
              </button>
            </>
          )}
          {watchlistBatchError && <span className="text-xs text-memo-minusText">{watchlistBatchError}</span>}
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
        ) : watchlistView === 'table' ? (
          <AnalysisTable
            rows={watchlistRows}
            storageKey="dashboard.watchlist"
            selected={selectedTickers}
            onSelectionChange={changeWatchlistSelection}
            maxSelection={MAX_BATCH_SIZE}
            selectionDisabled={batchBusy}
            onOpenTicker={navigateToAnalyse}
            onDownloadPdf={handleDownloadPdf}
            downloadingTicker={downloadingTicker}
            highlightedTicker={batch.phase === 'running' ? batch.tickers[batch.index] : null}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {watchlist.map((w) => (
              <DashboardTile
                key={w.ticker}
                ticker={w.ticker}
                sector={w.row.sector}
                name={w.row.name ?? w.ticker}
                image={w.row.logo_url}
                score={w.row.score_total}
                scoreLabel={
                  w.row.analysed_at
                    ? `Analysiert: ${new Date(w.row.analysed_at).toLocaleString('de-DE')}`
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
