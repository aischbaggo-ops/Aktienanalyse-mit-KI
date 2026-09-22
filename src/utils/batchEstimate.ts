// Obergrenze pro Batch-Lauf (Kosten-/Zeitschutz, Vorgabe des Nutzers).
export const MAX_BATCH_SIZE = 100

// Grobe Erfahrungswerte: eine Analyse dauert laut UI ca. 20-40 s.
const SECONDS_PER_ANALYSIS_MIN = 20
const SECONDS_PER_ANALYSIS_MAX = 40

// Pro neuer Analyse ruft die analyse-Function 13 FMP-Endpoints ab.
export const FMP_CALLS_PER_ANALYSIS = 13
// Tageslimit im FMP-Free-Plan. Nur fuer einen Warnhinweis, keine Blockade.
export const FMP_FREE_DAILY_LIMIT = 250

export interface BatchEstimate {
  total: number
  cached: number
  uncached: number
  minSeconds: number
  maxSeconds: number
  // null, wenn keine historischen Kosten vorliegen
  costUsd: number | null
  fmpCalls: number
  exceedsFmpFreeLimit: boolean
}

// Gecachte Ticker kosten weder Zeit noch API-Kontingent - nur die
// nicht gecachten werden in die Schaetzung einbezogen.
export function estimateBatch(total: number, cached: number, avgCostUsd: number | null): BatchEstimate {
  const uncached = Math.max(0, total - cached)
  const fmpCalls = uncached * FMP_CALLS_PER_ANALYSIS
  return {
    total,
    cached,
    uncached,
    minSeconds: uncached * SECONDS_PER_ANALYSIS_MIN,
    maxSeconds: uncached * SECONDS_PER_ANALYSIS_MAX,
    costUsd: avgCostUsd != null ? avgCostUsd * uncached : null,
    fmpCalls,
    exceedsFmpFreeLimit: fmpCalls > FMP_FREE_DAILY_LIMIT,
  }
}

export function formatDurationRange(minSeconds: number, maxSeconds: number): string {
  const toMinutes = (s: number) => Math.max(1, Math.round(s / 60))
  const lo = toMinutes(minSeconds)
  const hi = toMinutes(maxSeconds)
  return lo === hi ? `ca. ${lo} Min.` : `ca. ${lo}–${hi} Min.`
}
