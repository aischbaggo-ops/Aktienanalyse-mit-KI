import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RequestLog } from '../types/database'
import { SeriesBarChart } from '../components/memo/Charts'

// Manuell eingetragen, NICHT von FMP abgefragt (es gibt keinen Endpoint,
// der das eigene Tageskontingent zurueckliefert) - bei Plan-Wechsel
// anpassen. Dient nur als grobe visuelle Referenzlinie im Auslastungs-
// Chart, nicht als verifizierter Live-Wert.
const FMP_DAILY_LIMIT = 250

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
  runsToday: number
  searchesToday: number
  hourlyRuns: number[]
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
        { data: runsTodayRows, error: e15 },
        { count: searchesTodayCount, error: e16 },
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
        supabase
          .from('request_log')
          .select('requested_at')
          .eq('source', 'processing')
          .gte('requested_at', todayStart.toISOString())
          .limit(2000),
        supabase
          .from('search_log')
          .select('*', { count: 'exact', head: true })
          .gte('requested_at', todayStart.toISOString()),
      ])

      const firstError =
        e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9 || e10 || e11 || e12 || e13 || e14 || e15 || e16
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

      const hourlyRuns = new Array(24).fill(0) as number[]
      for (const row of runsTodayRows ?? []) {
        const hour = new Date(row.requested_at).getHours()
        hourlyRuns[hour] += 1
      }

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
        runsToday: (runsTodayRows ?? []).length,
        searchesToday: searchesTodayCount ?? 0,
        hourlyRuns,
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

  if (loading) return <p className="text-sm text-memo-muted">Lade Aktivitätsdaten...</p>

  if (error) {
    return <div className="border border-memo-minus/40 bg-memo-minus/10 p-5 text-sm text-memo-minusText">{error}</div>
  }

  if (!metrics) return null

  // Laufende Summe statt Laeufe-pro-Stunde: erst dadurch wird die 250er-
  // Referenzlinie aussagekraeftig (Fruehwarn-Prinzip - laeuft die Linie im
  // Tagesverlauf auf die Grenze zu, statt einzelner, an sich unauffaelliger
  // Stundenwerte).
  const cumulativeRuns = metrics.hourlyRuns.reduce<number[]>((acc, v, i) => {
    acc.push((acc[i - 1] ?? 0) + v)
    return acc
  }, [])

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Anfragen heute" value={metrics.requestsToday.toString()} />
        <Kpi label="Läufe heute (neu)" value={metrics.runsToday.toString()} />
        <Kpi label="Anfragen gesamt" value={metrics.requestsTotal.toString()} />
        <Kpi label="Kosten (Claude)" value={`$${metrics.totalCostUsd.toFixed(2)}`} />
        <Kpi label="Cache-Trefferquote" value={`${metrics.cacheHitRatePct.toFixed(1)}%`} tone="plus" />
        <Kpi
          label="Erfolgsquote"
          value={metrics.successRatePct != null ? `${metrics.successRatePct.toFixed(1)}%` : '–'}
          tone="plus"
        />
        <Kpi label="Fehlschläge" value={metrics.errorCount.toString()} tone={metrics.errorCount > 0 ? 'minus' : undefined} />
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
          tone={metrics.deviationRatePct != null && metrics.deviationRatePct > 20 ? 'minus' : undefined}
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-memo-muted">
          Auslastung heute (eigene Analyse-Läufe)
        </p>
        <p className="mb-1 font-analyst text-lg text-memo-ink">
          {metrics.runsToday} von {FMP_DAILY_LIMIT} (manuell, ≈
          {((metrics.runsToday / FMP_DAILY_LIMIT) * 100).toFixed(0)}%)
        </p>
        <p className="mb-3 text-xs text-memo-muted">
          Kumulierte Summe eigener Analyse-Läufe im Tagesverlauf (request_log, source=processing),
          nicht die tatsächliche FMP-Auslastung — Ticker-Suche ist hier nicht enthalten, eine Analyse
          löst ≈13 FMP-Aufrufe aus. Gestrichelte Linie: manuell eingetragenes Tageskontingent
          ({FMP_DAILY_LIMIT}), nicht von FMP abgefragt — läuft die Kurve darauf zu, wird es eng.
        </p>
        <SeriesBarChart
          years={Array.from({ length: 24 }, (_, h) => h.toString().padStart(2, '0'))}
          values={cumulativeRuns}
          height={140}
          formatValue={(v) => `${v} Lauf${v === 1 ? '' : 'e'} kumuliert`}
          referenceLine={{ value: FMP_DAILY_LIMIT, label: `${FMP_DAILY_LIMIT}/Tag (manuell)` }}
        />
        <p className="mt-2 text-xs text-memo-muted">
          Suchanfragen heute (separat erfasst, ab jetzt): {metrics.searchesToday}
        </p>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-memo-muted">
          Kontrollläufe — Score-Abweichung &gt;3 Punkte
        </p>
        <p className="mb-3 text-xs text-memo-muted">
          Häufige Treffer bei einem Ticker/einer Branche deuten auf Nachschärfbedarf bei der
          Score-Berechnung hin.
        </p>
        {deviationRequests.length === 0 ? (
          <p className="text-sm text-memo-muted">Keine Kontrollläufe protokolliert.</p>
        ) : (
          <ul className="space-y-2">
            {deviationRequests.map((r, idx) => (
              <li key={idx} className="flex items-center gap-3 text-sm">
                <span className="w-16 flex-shrink-0 text-memo-ink">{r.ticker}</span>
                <span className={(r.deviation_amount ?? 0) >= 0 ? 'text-memo-plusText' : 'text-memo-minusText'}>
                  {r.deviation_amount != null
                    ? `${r.deviation_amount >= 0 ? '+' : ''}${r.deviation_amount.toFixed(1)} Pkt.`
                    : '–'}
                </span>
                <span className="text-memo-muted">
                  {new Date(r.requested_at).toLocaleString('de-DE')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-memo-muted">Fehlschläge</p>
        {failedRequests.length === 0 ? (
          <p className="text-sm text-memo-muted">Keine Fehlschläge protokolliert.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-memo-line2 text-left text-xs uppercase tracking-wide text-memo-muted">
                  <th className="py-2 pr-4 font-medium">Ticker</th>
                  <th className="py-2 pr-4 font-medium">Zeitpunkt</th>
                  <th className="py-2 font-medium">Fehlermeldung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-memo-line2">
                {failedRequests.map((r, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 pr-4 align-top text-memo-ink">{r.ticker}</td>
                    <td className="whitespace-nowrap py-2.5 pr-4 align-top text-memo-muted">
                      {new Date(r.requested_at).toLocaleString('de-DE')}
                    </td>
                    <td className="py-2.5 align-top text-memo-minusText">
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
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-memo-muted">
              Datenlücken — unvollständige FMP-Daten (Free-Plan)
            </p>
            <button
              onClick={() => setShowDataGaps(false)}
              className="text-xs text-memo-muted hover:text-memo-ink"
            >
              Ausblenden
            </button>
          </div>
          {dataGapRequests.length === 0 ? (
            <p className="text-sm text-memo-muted">Keine Datenlücken protokolliert.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-memo-line2 text-left text-xs uppercase tracking-wide text-memo-muted">
                    <th className="py-2 pr-4 font-medium">Ticker</th>
                    <th className="py-2 font-medium">Zeitpunkt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-memo-line2">
                  {dataGapRequests.map((r, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 pr-4 text-memo-ink">{r.ticker}</td>
                      <td className="whitespace-nowrap py-2.5 text-memo-muted">
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

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-memo-muted">Meistgesuchte Ticker</p>
        {metrics.topTickers.length === 0 ? (
          <p className="text-sm text-memo-muted">Keine Daten vorhanden.</p>
        ) : (
          <ol className="space-y-2">
            {metrics.topTickers.map((t, idx) => (
              <li key={t.ticker} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-memo-muted">{idx + 1}.</span>
                <span className="text-memo-ink">{t.ticker}</span>
                <span className="text-memo-muted">{t.count}× angefragt</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-memo-muted">Letzte Anfragen</p>
        {requests.length === 0 ? (
          <p className="text-sm text-memo-muted">Noch keine Anfragen protokolliert.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-memo-line2 text-left text-xs uppercase tracking-wide text-memo-muted">
                  <th className="py-2 pr-4 font-medium">Ticker</th>
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 font-medium">Zeitpunkt</th>
                  <th className="py-2 font-medium">Quelle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-memo-line2">
                {requests.map((r, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 pr-4 text-memo-ink">{r.ticker}</td>
                    <td className="py-2.5 pr-4 text-memo-muted">
                      {r.user_id ? r.user_id.slice(0, 8) : 'Anonym'}
                    </td>
                    <td className="py-2.5 pr-4 text-memo-muted">
                      {new Date(r.requested_at).toLocaleString('de-DE')}
                    </td>
                    <td className={`py-2.5 ${r.source === 'cache' ? 'text-memo-plusText' : 'text-memo-muted'}`}>
                      {r.source === 'cache' ? 'Cache' : 'Neu'}
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
  tone,
}: {
  label: string
  value: string
  onClick?: () => void
  tone?: 'plus' | 'minus'
}) {
  const valueClass = tone === 'plus' ? 'text-memo-plusText' : tone === 'minus' ? 'text-memo-minusText' : 'text-memo-ink'
  const content = (
    <>
      <p className="text-xs uppercase tracking-wide text-memo-muted">{label}</p>
      <p className={`mt-1.5 font-analyst text-2xl ${valueClass}`}>{value}</p>
    </>
  )

  const boxClass = 'border border-memo-line px-4 py-3'

  if (onClick) {
    return (
      <button onClick={onClick} className={`${boxClass} text-left transition-colors hover:border-memo-ink`}>
        {content}
      </button>
    )
  }

  return <div className={boxClass}>{content}</div>
}
