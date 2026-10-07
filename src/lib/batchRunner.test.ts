import { describe, expect, it } from 'vitest'
import {
  BACKOFF_MS,
  DEFAULT_INTERVAL_SECONDS,
  runTicker,
  summarize,
  throttleWaitMs,
  unsuccessfulTickers,
  type HttpErrorLike,
  type RunDeps,
  type RunOutcome,
} from './batchRunner'

const done: RunOutcome = { outcome: 'done', errorCode: null, errorPublic: null, rescued: false }
const err = (status: number, code?: string): HttpErrorLike => ({ status, code, message: `HTTP ${status}` })

// Fake-Abhaengigkeiten: request/waitForOutcome liefern nacheinander die
// vorgegebenen Antworten; sleep merkt sich nur die Pausen.
function fakeDeps(opts: {
  requests?: (HttpErrorLike | { source: string })[]
  outcomes?: RunOutcome[]
  token?: string | null
  refreshed?: string | null
  cancelAfterSleep?: boolean
}) {
  const sleeps: number[] = []
  const tokensUsed: string[] = []
  let refreshCalls = 0
  let cancelled = false
  const requests = [...(opts.requests ?? [{ source: 'processing' }])]
  const outcomes = [...(opts.outcomes ?? [done])]
  let token = opts.token === undefined ? 't1' : opts.token
  const deps: RunDeps = {
    getToken: async () => token,
    refreshToken: async () => {
      refreshCalls++
      const next = opts.refreshed === undefined ? 't2' : opts.refreshed
      if (next) token = next
      return next
    },
    request: async (_ticker, t) => {
      tokensUsed.push(t)
      const r = requests.length > 1 ? requests.shift()! : requests[0]
      if ('status' in r) throw r
      return r as { source: string }
    },
    waitForOutcome: async () => (outcomes.length > 1 ? outcomes.shift()! : outcomes[0]),
    sleep: async (ms) => {
      sleeps.push(ms)
      if (opts.cancelAfterSleep) cancelled = true
    },
    isCancelled: () => cancelled,
  }
  return { deps, sleeps, tokensUsed, refreshCalls: () => refreshCalls }
}

describe('runTicker: Rate-Limit mit Backoff', () => {
  it('wartet bei 429 60 s und wiederholt denselben Ticker', async () => {
    const f = fakeDeps({ requests: [err(429, 'rate_limit'), { source: 'processing' }] })
    const r = await runTicker('AAPL', f.deps)
    expect(r).toEqual({ ticker: 'AAPL', kind: 'done', rescued: false })
    expect(f.sleeps).toEqual([60_000])
  })

  it('steigert die Pausen 60/120/300 s und ueberspringt nach drei erfolglosen Wiederholungen', async () => {
    const f = fakeDeps({ requests: [err(429)] })
    const r = await runTicker('AAPL', f.deps)
    expect(f.sleeps).toEqual([...BACKOFF_MS])
    expect(r).toEqual({ ticker: 'AAPL', kind: 'skipped', reason: 'übersprungen (Rate-Limit)' })
  })

  it('behandelt ein FMP-Rate-Limit im Lauf (last_run_error_code) genauso', async () => {
    const rl: RunOutcome = { outcome: 'error', errorCode: 'fmp_rate_limit', errorPublic: 'FMP-Rate-Limit erreicht.', rescued: false }
    const f = fakeDeps({ outcomes: [rl, rl, done] })
    const r = await runTicker('AAPL', f.deps)
    expect(r.kind).toBe('done')
    expect(f.sleeps).toEqual([60_000, 120_000])
  })

  it('wiederholt auch bei Rate-Limit mit behaltener alter Analyse', async () => {
    const rl: RunOutcome = { outcome: 'error_kept', errorCode: 'llm_rate_limit', errorPublic: 'x', rescued: false }
    const f = fakeDeps({ outcomes: [rl, done] })
    expect((await runTicker('AAPL', f.deps)).kind).toBe('done')
  })

  it('bricht waehrend der Pause ab, wenn der Nutzer abbricht', async () => {
    const f = fakeDeps({ requests: [err(429)], cancelAfterSleep: true })
    const r = await runTicker('AAPL', f.deps)
    expect(f.sleeps).toEqual([60_000])
    expect(r).toMatchObject({ kind: 'skipped', reason: 'abgebrochen während der Rate-Limit-Pause' })
  })

  it('wiederholt andere Fehler nicht', async () => {
    const plan: RunOutcome = { outcome: 'error', errorCode: 'fmp_plan', errorPublic: 'FMP-Plan: ...', rescued: false }
    const f = fakeDeps({ outcomes: [plan] })
    expect(await runTicker('PG', f.deps)).toEqual({ ticker: 'PG', kind: 'failed', reason: 'FMP-Plan: ...' })
    expect(f.sleeps).toEqual([])
  })
})

describe('runTicker: Token-Erneuerung', () => {
  it('erneuert bei 401 die Session und wiederholt den Ticker mit neuem Token', async () => {
    const f = fakeDeps({ requests: [err(401), { source: 'processing' }] })
    const r = await runTicker('AAPL', f.deps)
    expect(r.kind).toBe('done')
    expect(f.refreshCalls()).toBe(1)
    expect(f.tokensUsed).toEqual(['t1', 't2'])
  })

  it('pausiert (needs_login), wenn die Erneuerung scheitert', async () => {
    const f = fakeDeps({ requests: [err(401)], refreshed: null })
    expect(await runTicker('AAPL', f.deps)).toEqual({ ticker: 'AAPL', kind: 'needs_login' })
  })

  it('pausiert, wenn auch der neue Token abgelehnt wird', async () => {
    const f = fakeDeps({ requests: [err(401)] })
    expect((await runTicker('AAPL', f.deps)).kind).toBe('needs_login')
    expect(f.refreshCalls()).toBe(1)
  })

  it('pausiert ohne Session', async () => {
    const f = fakeDeps({ token: null })
    expect((await runTicker('AAPL', f.deps)).kind).toBe('needs_login')
  })
})

describe('runTicker: Doppellauf und Ergebnisarten', () => {
  it('wertet 409 (laeuft bereits) als uebersprungen', async () => {
    const f = fakeDeps({ requests: [err(409, 'already_running')] })
    expect(await runTicker('AAPL', f.deps)).toEqual({ ticker: 'AAPL', kind: 'skipped', reason: 'übersprungen (läuft bereits)' })
  })

  it('Cache-Treffer, gerettet, alte Analyse behalten, Zeitueberschreitung', async () => {
    expect((await runTicker('A', fakeDeps({ requests: [{ source: 'cache' }] }).deps)).kind).toBe('cached')
    const rescued = await runTicker('B', fakeDeps({ outcomes: [{ ...done, rescued: true }] }).deps)
    expect(rescued).toEqual({ ticker: 'B', kind: 'done', rescued: true })
    const kept = await runTicker(
      'C',
      fakeDeps({ outcomes: [{ outcome: 'error_kept', errorCode: 'fmp_outage', errorPublic: 'FMP-Störung.', rescued: false }] }).deps,
    )
    expect(kept).toMatchObject({ kind: 'kept_old' })
    expect((kept as { reason: string }).reason).toContain('alte Analyse behalten')
    const timeout = await runTicker('D', fakeDeps({ outcomes: [{ ...done, outcome: 'timeout' }] }).deps)
    expect(timeout.kind).toBe('failed')
  })
})

describe('Drosselung, Zaehler, Liste fuer den zweiten Durchgang', () => {
  it('haelt 30 s Abstand zwischen zwei echten Laeufen', () => {
    expect(DEFAULT_INTERVAL_SECONDS).toBe(30)
    expect(throttleWaitMs(null, 1000, 30)).toBe(0)
    expect(throttleWaitMs(0, 10_000, 30)).toBe(20_000)
    expect(throttleWaitMs(0, 45_000, 30)).toBe(0)
  })

  it('zaehlt erledigt, uebersprungen, fehlgeschlagen, gerettet und alte Analyse behalten', () => {
    const results = [
      { ticker: 'A', kind: 'done' as const, rescued: true },
      { ticker: 'B', kind: 'cached' as const },
      { ticker: 'C', kind: 'skipped' as const },
      { ticker: 'D', kind: 'failed' as const },
      { ticker: 'E', kind: 'kept_old' as const },
    ]
    expect(summarize(results)).toEqual({ done: 1, cached: 1, skipped: 1, failed: 1, rescued: 1, keptOld: 1 })
    expect(unsuccessfulTickers(['A', 'B', 'C', 'D', 'E', 'F'], results)).toEqual(['C', 'D', 'E', 'F'])
  })
})
