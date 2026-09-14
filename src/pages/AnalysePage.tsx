import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { generateAnalysisPdf } from '../utils/pdfExport'
import { scoreLabel, scoreLabelColorClass, scoreBandHex, scoreBandFill } from '../lib/score'
import type { StockAnalysis, WarningEntry } from '../types/database'
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
  const { user } = useAuth()

  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [watchlistBusy, setWatchlistBusy] = useState(false)
  const [watchlistError, setWatchlistError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('quickcheck')

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

  if (analysis.status === 'error') {
    return (
      <div className="rounded-xl border border-ampel-red/40 bg-ampel-red/10 p-6 text-sm text-ampel-red">
        Bei der Analyse von {ticker} ist ein Fehler aufgetreten. Bitte versuche es erneut.
      </div>
    )
  }

  const warnings = normalizeWarnings(analysis.warnings)
  const score = analysis.score_total
  const meta = analysis.chart_data?.profileMeta
  const marketCapText = formatMarketCap(meta?.marketCap, analysis.currency)
  const hasMetaRow = Boolean(marketCapText || meta?.industry || meta?.exchange)

  return (
    <div className="space-y-6 rounded-xl border border-memo-line bg-memo-paper p-6 shadow-card sm:p-8">
      {/* Kopf */}
      <div className="space-y-4 border-b border-memo-line2 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {meta?.image && (
              <img
                src={meta.image}
                alt=""
                className="h-11 w-11 rounded-md border border-memo-line2 bg-white object-contain"
              />
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-memo-muted">
                {analysis.ticker}
                {analysis.sector ? ` · ${analysis.sector}` : ''}
              </p>
              <h1 className="mt-1 font-analyst text-3xl text-memo-ink">
                {analysis.company_name ?? analysis.ticker}
              </h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-memo-muted">Score</p>
            <p className="font-analyst text-4xl text-memo-ink">
              {score != null ? score.toFixed(0) : '–'}
            </p>
            <p className={`text-xs font-semibold ${scoreLabelColorClass(score)}`}>{scoreLabel(score)}</p>
          </div>
        </div>

        {hasMetaRow && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-14 text-xs text-memo-muted">
            {marketCapText && (
              <span>
                Marktkap. <strong className="font-semibold text-memo-ink">{marketCapText}</strong>
              </span>
            )}
            {marketCapText && (meta?.industry || meta?.exchange) && <span>·</span>}
            {meta?.industry && (
              <span>
                Segment <strong className="font-semibold text-memo-ink">{meta.industry}</strong>
              </span>
            )}
            {meta?.industry && meta?.exchange && <span>·</span>}
            {meta?.exchange && (
              <span>
                Börse <strong className="font-semibold text-memo-ink">{meta.exchange}</strong>
              </span>
            )}
          </div>
        )}

        <div className="border-t border-memo-line2 pt-4">
          <AnalyseRadarChart analysis={analysis} />
        </div>
      </div>

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
        </div>
        <span className="text-xs text-memo-muted">
          Aktualisiert: {new Date(analysis.updated_at).toLocaleString('de-DE')}
        </span>
      </div>

      {watchlistError && (
        <div className="rounded-sm border border-memo-minus/40 bg-memo-minus/10 p-3 text-sm text-memo-minusText">
          Watchlist-Aktion fehlgeschlagen: {watchlistError}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-sm border border-memo-line p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-memo-muted">Warnungen</p>
          <ul className="space-y-1 text-sm text-memo-ink">
            {warnings.map((w, idx) => (
              <li key={idx}>⚠ {w}</li>
            ))}
          </ul>
        </div>
      )}

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
        <span>Datenquelle: {analysis.data_source ?? '–'}</span>
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

function formatMarketCap(value: number | null | undefined, currency: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const cur = currency ?? 'USD'
  const abs = Math.abs(value)
  let short: string
  if (abs >= 1e12) short = `${(value / 1e12).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Bio.`
  else if (abs >= 1e9) short = `${(value / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mrd.`
  else if (abs >= 1e6) short = `${(value / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio.`
  else short = value.toLocaleString('de-DE')
  return `${short} ${cur}`
}

const RADAR_DIMENSIONS = [
  { key: 'score_qualitaet', label: 'Qualität' },
  { key: 'score_fundamental', label: 'Fundamental' },
  { key: 'score_krise', label: 'Krise' },
  { key: 'score_trend', label: 'Trend' },
] as const satisfies { key: keyof StockAnalysis; label: string }[]

function polarPoint(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function AnalyseRadarChart({ analysis }: { analysis: StockAnalysis }) {
  const cx = 70
  const cy = 70
  const rOuter = 55
  const angles = RADAR_DIMENSIONS.map((_, i) => -90 + i * 90)
  const values = RADAR_DIMENSIONS.map((d) => analysis[d.key] as number | null)

  const gridPoints = angles.map((a) => polarPoint(cx, cy, rOuter, a).join(',')).join(' ')
  const dataPoints = angles
    .map((a, i) => {
      const v = values[i]
      const r = v !== null && v !== undefined ? (Math.max(0, Math.min(100, v)) / 100) * rOuter : 0
      return polarPoint(cx, cy, r, a).join(',')
    })
    .join(' ')
  const bandHex = scoreBandHex(analysis.score_total)
  const bandFill = scoreBandFill(analysis.score_total)

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
        <polygon points={gridPoints} fill="none" stroke="#ddd" strokeWidth="1" />
        <polygon points={dataPoints} fill={bandFill} stroke={bandHex} strokeWidth="1.5" />
      </svg>
      <div className="space-y-1.5 text-xs text-memo-ink">
        {RADAR_DIMENSIONS.map((d, i) => {
          const v = values[i]
          return (
            <div key={d.key} className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: scoreBandHex(v) }} />
              <span>
                {d.label} {v !== null && v !== undefined ? v.toFixed(0) : '–'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
