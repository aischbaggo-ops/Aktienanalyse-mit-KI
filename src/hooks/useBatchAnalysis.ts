import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { requestAnalyse } from '../lib/webhooks'
import { estimateBatch, MAX_BATCH_SIZE, type BatchEstimate } from '../utils/batchEstimate'
import { batchRunOutcome } from '../lib/analysisRun'
import type { StockAnalysis } from '../types/database'
import {
  DEFAULT_INTERVAL_SECONDS,
  runTicker,
  summarize,
  throttleWaitMs,
  unsuccessfulTickers,
  type RunDeps,
  type RunOutcome,
  type TickerResult,
} from '../lib/batchRunner'

// paused: Session abgelaufen und nicht erneuerbar - nach erneutem Login
// (z. B. in einem anderen Tab) mit resume() an derselben Stelle weiter.
export type BatchPhase = 'idle' | 'confirming' | 'running' | 'paused' | 'done'

export interface BatchResult extends TickerResult {
  // done oder cached - fuer die Ergebnisliste nach Score.
  success: boolean
  cached?: boolean
  error?: string
  // Nach Abschluss aus stock_analyses nachgeladen (bei success und kept_old).
  name?: string | null
  score?: number | null
  analysisId?: string | null
  // Gleiche Quelle wie Watchlist/"Letzte Analysen" (chart_data.profileMeta.image).
  image?: string | null
}

export interface BatchOptions {
  // true: jeder Ticker wird neu gerechnet (Watchlist-Batch).
  // false: bestehender 7-Tage-Cache wird genutzt (Index-/Freitext-Batch).
  // Ein abgebrochener Lauf laesst sich so durch erneutes Einfuegen derselben
  // Liste fortsetzen: fertige Ticker sind Cache-Treffer (gueltig, < 7 Tage).
  forceRefresh: boolean
}

// Laufende Pause, fuer die Anzeige.
export interface BatchWait {
  reason: 'rate_limit' | 'throttle'
  until: number
}

const CACHE_MAX_AGE_DAYS = 7
// Ein Lauf dauert ca. 20-40 s; Claude kann bei Last laenger brauchen.
const OUTCOME_TIMEOUT_MS = 180_000
const POLL_MS = 2500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toBatchResult(r: TickerResult): BatchResult {
  return {
    ...r,
    success: r.kind === 'done' || r.kind === 'cached',
    cached: r.kind === 'cached',
    error: r.kind === 'done' || r.kind === 'cached' ? undefined : r.reason,
  }
}

// Token der aktuellen Session; laeuft er in der naechsten Minute ab, vorab
// erneuern (lange Batches ueberdauern die Token-Laufzeit von 1 Stunde).
async function refreshToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.refreshSession()
  return error ? null : data.session?.access_token ?? null
}

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  const s = data.session
  if (!s) return null
  if (s.expires_at && s.expires_at * 1000 - Date.now() < 60_000) return refreshToken()
  return s.access_token
}

interface OutcomeRow {
  status: StockAnalysis['status']
  score_total: number | null
  last_run_status: 'running' | 'done' | 'error' | null
  last_run_error_code: string | null
  last_run_error_public: string | null
  data_flags: { llm_recovered?: boolean } | null
}

// Sequenzieller Batch-Lauf ueber mehrere Ticker im Browser. Die Analyse
// selbst laeuft serverseitig im Hintergrund (waitUntil); hier wird pro
// Ticker bis zum Abschluss gewartet, damit FMP/Claude nicht parallel
// belastet werden. Rate-Limit, Token-Ablauf und Doppellaeufe regelt
// runTicker() (lib/batchRunner.ts).
export function useBatchAnalysis(accessToken: string | undefined, onFinished?: () => void) {
  const [phase, setPhase] = useState<BatchPhase>('idle')
  const [tickers, setTickers] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<BatchResult[]>([])
  const [estimate, setEstimate] = useState<BatchEstimate | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [forceRefresh, setForceRefresh] = useState(false)
  const [intervalSeconds, setIntervalSeconds] = useState(DEFAULT_INTERVAL_SECONDS)
  const [wait, setWait] = useState<BatchWait | null>(null)
  const [wakeLockActive, setWakeLockActive] = useState(false)

  const cancelRef = useRef(false)
  // Sperre gegen einen zweiten Batch im selben Tab (auch bei Doppelklick,
  // bevor phase neu gerendert ist).
  const activeRef = useRef(false)
  const collectedRef = useRef<BatchResult[]>([])
  const pausedAtRef = useRef(0)
  const lastRunStartRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  // Bildschirm wach halten, solange der Batch laeuft (Wake Lock API, wo
  // verfuegbar). Der Browser gibt die Sperre beim Tab-Wechsel frei - beim
  // Zurueckkehren wird sie neu angefordert.
  async function acquireWakeLock() {
    try {
      if (!('wakeLock' in navigator) || wakeLockRef.current) return
      const lock = await navigator.wakeLock.request('screen')
      wakeLockRef.current = lock
      setWakeLockActive(true)
      lock.addEventListener('release', () => {
        wakeLockRef.current = null
        setWakeLockActive(false)
      })
    } catch {
      setWakeLockActive(false)
    }
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
    setWakeLockActive(false)
  }

  useEffect(() => {
    if (phase !== 'running') return
    function onVisible() {
      if (document.visibilityState === 'visible') acquireWakeLock()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [phase])

  useEffect(() => () => releaseWakeLock(), [])

  // Bereitet den Bestaetigungsdialog vor. Gibt eine Fehlermeldung zurueck,
  // wenn der Lauf nicht gestartet werden kann.
  const prepare = useCallback(async (list: string[], options: BatchOptions): Promise<string | null> => {
    if (activeRef.current) return 'Es läuft bereits ein Batch in diesem Tab.'
    if (list.length === 0) return 'Keine Werte ausgewählt.'
    if (list.length > MAX_BATCH_SIZE) return `Maximal ${MAX_BATCH_SIZE} Werte pro Lauf.`

    setTickers(list)
    setForceRefresh(options.forceRefresh)
    setEstimate(null)
    setPhase('confirming')
    setEstimating(true)

    // Ohne try/catch wuerde eine echte Netzwerk-Exception (nicht nur ein
    // {error}-Feld, sondern ein tatsaechlich verworfenes Promise) hier
    // ungefangen durchschlagen - phase bliebe dauerhaft auf "confirming"
    // haengen (oben schon gesetzt, nie zurueckgesetzt), und JEDER
    // Batch-Button (Index- UND Freitext-Auswahl) waere ab dann fuer den
    // Rest der Session ohne jede erkennbare Ursache deaktiviert. Genau das
    // Symptom aus dem Nutzertest ("Mitglieder laden tut nichts").
    try {
      const cutoff = new Date(Date.now() - CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      // Kostendurchschnitt kommt aus einer RPC statt einer Direktabfrage auf
      // stock_analyses_costs - die Tabelle selbst ist admin-only (Pentest-Fix,
      // siehe Migration 20260924120000), die RPC liefert bewusst nur den
      // aggregierten Mittelwert, nie einzelne Zeilen/Kosten.
      // Cache-Regel wie im Backend (isCacheFresh): status 'done' UND
      // Gesamtscore vorhanden UND juenger als 7 Tage (updated_at = Datum der
      // gespeicherten Analyse).
      const [cacheRes, costRpc] = await Promise.all([
        options.forceRefresh
          ? Promise.resolve({ data: [] as { ticker: string }[] })
          : supabase
              .from('stock_analyses')
              .select('ticker')
              .in('ticker', list)
              .eq('status', 'done')
              .not('score_total', 'is', null)
              .gte('updated_at', cutoff),
        supabase.rpc('get_avg_recent_analysis_cost'),
      ])
      const avgCost = typeof costRpc.data === 'number' ? costRpc.data : null

      setEstimate(estimateBatch(list.length, cacheRes.data?.length ?? 0, avgCost))
      setEstimating(false)
      return null
    } catch (err) {
      setPhase('idle')
      setEstimating(false)
      return err instanceof Error ? err.message : 'Kostenschätzung fehlgeschlagen.'
    }
  }, [])

  const reset = useCallback(() => {
    if (activeRef.current) return
    setPhase('idle')
    setTickers([])
    setResults([])
    setEstimate(null)
    setWait(null)
    collectedRef.current = []
  }, [])

  // Pause, die "Abbrechen" innerhalb einer Sekunde beendet.
  async function sleepCancellable(ms: number, reason: BatchWait['reason']) {
    const until = Date.now() + ms
    setWait({ reason, until })
    try {
      while (Date.now() < until && !cancelRef.current) {
        await sleep(Math.min(1000, until - Date.now()))
      }
    } finally {
      setWait(null)
    }
  }

  // Wartet auf das Ende des Laufs: fertig, sobald last_run_status nicht
  // mehr 'running' ist (siehe batchRunOutcome).
  async function waitForOutcome(ticker: string): Promise<RunOutcome> {
    const start = Date.now()
    while (Date.now() - start < OUTCOME_TIMEOUT_MS) {
      const { data } = await supabase
        .from('stock_analyses')
        .select('status, score_total, last_run_status, last_run_error_code, last_run_error_public, data_flags:chart_data->data_flags')
        .eq('ticker', ticker)
        .maybeSingle()
      const row = data as unknown as OutcomeRow | null
      const outcome = batchRunOutcome(row)
      if (outcome !== 'pending') {
        return {
          outcome,
          errorCode: row?.last_run_error_code ?? null,
          errorPublic: row?.last_run_error_public ?? null,
          rescued: outcome === 'done' && row?.data_flags?.llm_recovered === true,
        }
      }
      await sleep(POLL_MS)
    }
    return { outcome: 'timeout', errorCode: null, errorPublic: null, rescued: false }
  }

  // Scores/Namen fuer die Ergebnisliste nachladen. Eine Netzwerk-Exception
  // hier darf den Abschluss nicht verhindern (siehe finally in runFrom).
  async function enrichResults(collected: BatchResult[]) {
    const withRow = collected.filter((r) => r.success || r.kind === 'kept_old').map((r) => r.ticker)
    if (withRow.length === 0) return
    const { data } = await supabase
      .from('stock_analyses')
      .select('id, ticker, company_name, score_total, chart_data')
      .in('ticker', withRow)
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

  async function runFrom(startIndex: number, list: string[], force: boolean) {
    activeRef.current = true
    cancelRef.current = false
    setPhase('running')
    acquireWakeLock()

    const collected = collectedRef.current
    const push = (r: TickerResult) => {
      collected.push(toBatchResult(r))
      setResults([...collected])
    }
    const deps: RunDeps = {
      getToken,
      refreshToken,
      request: async (ticker, token) => {
        lastRunStartRef.current = Date.now()
        const res = await requestAnalyse(
          { ticker, max_age_days: force ? null : CACHE_MAX_AGE_DAYS, force_refresh: force },
          token,
        )
        // Cache-Treffer zaehlen nicht fuer das Rate-Limit: keine Drosselung.
        if (res.source === 'cache') lastRunStartRef.current = null
        return res
      },
      waitForOutcome,
      sleep: (ms, reason) => sleepCancellable(ms, reason),
      isCancelled: () => cancelRef.current,
    }

    let paused = false
    try {
      for (let i = startIndex; i < list.length; i++) {
        if (cancelRef.current) break
        setIndex(i)
        const waitMs = throttleWaitMs(lastRunStartRef.current, Date.now(), intervalSeconds)
        if (waitMs > 0) await sleepCancellable(waitMs, 'throttle')
        if (cancelRef.current) break

        const r = await runTicker(list[i], deps).catch(
          (err): TickerResult => ({ ticker: list[i], kind: 'failed', reason: err instanceof Error ? err.message : 'Unbekannter Fehler' }),
        )
        if (r.kind === 'needs_login') {
          pausedAtRef.current = i
          paused = true
          break
        }
        push(r)
      }
    } finally {
      activeRef.current = false
      releaseWakeLock()
      if (paused) {
        setPhase('paused')
      } else {
        try {
          await enrichResults(collected)
        } catch {
          // Anzeige ohne Namen/Scores ist besser als ein haengender Lauf.
        } finally {
          setPhase('done')
          onFinishedRef.current?.()
        }
      }
    }
  }

  const start = useCallback(async () => {
    if (activeRef.current || !accessToken) return
    collectedRef.current = []
    lastRunStartRef.current = null
    setIndex(0)
    setResults([])
    await runFrom(0, tickers, forceRefresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tickers, forceRefresh, intervalSeconds])

  // Nach erneutem Login an der unterbrochenen Stelle fortsetzen.
  const resume = useCallback(async () => {
    if (activeRef.current || phase !== 'paused') return
    await runFrom(pausedAtRef.current, tickers, forceRefresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tickers, forceRefresh, intervalSeconds])

  const cancel = useCallback(() => {
    cancelRef.current = true
    // Pausiert (kein aktiver Lauf): direkt mit dem bisherigen Stand beenden.
    if (!activeRef.current && phase === 'paused') {
      setPhase('done')
      onFinishedRef.current?.()
    }
  }, [phase])

  const summary = summarize(results)
  const notSuccessful = unsuccessfulTickers(tickers, results)

  return {
    phase,
    tickers,
    index,
    results,
    estimate,
    estimating,
    forceRefresh,
    intervalSeconds,
    setIntervalSeconds,
    wait,
    wakeLockActive,
    summary,
    notSuccessful,
    prepare,
    start,
    resume,
    cancel,
    reset,
  }
}
