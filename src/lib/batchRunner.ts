// Ablauf eines einzelnen Tickers im Browser-Batch (Batch-Auftrag 07.10.):
// Wiederholung bei Rate-Limit mit Backoff, Token-Erneuerung bei 401,
// Doppellauf als "uebersprungen". Ohne React und ohne Netz - alle Zugriffe
// kommen ueber RunDeps herein, damit die Regeln testbar sind.
import { KEPT_OLD_ANALYSIS_MESSAGE, type BatchRunOutcome } from './analysisRun'

// Pausen vor der 1., 2. und 3. Wiederholung nach einem Rate-Limit. Scheitert
// auch die dritte Wiederholung, wird der Ticker uebersprungen.
export const BACKOFF_MS = [60_000, 120_000, 300_000] as const

// Eigenes Limit der analyse-Function: 120 neue Analysen pro Kalenderstunde
// und Nutzer (MAX_ANALYSES_PER_HOUR, analyse/index.ts; Zaehler
// check_user_rate_limit, Migration 20260928092000). 3600 s / 120 = 30 s
// Abstand zwischen zwei Starts haelt das Limit sicher ein.
export const DEFAULT_INTERVAL_SECONDS = 30

// Fehlercodes (stock_analyses.last_run_error_code), bei denen sich Warten lohnt.
const RATE_LIMIT_CODES = new Set(['fmp_rate_limit', 'llm_rate_limit'])

export type TickerResultKind = 'done' | 'cached' | 'skipped' | 'failed' | 'kept_old'

export interface TickerResult {
  ticker: string
  kind: TickerResultKind
  // Fangnetz hat Felder aus dem Text gerettet (data_flags.llm_recovered).
  rescued?: boolean
  reason?: string
}

export interface RunOutcome {
  outcome: BatchRunOutcome | 'timeout'
  errorCode: string | null
  errorPublic: string | null
  rescued: boolean
}

export interface HttpErrorLike {
  status?: number
  code?: string
  message: string
}

export interface RunDeps {
  // Aktueller Token (ggf. vorab erneuert); null = keine Session.
  getToken(): Promise<string | null>
  // Session erzwungen erneuern; null = gescheitert.
  refreshToken(): Promise<string | null>
  // Startet die Analyse; wirft bei HTTP-Fehlern ein HttpErrorLike.
  request(ticker: string, token: string): Promise<{ source: string }>
  // Wartet, bis der Lauf beendet ist.
  waitForOutcome(ticker: string): Promise<RunOutcome>
  // Pause (abbrechbar); reason fuer die Anzeige.
  sleep(ms: number, reason: 'rate_limit'): Promise<void>
  isCancelled(): boolean
}

export type RunTickerResult = TickerResult | { ticker: string; kind: 'needs_login' }

export async function runTicker(ticker: string, deps: RunDeps): Promise<RunTickerResult> {
  let rateLimitHits = 0
  let refreshed = false

  // true = nach Pause erneut versuchen, false = aufgeben.
  async function backoff(): Promise<boolean> {
    if (rateLimitHits >= BACKOFF_MS.length) return false
    await deps.sleep(BACKOFF_MS[rateLimitHits], 'rate_limit')
    rateLimitHits++
    return !deps.isCancelled()
  }
  const rateLimitSkip = (): TickerResult => ({
    ticker,
    kind: 'skipped',
    reason: deps.isCancelled() ? 'abgebrochen während der Rate-Limit-Pause' : 'übersprungen (Rate-Limit)',
  })

  for (;;) {
    const token = await deps.getToken()
    if (!token) return { ticker, kind: 'needs_login' }

    let source: string
    try {
      source = (await deps.request(ticker, token)).source
    } catch (err) {
      const e = err as HttpErrorLike
      if (e.status === 401) {
        // Token abgelaufen: einmal erneuern und denselben Ticker wiederholen.
        if (refreshed) return { ticker, kind: 'needs_login' }
        refreshed = true
        if (!(await deps.refreshToken())) return { ticker, kind: 'needs_login' }
        continue
      }
      if (e.status === 409) return { ticker, kind: 'skipped', reason: 'übersprungen (läuft bereits)' }
      if (e.status === 429) {
        if (await backoff()) continue
        return rateLimitSkip()
      }
      return { ticker, kind: 'failed', reason: e.message }
    }

    if (source === 'cache') return { ticker, kind: 'cached' }

    const o = await deps.waitForOutcome(ticker)
    if (o.outcome === 'done') return { ticker, kind: 'done', rescued: o.rescued }
    if ((o.outcome === 'error' || o.outcome === 'error_kept') && o.errorCode && RATE_LIMIT_CODES.has(o.errorCode)) {
      if (await backoff()) continue
      return rateLimitSkip()
    }
    if (o.outcome === 'error_kept') {
      return { ticker, kind: 'kept_old', reason: o.errorPublic ? `${KEPT_OLD_ANALYSIS_MESSAGE}: ${o.errorPublic}` : KEPT_OLD_ANALYSIS_MESSAGE }
    }
    if (o.outcome === 'error') return { ticker, kind: 'failed', reason: o.errorPublic ?? 'Analyse fehlgeschlagen' }
    return { ticker, kind: 'failed', reason: 'Zeitüberschreitung beim Warten auf Ergebnis' }
  }
}

// Wartezeit bis zum naechsten Start. Nur echte Laeufe zaehlen fuer das
// Limit, nach einem Cache-Treffer geht es ohne Pause weiter.
export function throttleWaitMs(lastRunStartMs: number | null, nowMs: number, intervalSeconds: number): number {
  if (lastRunStartMs === null) return 0
  return Math.max(0, lastRunStartMs + intervalSeconds * 1000 - nowMs)
}

export interface BatchSummary {
  done: number
  cached: number
  skipped: number
  failed: number
  rescued: number
  keptOld: number
}

export function summarize(results: TickerResult[]): BatchSummary {
  const s: BatchSummary = { done: 0, cached: 0, skipped: 0, failed: 0, rescued: 0, keptOld: 0 }
  for (const r of results) {
    if (r.kind === 'done') s.done++
    else if (r.kind === 'cached') s.cached++
    else if (r.kind === 'skipped') s.skipped++
    else if (r.kind === 'failed') s.failed++
    else if (r.kind === 'kept_old') s.keptOld++
    if (r.rescued) s.rescued++
  }
  return s
}

// Nicht erfolgreiche Ticker fuer einen zweiten Durchgang, inkl. der
// wegen Abbruchs nie gestarteten - in der Reihenfolge der Ausgangsliste.
export function unsuccessfulTickers(all: string[], results: TickerResult[]): string[] {
  const ok = new Set(results.filter((r) => r.kind === 'done' || r.kind === 'cached').map((r) => r.ticker))
  return all.filter((t) => !ok.has(t))
}
