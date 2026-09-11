import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RequestLog } from '../types/database'

interface Metrics {
  requestsToday: number
  requestsTotal: number
  totalCostUsd: number
  cacheHitRatePct: number
  topTickers: { ticker: string; count: number }[]
  successRatePct: number | null
  errorCount: number
  avgDurationMs: number | null
  dataGapCount: number
  dataGapRatePct: number | null
  deviationCount: number
  deviationRatePct: number | null
}

type FailedRequest = Pick<RequestLog, 'ticker' | 'requested_at' | 'error_message'>
type DataGapRequest = Pick<RequestLog, 'ticker' | 'requested_at'>
type DeviationRequest = Pick<RequestLog, 'ticker' | 'requested_at' | 'deviation_amount'>

export function AdminPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [requests, setRequests] = useState<RequestLog[]>([])
  const [failedRequests, setFailedRequests] = useState<FailedRequest[]>([])
  const [dataGapRequests, setDataGapRequests] = useState<DataGapRequest[]>([])
  const [showDataGaps, setShowDataGaps] = useState(false)
  const [deviationRequests, setDeviationRequests] = useState<DeviationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const [
        { count: totalCount, error: e1 },
        { count: todayCount, error: e2 },
        { count: cacheCount, error: e3 },
        { data: tickerRows, error: e4 },
        { data: costRows, error: e5 },
        { data: recentRequests, error: e6 },
        { count: doneCount, error: e7 },
        { count: errorCount, error: e8 },
        { data: durationRows, error: e9 },
        { data: failedRows, error: e10 },
        { count: dataGapCount, error: e11 },
        { data: dataGapRows, error: e12 },
        { count: deviationCount, error: e13 },
        { data: deviationRows, error: e14 },
      ] = await Promise.all([
        supabase.from('request_log').select('*', { count: 'exact', head: true }),
        supabase
          .from('request_log')
          .select('*', { count: 'exact', head: true })
          .gte('requested_at', todayStart.toISOString()),
        supabase
          .from('request_log')
          .select('*', { count: 'exact', head: true })
          .eq('source', 'cache'),
        supabase.from('request_log').select('ticker').limit(5000),
        supabase.from('stock_analyses').select('cost_usd_claude'),
        supabase
          .from('request_log')
          .select('*')
          .order('requested_at', { ascending: false })
          .limit(50),
        supabase
          .from('request_log')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'done'),
        supabase
          .from('request_log')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'error'),
        supabase.from('request_log').select('duration_ms').not('duration_ms', 'is', null).limit(5000),
        supabase
          .from('request_log')
          .select('ticker, requested_at, error_message')
          .eq('status', 'error')
          .order('requested_at', { ascending: false })
          .limit(20),
        supabase
          .from('request_log')
          .select('*', { count: 'exact', head: true })
          .in('status', ['done', 'error'])
          .eq('data_quality', 'limited'),
        supabase
          .from('request_log')
          .select('ticker, requested_at')
          .in('status', ['done', 'error'])
          .eq('data_quality', 'limited')
          .order('requested_at', { ascending: false })
          .limit(20),
        supabase
          .from('request_log')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'done')
          .eq('deviation_triggered', true),
        supabase
          .from('request_log')
          .select('ticker, requested_at, deviation_amount')
          .eq('status', 'done')
          .eq('deviation_triggered', true)
          .order('requested_at', { ascending: false })
          .limit(10),
      ])

      const firstError =
        e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9 || e10 || e11 || e12 || e13 || e14
      if (firstError) throw firstError

      const tickerCounts = new Map<string, number>()
      for (const row of tickerRows ?? []) {
        tickerCounts.set(row.ticker, (tickerCounts.get(row.ticker) ?? 0) + 1)
      }
      const topTickers = [...tickerCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([ticker, count]) => ({ ticker, count }))

      const totalCostUsd = (costRows ?? []).reduce(
        (sum, r) => sum + (r.cost_usd_claude ?? 0),
        0
      )

      const total = totalCount ?? 0
      const cache = cacheCount ?? 0
      const done = doneCount ?? 0
      const failed = errorCount ?? 0
      const finished = done + failed

      const durations = (durationRows ?? [])
        .map((r) => r.duration_ms)
        .filter((d): d is number => d !== null && d !== undefined)
      const avgDurationMs =
        durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : null

      const dataGaps = dataGapCount ?? 0
      const deviations = deviationCount ?? 0

      setMetrics({
        requestsToday: todayCount ?? 0,
        requestsTotal: total,
        totalCostUsd,
        cacheHitRatePct: total > 0 ? (cache / total) * 100 : 0,
        topTickers,
        successRatePct: finished > 0 ? (done / finished) * 100 : null,
        errorCount: failed,
        avgDurationMs,
        dataGapCount: dataGaps,
        dataGapRatePct: finished > 0 ? (dataGaps / finished) * 100 : null,
        deviationCount: deviations,
        deviationRatePct: done > 0 ? (deviations / done) * 100 : null,
      })
      setRequests(recentRequests ?? [])
      setFailedRequests(failedRows ?? [])
      setDataGapRequests(dataGapRows ?? [])
      setDeviationRequests(deviationRows ?? [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Aktivitätsdaten konnten nicht geladen werden. Prüfe Admin-Rechte (profiles.is_admin) und RLS-Policies.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <p className="text-sm text-navy-500">Lade Aktivitätsdaten...</p>

  if (error) {
    return <div className="rounded-xl border border-ampel-red/40 bg-ampel-red/10 p-5 text-sm text-ampel-red">{error}</div>
  }

  if (!metrics) return null

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-navy-950">Admin — Aktivität</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Anfragen heute" value={metrics.requestsToday.toString()} />
        <Kpi label="Anfragen gesamt" value={metrics.requestsTotal.toString()} />
        <Kpi label="Kosten (Claude)" value={`$${metrics.totalCostUsd.toFixed(2)}`} />
        <Kpi label="Cache-Trefferquote" value={`${metrics.cacheHitRatePct.toFixed(1)}%`} />
        <Kpi
          label="Erfolgsquote"
          value={metrics.successRatePct != null ? `${metrics.successRatePct.toFixed(1)}%` : '–'}
        />
        <Kpi label="Fehlschläge" value={metrics.errorCount.toString()} />
        <Kpi
          label="Ø Laufzeit"
          value={metrics.avgDurationMs != null ? `${(metrics.avgDurationMs / 1000).toFixed(1)}s` : '–'}
        />
        <Kpi
          label="Datenlücken"
          value={
            metrics.dataGapRatePct != null
              ? `${metrics.dataGapCount} (${metrics.dataGapRatePct.toFixed(1)}%)`
              : metrics.dataGapCount.toString()
          }
          onClick={() => setShowDataGaps((v) => !v)}
        />
        <Kpi
          label="Kontrollläufe"
          value={
            metrics.deviationRatePct != null
              ? `${metrics.deviationCount} (${metrics.deviationRatePct.toFixed(1)}%)`
              : metrics.deviationCount.toString()
          }
          highlight={metrics.deviationRatePct != null && metrics.deviationRatePct > 20}
        />
      </div>

      <div className="rounded-xl border border-navy-200 bg-white p-5 shadow-card">
        <h2 className="mb-1 text-sm font-semibold text-navy-950">Kontrollläufe — Score-Abweichung &gt;3 Punkte</h2>
        <p className="mb-3 text-xs text-navy-500">
          Häufige Treffer bei einem Ticker/einer Branche deuten auf Nachschärfbedarf bei der
          Score-Berechnung hin.
        </p>
        {deviationRequests.length === 0 ? (
          <p className="text-sm text-navy-500">Keine Kontrollläufe protokolliert.</p>
        ) : (
          <ul className="space-y-2">
            {deviationRequests.map((r, idx) => (
              <li key={idx} className="flex items-center gap-3 text-sm">
                <span className="w-14 flex-shrink-0 font-medium text-gold-500">{r.ticker}</span>
                <span
                  className={`font-semibold ${
                    (r.deviation_amount ?? 0) >= 0 ? 'text-ampel-green' : 'text-ampel-red'
                  }`}
                >
                  {r.deviation_amount != null
                    ? `${r.deviation_amount >= 0 ? '+' : ''}${r.deviation_amount.toFixed(1)} Pkt.`
                    : '–'}
                </span>
                <span className="text-navy-500">
                  {new Date(r.requested_at).toLocaleString('de-DE')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-navy-200 bg-white shadow-card">
        <h2 className="border-b border-navy-100 px-5 py-3.5 text-sm font-semibold text-navy-950">
          Fehlschläge
        </h2>
        {failedRequests.length === 0 ? (
          <p className="p-5 text-sm text-navy-500">Keine Fehlschläge protokolliert.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-500">
                  <th className="px-5 py-2.5 font-medium">Ticker</th>
                  <th className="px-5 py-2.5 font-medium">Zeitpunkt</th>
                  <th className="px-5 py-2.5 font-medium">Fehlermeldung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {failedRequests.map((r, idx) => (
                  <tr key={idx}>
                    <td className="px-5 py-2.5 align-top font-medium text-navy-950">{r.ticker}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 align-top text-navy-500">
                      {new Date(r.requested_at).toLocaleString('de-DE')}
                    </td>
                    <td className="px-5 py-2.5 align-top text-ampel-red">
                      {r.error_message ?? '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDataGaps && (
        <div className="rounded-xl border border-navy-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-navy-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-navy-950">
              Datenlücken — unvollständige FMP-Daten (Free-Plan)
            </h2>
            <button
              onClick={() => setShowDataGaps(false)}
              className="text-xs font-medium text-navy-500 hover:text-navy-700"
            >
              Ausblenden
            </button>
          </div>
          {dataGapRequests.length === 0 ? (
            <p className="p-5 text-sm text-navy-500">Keine Datenlücken protokolliert.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-500">
                    <th className="px-5 py-2.5 font-medium">Ticker</th>
                    <th className="px-5 py-2.5 font-medium">Zeitpunkt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {dataGapRequests.map((r, idx) => (
                    <tr key={idx}>
                      <td className="px-5 py-2.5 font-medium text-navy-950">{r.ticker}</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-navy-500">
                        {new Date(r.requested_at).toLocaleString('de-DE')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-navy-200 bg-white p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-navy-950">Meistgesuchte Ticker</h2>
        {metrics.topTickers.length === 0 ? (
          <p className="text-sm text-navy-500">Keine Daten vorhanden.</p>
        ) : (
          <ol className="space-y-2">
            {metrics.topTickers.map((t, idx) => (
              <li key={t.ticker} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-navy-500">{idx + 1}.</span>
                <span className="font-medium text-gold-500">{t.ticker}</span>
                <span className="text-navy-500">{t.count}× angefragt</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-xl border border-navy-200 bg-white shadow-card">
        <h2 className="border-b border-navy-100 px-5 py-3.5 text-sm font-semibold text-navy-950">
          Letzte Anfragen
        </h2>
        {requests.length === 0 ? (
          <p className="p-5 text-sm text-navy-500">Noch keine Anfragen protokolliert.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-500">
                  <th className="px-5 py-2.5 font-medium">Ticker</th>
                  <th className="px-5 py-2.5 font-medium">User</th>
                  <th className="px-5 py-2.5 font-medium">Zeitpunkt</th>
                  <th className="px-5 py-2.5 font-medium">Quelle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {requests.map((r, idx) => (
                  <tr key={idx}>
                    <td className="px-5 py-2.5 font-medium text-navy-950">{r.ticker}</td>
                    <td className="px-5 py-2.5 text-navy-500">
                      {r.user_id ? r.user_id.slice(0, 8) : 'Anonym'}
                    </td>
                    <td className="px-5 py-2.5 text-navy-500">
                      {new Date(r.requested_at).toLocaleString('de-DE')}
                    </td>
                    <td className="px-5 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.source === 'cache'
                            ? 'bg-ampel-green/15 text-ampel-green'
                            : 'bg-gold-500/15 text-gold-600'
                        }`}
                      >
                        {r.source === 'cache' ? 'Cache' : 'Neu'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  onClick,
  highlight,
}: {
  label: string
  value: string
  onClick?: () => void
  highlight?: boolean
}) {
  const content = (
    <>
      <p
        className={`text-xs font-medium uppercase tracking-wide ${
          highlight ? 'text-ampel-red' : 'text-navy-500'
        }`}
      >
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? 'text-ampel-red' : 'text-navy-950'}`}>
        {value}
      </p>
    </>
  )

  const boxClass = highlight
    ? 'rounded-xl border border-ampel-red/40 bg-ampel-red/10 p-4 shadow-card'
    : 'rounded-xl border border-navy-200 bg-white p-4 shadow-card'

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${boxClass} text-left transition-colors hover:border-gold-500`}
      >
        {content}
      </button>
    )
  }

  return <div className={boxClass}>{content}</div>
}
