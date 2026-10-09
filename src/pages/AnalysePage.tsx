import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { generateAnalysisPdf } from '../utils/pdfExport'
import { dataSourceLabel } from '../lib/memoFormat'
import { koWithoutNewsHint } from '../lib/dataFlags'
import { formatAnalysisDate, isRefreshRunning, needsPolling } from '../lib/analysisRun'
import { ReanalyzeButton } from '../components/ReanalyzeButton'
import { RefreshNoticeBanner } from '../components/RefreshNoticeBanner'
import { getIndexWeighting, type IndexWeighting } from '../lib/webhooks'
import type { StockAnalysis } from '../types/database'
import { AnalysisHeader, WarningsBox } from '../components/analysis/AnalysisHeader'
import { QuickCheckTab } from './analyse/QuickCheckTab'
import { QualitaetTab } from './analyse/QualitaetTab'
import { FundamentalTab } from './analyse/FundamentalTab'
import { KiEinschaetzungTab } from './analyse/KiEinschaetzungTab'

const TABS = [
  { key: 'quickcheck', label: 'Quick-Check' },
  { key: 'qualitaet', label: 'Qualität' },
  { key: 'fundamental', label: 'Fundamental' },
  { key: 'ki', label: 'KI-Einschätzung' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function AnalysePage() {
  const { ticker } = useParams<{ ticker: string }>()
  const { user, session } = useAuth()

  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [watchlistBusy, setWatchlistBusy] = useState(false)
  const [watchlistError, setWatchlistError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('quickcheck')
  const [indexWeightings, setIndexWeightings] = useState<IndexWeighting[]>([])
  const [descExpanded, setDescExpanded] = useState(false)
  // Erhoeht nach "Neu analysieren": laedt neu und startet das Polling, auch
  // wenn der Realtime-Kanal haengt.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!ticker) return
    const currentTicker = ticker
    let cancelled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    // Der Realtime-Kanal unten kann bei langlebigen Tabs still sterben
    // (Laptop-Sleep, Tab lange im Hintergrund/gedrosselt, Netzwerk-Hänger),
    // ohne dass der Client das merkt - der Nutzer sähe den "läuft"-Spinner
    // dann unbegrenzt weiter, obwohl der Lauf längst fertig ist (reales
    // Nutzerfeedback: NVDA-Analyse zeigte "läuft" ~30 Min., obwohl sie laut
    // Log nach ~2s fehlgeschlagen war). Deshalb zusätzlich ein Polling-
    // Fallback, solange der Status noch pending/running ist oder ein Refresh
    // läuft (last_run_status) - unabhängig vom WebSocket, stoppt sich selbst,
    // sobald ein Endstatus bekannt ist.
    function startPollingIfNeeded(row: StockAnalysis | null) {
      if (needsPolling(row)) {
        if (!pollTimer) pollTimer = setInterval(load, 5000)
      } else {
        stopPolling()
      }
    }

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('stock_analyses')
        .select('*')
        .eq('ticker', currentTicker)
        .maybeSingle()
      if (cancelled) return
      setAnalysis(data)
      setLoading(false)
      startPollingIfNeeded(data)
    }
    load()

    const channel = supabase
      .channel(`stock_analyses_${currentTicker}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_analyses',
          filter: `ticker=eq.${currentTicker}`,
        },
        (payload) => {
          if (cancelled) return
          const row = payload.new as StockAnalysis
          setAnalysis(row)
          startPollingIfNeeded(row)
        }
      )
      .subscribe()

    // Zusaetzliches Sicherheitsnetz: kommt der Tab nach langer Inaktivität
    // wieder in den Vordergrund, sofort den echten Stand nachladen, statt
    // auf den naechsten Poll-Tick zu warten (Timer werden von Browsern im
    // Hintergrund ebenfalls gedrosselt/pausiert, nicht nur der WebSocket).
    function handleVisibility() {
      if (!cancelled && document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [ticker, reloadKey])

  useEffect(() => {
    if (!user || !ticker) return
    let cancelled = false
    supabase
      .from('watchlists')
      .select('ticker')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setInWatchlist(Boolean(data))
      })
    return () => {
      cancelled = true
    }
  }, [user, ticker, analysis?.status])

  useEffect(() => {
    if (!ticker || !session?.access_token) {
      setIndexWeightings([])
      return
    }
    let cancelled = false
    getIndexWeighting(ticker, session.access_token)
      .then((weightings) => {
        if (!cancelled) setIndexWeightings(weightings)
      })
      .catch(() => {
        // Rein informative Anzeige - bei jedem Fehler einfach ausblenden,
        // siehe Auftrag ("silently omit"), kein Error-State fuer den Rest
        // der Analyse-Seite.
        if (!cancelled) setIndexWeightings([])
      })
    return () => {
      cancelled = true
    }
  }, [ticker, session?.access_token])

  async function toggleWatchlist() {
    if (!user || !ticker) return
    setWatchlistBusy(true)
    setWatchlistError(null)

    if (inWatchlist) {
      const { error } = await supabase
        .from('watchlists')
        .delete()
        .eq('user_id', user.id)
        .eq('ticker', ticker)
      if (error) {
        console.error('Watchlist delete fehlgeschlagen:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        setWatchlistError(error.message)
      } else {
        setInWatchlist(false)
      }
    } else {
      const { error } = await supabase.from('watchlists').insert({
        user_id: user.id,
        ticker,
        analysis_id: analysis?.id ?? null,
        added_at: new Date().toISOString(),
      })
      if (error) {
        console.error('Watchlist insert fehlgeschlagen:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        setWatchlistError(error.message)
      } else {
        setInWatchlist(true)
      }
    }
    setWatchlistBusy(false)
  }

  if (loading) {
    return <p className="text-sm text-memo-muted">Lade Analyse...</p>
  }

  if (!analysis) {
    return <p className="text-sm text-memo-muted">Keine Analyse für {ticker} gefunden.</p>
  }

  const isPending = analysis.status === 'pending' || analysis.status === 'running'

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-memo-line bg-white py-20 text-center shadow-card">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-memo-line border-t-memo-ink" />
        <h2 className="text-lg font-semibold text-navy-950">Analyse läuft</h2>
        <p className="mt-1 text-sm text-memo-muted">
          Analyse für {ticker} läuft, dauert ca. 20–40 Sekunden.
        </p>
      </div>
    )
  }

  const reanalyze = (
    <ReanalyzeButton
      ticker={analysis.ticker}
      accessToken={session?.access_token}
      disabled={isRefreshRunning(analysis)}
      onStarted={() => setReloadKey((k) => k + 1)}
    />
  )

  if (analysis.status === 'error') {
    return (
      <div className="space-y-3 rounded-xl border border-ampel-red/40 bg-ampel-red/10 p-6 text-sm text-ampel-red">
        <p>
          {analysis.error_message_public
            ? `Fehler: ${analysis.error_message_public}`
            : `Bei der Analyse von ${ticker} ist ein Fehler aufgetreten. Bitte versuche es erneut.`}
        </p>
        {reanalyze}
      </div>
    )
  }

  const newsHint = koWithoutNewsHint(analysis)

  return (
    <div className="space-y-6 rounded-xl border border-memo-line bg-memo-paper p-6 shadow-card sm:p-8">
      <RefreshNoticeBanner analysis={analysis} />

      <AnalysisHeader
        analysis={analysis}
        indexWeightings={indexWeightings}
        descExpanded={descExpanded}
        onToggleDesc={() => setDescExpanded((v) => !v)}
      />

      {newsHint && (
        <p role="note" className="border-l-2 border-memo-line pl-3 text-xs text-memo-muted">
          {newsHint}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={toggleWatchlist}
            disabled={watchlistBusy}
            className={`rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors ${
              inWatchlist
                ? 'border-memo-ink text-memo-ink'
                : 'border-memo-line text-memo-muted hover:border-memo-ink hover:text-memo-ink'
            }`}
          >
            {inWatchlist ? '★ Auf Watchlist' : '☆ Zur Watchlist'}
          </button>
          <button
            onClick={() => generateAnalysisPdf(analysis)}
            className="rounded-sm border border-memo-line px-3 py-1.5 text-xs font-medium text-memo-muted transition-colors hover:border-memo-ink hover:text-memo-ink"
          >
            PDF herunterladen
          </button>
          <Link
            to={`/analyse/${encodeURIComponent(analysis.ticker)}/druck`}
            target="_blank"
            rel="noopener"
            className="rounded-sm border border-memo-line px-3 py-1.5 text-xs font-medium text-memo-muted transition-colors hover:border-memo-ink hover:text-memo-ink"
          >
            Druckansicht
          </Link>
          {reanalyze}
        </div>
        <span className="text-xs text-memo-muted">
          Aktualisiert: {formatAnalysisDate(analysis.updated_at)}
        </span>
      </div>

      {watchlistError && (
        <div className="rounded-sm border border-memo-minus/40 bg-memo-minus/10 p-3 text-sm text-memo-minusText">
          Watchlist-Aktion fehlgeschlagen: {watchlistError}
        </div>
      )}

      <WarningsBox warnings={analysis.warnings} />

      {/* Tabs */}
      <div className="flex gap-6 border-b border-memo-line2 text-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`-mb-px border-b-2 pb-2 transition-colors ${
              activeTab === t.key
                ? 'border-memo-ink text-memo-ink'
                : 'border-transparent text-memo-muted hover:text-memo-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {activeTab === 'quickcheck' && <QuickCheckTab analysis={analysis} />}
        {activeTab === 'qualitaet' && <QualitaetTab analysis={analysis} />}
        {activeTab === 'fundamental' && <FundamentalTab analysis={analysis} />}
        {activeTab === 'ki' && <KiEinschaetzungTab analysis={analysis} />}
      </div>

      {/* Footer meta */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-memo-line2 pt-4 text-xs text-memo-muted">
        <span>Datenquelle: {dataSourceLabel(analysis.data_source)}</span>
      </div>
    </div>
  )
}
