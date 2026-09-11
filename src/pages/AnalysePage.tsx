import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { ScoreGauge } from '../components/ScoreGauge'
import { SubScoreBar } from '../components/SubScoreBar'
import { CriteriaGroup } from '../components/CriteriaGroup'
import { CrisisChart } from '../components/CrisisChart'
import { scoreTextClass } from '../lib/score'
import { generateAnalysisPdf } from '../utils/pdfExport'
import type { StockAnalysis, WarningEntry } from '../types/database'

export function AnalysePage() {
  const { ticker } = useParams<{ ticker: string }>()
  const { user } = useAuth()

  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [watchlistBusy, setWatchlistBusy] = useState(false)
  const [watchlistError, setWatchlistError] = useState<string | null>(null)

  useEffect(() => {
    if (!ticker) return
    const currentTicker = ticker
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('stock_analyses')
        .select('*')
        .eq('ticker', currentTicker)
        .maybeSingle()
      if (!cancelled) {
        setAnalysis(data)
        setLoading(false)
      }
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
          if (!cancelled) setAnalysis(payload.new as StockAnalysis)
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [ticker])

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
    return <p className="text-sm text-navy-500">Lade Analyse...</p>
  }

  if (!analysis) {
    return <p className="text-sm text-navy-500">Keine Analyse für {ticker} gefunden.</p>
  }

  const isPending = analysis.status === 'pending' || analysis.status === 'running'

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-navy-200 bg-white py-20 text-center shadow-card">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-navy-200 border-t-gold-500" />
        <h2 className="text-lg font-semibold text-navy-950">Analyse läuft</h2>
        <p className="mt-1 text-sm text-navy-600">
          Analyse für {ticker} läuft, dauert ca. 20–40 Sekunden.
        </p>
      </div>
    )
  }

  if (analysis.status === 'error') {
    return (
      <div className="rounded-xl border border-ampel-red/40 bg-ampel-red/10 p-6 text-sm text-ampel-red">
        Bei der Analyse von {ticker} ist ein Fehler aufgetreten. Bitte versuche es erneut.
      </div>
    )
  }

  const warnings = normalizeWarnings(analysis.warnings)
  const criteria = Array.isArray(analysis.criteria) ? analysis.criteria : []
  const krise = Array.isArray(analysis.chart_data?.krise) ? analysis.chart_data!.krise! : []

  const dcfValue = analysis.bewertung?.dcf?.dcf ?? null
  const dcfStockPrice = analysis.bewertung?.dcf?.['Stock Price'] ?? null
  const dcfUpsidePct =
    dcfValue != null && dcfStockPrice != null && dcfStockPrice !== 0
      ? ((dcfValue - dcfStockPrice) / dcfStockPrice) * 100
      : null

  return (
    <div className="space-y-6">
      {/* Kopf */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-navy-200 bg-white p-6 shadow-card">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gold-500">
            {analysis.ticker}
          </p>
          <h1 className="text-xl font-semibold text-navy-950">{analysis.company_name ?? analysis.ticker}</h1>
          <p className="mt-1 text-sm text-navy-600">{analysis.sector ?? 'Sektor unbekannt'}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold text-navy-950">
              {analysis.current_price !== null ? analysis.current_price.toFixed(2) : '–'}{' '}
              <span className="text-sm font-normal text-navy-500">{analysis.currency ?? ''}</span>
            </p>
          </div>
          <button
            onClick={toggleWatchlist}
            disabled={watchlistBusy}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              inWatchlist
                ? 'border-gold-500 bg-gold-500/10 text-gold-500'
                : 'border-navy-200 text-navy-700 hover:border-gold-500 hover:text-gold-500'
            }`}
          >
            {inWatchlist ? '★ Auf Watchlist' : '☆ Zur Watchlist'}
          </button>
          <button
            onClick={() => generateAnalysisPdf(analysis)}
            className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 transition-colors hover:border-gold-500 hover:text-gold-500"
          >
            PDF herunterladen
          </button>
        </div>
      </div>

      {watchlistError && (
        <div className="rounded-xl border border-ampel-red/40 bg-ampel-red/10 p-3 text-sm text-ampel-red">
          Watchlist-Aktion fehlgeschlagen: {watchlistError}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-ampel-yellow/40 bg-ampel-yellow/10 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ampel-yellow">
            Warnungen
          </p>
          <ul className="space-y-1 text-sm text-amber-900">
            {warnings.map((w, idx) => (
              <li key={idx}>⚠ {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Score + Sub-Scores */}
      <div className="grid gap-4 rounded-xl border border-navy-200 bg-white p-6 shadow-card md:grid-cols-[auto_1fr]">
        <ScoreGauge score={analysis.score_total} />
        <div className="flex flex-col justify-center gap-4">
          <SubScoreBar label="Fundamental" value={analysis.score_fundamental} />
          <SubScoreBar label="Qualität" value={analysis.score_qualitaet} />
          <SubScoreBar label="Krise" value={analysis.score_krise} />
          <SubScoreBar label="Trend" value={analysis.score_trend} />
        </div>
      </div>

      {analysis.score_stabilitaet !== null && (
        <div className="flex items-center gap-3 rounded-xl border border-navy-200 bg-white px-5 py-3.5 shadow-card">
          <span className="text-xs font-medium uppercase tracking-wide text-navy-500">
            Stabilität
          </span>
          <span className={`text-lg font-bold ${scoreTextClass(analysis.score_stabilitaet)}`}>
            {analysis.score_stabilitaet}
          </span>
        </div>
      )}

      {/* Fazit */}
      {analysis.fazit && (
        <div className="rounded-xl border-l-4 border-gold-500 border-y border-r border-navy-200 bg-white p-5 shadow-card">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-500">Fazit</p>
          <p className="text-sm leading-relaxed text-navy-800">{analysis.fazit}</p>
        </div>
      )}

      {/* Kriterien */}
      {criteria.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold text-navy-950">Kriterien</h2>
          <CriteriaGroup criteria={criteria} />
        </div>
      )}

      {/* Bewertung + Krisen-Chart */}
      <div className="grid gap-4 md:grid-cols-2">
        {analysis.bewertung?.dcf && (
          <div className="rounded-xl border border-navy-200 bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold text-navy-950">Bewertung (DCF)</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-navy-950">
                {dcfValue != null ? dcfValue.toFixed(2) : '–'}
              </span>
              <span className="text-sm text-navy-500">
                {analysis.bewertung.currency ?? analysis.currency ?? ''}
              </span>
            </div>
            {dcfUpsidePct != null && dcfStockPrice != null && (
              <p
                className={`mt-1 text-sm font-medium ${
                  dcfUpsidePct >= 0 ? 'text-ampel-green' : 'text-ampel-red'
                }`}
              >
                {dcfUpsidePct >= 0 ? '+' : ''}
                {dcfUpsidePct.toFixed(1)}% ggü. Kurs bei Bewertung ({dcfStockPrice.toFixed(2)}{' '}
                {analysis.bewertung.currency ?? analysis.currency ?? ''})
              </p>
            )}
            {analysis.bewertung.methode && (
              <p className="mt-2 text-xs text-navy-500">{String(analysis.bewertung.methode)}</p>
            )}
          </div>
        )}

        <div className="rounded-xl border border-navy-200 bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-navy-950">
            Krisenverhalten — Drawdown Aktie vs. S&amp;P 500
          </h2>
          <CrisisChart data={krise} />
        </div>
      </div>

      {/* Footer meta */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-navy-500">
        <span>Datenquelle: {analysis.data_source ?? '–'}</span>
        {analysis.cost_usd_claude !== null && (
          <span>Kosten (Claude): ${analysis.cost_usd_claude.toFixed(4)}</span>
        )}
        <span>Aktualisiert: {new Date(analysis.updated_at).toLocaleString('de-DE')}</span>
      </div>
    </div>
  )
}

function normalizeWarnings(warnings: StockAnalysis['warnings']): string[] {
  if (!Array.isArray(warnings)) return []
  return warnings
    .map((w) => (typeof w === 'string' ? w : (w as WarningEntry | null)?.text))
    .filter((w): w is string => Boolean(w))
}
