import { useCallback, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { requestAnalyse } from '../lib/webhooks'
import { estimateBatch, MAX_BATCH_SIZE, type BatchEstimate } from '../utils/batchEstimate'

export type BatchPhase = 'idle' | 'confirming' | 'running' | 'done'

export interface BatchResult {
  ticker: string
  success: boolean
  cached?: boolean
  error?: string
  // Nach Abschluss aus stock_analyses nachgeladen (nur bei success).
  name?: string | null
  score?: number | null
  analysisId?: string | null
  // Gleiche Quelle wie Watchlist/"Letzte Analysen" (chart_data.profileMeta.image).
  image?: string | null
}

export interface BatchOptions {
  // true: jeder Ticker wird neu gerechnet (Watchlist-Batch).
  // false: bestehender 7-Tage-Cache wird genutzt (Index-/Freitext-Batch).
  forceRefresh: boolean
}

const CACHE_MAX_AGE_DAYS = 7

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Sequenzieller Batch-Lauf ueber mehrere Ticker. Die Analyse selbst laeuft
// serverseitig im Hintergrund (waitUntil); hier wird pro Ticker bis zum
// tatsaechlichen Abschluss gewartet, damit FMP/Claude nicht parallel
// belastet werden (Rate-Limits).
export function useBatchAnalysis(accessToken: string | undefined, onFinished?: () => void) {
  const [phase, setPhase] = useState<BatchPhase>('idle')
  const [tickers, setTickers] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<BatchResult[]>([])
  const [estimate, setEstimate] = useState<BatchEstimate | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [forceRefresh, setForceRefresh] = useState(false)

  const cancelRef = useRef(false)
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  // Bereitet den Bestaetigungsdialog vor. Gibt eine Fehlermeldung zurueck,
  // wenn der Lauf nicht gestartet werden kann.
  const prepare = useCallback(async (list: string[], options: BatchOptions): Promise<string | null> => {
    if (list.length === 0) return 'Keine Werte ausgewählt.'
    if (list.length > MAX_BATCH_SIZE) return `Maximal ${MAX_BATCH_SIZE} Werte pro Lauf.`

    setTickers(list)
    setForceRefresh(options.forceRefresh)
    setEstimate(null)
    setPhase('confirming')
    setEstimating(true)

    const cutoff = new Date(Date.now() - CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const [cacheRes, costRes] = await Promise.all([
      options.forceRefresh
        ? Promise.resolve({ data: [] as { ticker: string }[] })
        : supabase.from('stock_analyses').select('ticker').in('ticker', list).eq('status', 'done').gte('updated_at', cutoff),
      supabase
        .from('stock_analyses')
        .select('cost_usd_claude')
        .not('cost_usd_claude', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(20),
    ])
    const costs = (costRes.data ?? [])
      .map((r) => r.cost_usd_claude as number | null)
      .filter((c): c is number => typeof c === 'number')
    const avgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : null

    setEstimate(estimateBatch(list.length, cacheRes.data?.length ?? 0, avgCost))
    setEstimating(false)
    return null
  }, [])

  const reset = useCallback(() => {
    setPhase('idle')
    setTickers([])
    setResults([])
    setEstimate(null)
  }, [])

  // Wartet auf den tatsaechlichen Abschluss (Polling auf status), da
  // requestAnalyse() sofort zurueckkehrt.
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

  const start = useCallback(async () => {
    if (!accessToken) return
    setPhase('running')
    setIndex(0)
    setResults([])
    cancelRef.current = false

    const collected: BatchResult[] = []
    const push = (r: BatchResult) => {
      collected.push(r)
      setResults([...collected])
    }

    for (let i = 0; i < tickers.length; i++) {
      if (cancelRef.current) break
      setIndex(i)
      const ticker = tickers[i]
      try {
        const res = await requestAnalyse(
          {
            ticker,
            max_age_days: forceRefresh ? null : CACHE_MAX_AGE_DAYS,
            force_refresh: forceRefresh,
          },
          accessToken,
        )
        if (res.source === 'cache') {
          push({ ticker, success: true, cached: true })
          continue
        }
        const outcome = await waitForAnalysisDone(ticker)
        if (outcome === 'done') push({ ticker, success: true })
        else if (outcome === 'error') push({ ticker, success: false, error: 'Analyse fehlgeschlagen' })
        else push({ ticker, success: false, error: 'Zeitüberschreitung beim Warten auf Ergebnis' })
      } catch (err) {
        push({ ticker, success: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' })
      }
    }

    // Scores/Namen fuer die Ergebnisliste nachladen.
    const okTickers = collected.filter((r) => r.success).map((r) => r.ticker)
    if (okTickers.length > 0) {
      const { data } = await supabase
        .from('stock_analyses')
        .select('id, ticker, company_name, score_total, chart_data')
        .in('ticker', okTickers)
      const byTicker = new Map((data ?? []).map((row) => [row.ticker as string, row]))
      setResults(
        collected.map((r) => {
          const row = byTicker.get(r.ticker)
          if (!row) return r
          const meta = (row.chart_data as { profileMeta?: { image?: string | null } } | null)?.profileMeta
          return {
            ...r,
            name: row.company_name as string | null,
            score: row.score_total as number | null,
            analysisId: row.id as string,
            image: meta?.image ?? null,
          }
        }),
      )
    }

    setPhase('done')
    onFinishedRef.current?.()
  }, [accessToken, tickers, forceRefresh])

  const cancel = useCallback(() => {
    cancelRef.current = true
  }, [])

  return { phase, tickers, index, results, estimate, estimating, forceRefresh, prepare, start, cancel, reset }
}
