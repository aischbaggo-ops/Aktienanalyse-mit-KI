import type { StockAnalysis } from '../types/database'

// Anzeige- und Auswerteregeln rund um einen Analyse-Lauf (Ticket f). Eine
// gueltige Analyse (status 'done' mit Gesamtscore) bleibt bei einem laufenden
// oder gescheiterten Refresh sichtbar, last_run_status zeigt den Lauf.

type RunRow = Pick<
  StockAnalysis,
  'status' | 'score_total' | 'updated_at' | 'last_run_status' | 'last_run_at' | 'last_run_error_public'
>

// Ein Lauf dauert ca. 20-40 s. Steht last_run_status laenger auf 'running',
// ist der Hintergrundlauf abgebrochen (z. B. Timeout der Edge Function):
// dann weder Hinweis noch Dauer-Polling.
export const STALE_RUN_MS = 15 * 60 * 1000

export function hasValidAnalysis(row: Pick<RunRow, 'status' | 'score_total'> | null | undefined): boolean {
  return !!row && row.status === 'done' && row.score_total != null
}

export function isRefreshRunning(row: RunRow | null | undefined, now = Date.now()): boolean {
  if (!row || row.last_run_status !== 'running' || !row.last_run_at) return false
  return now - new Date(row.last_run_at).getTime() < STALE_RUN_MS
}

// Polling, solange noch kein Endstand bekannt ist: keine Zeile, Erstlauf
// (status pending/running) oder ein laufender Refresh.
export function needsPolling(row: RunRow | null | undefined, now = Date.now()): boolean {
  return !row || row.status === 'pending' || row.status === 'running' || isRefreshRunning(row, now)
}

export function formatAnalysisDate(iso: string): string {
  return new Date(iso).toLocaleString('de-DE')
}

export type RefreshNotice =
  | { kind: 'running'; text: string }
  | { kind: 'failed'; text: string; detail: string | null }

// Hinweis ueber einer angezeigten (gueltigen) Analyse.
export function refreshNotice(row: RunRow | null | undefined, now = Date.now()): RefreshNotice | null {
  if (!row || !hasValidAnalysis(row)) return null
  const date = formatAnalysisDate(row.updated_at)
  if (isRefreshRunning(row, now)) {
    return { kind: 'running', text: `Aktualisierung läuft. Bis dahin wird die Analyse vom ${date} angezeigt.` }
  }
  if (row.last_run_status === 'error') {
    return {
      kind: 'failed',
      text: `Aktualisierung fehlgeschlagen, angezeigt wird die Analyse vom ${date}.`,
      detail: row.last_run_error_public ?? null,
    }
  }
  return null
}

// Ergebnis eines Laufs aus Sicht des Batches.
//   pending     noch nicht fertig
//   done        neuer Lauf erfolgreich
//   error       gescheitert, keine gueltige Analyse
//   error_kept  gescheitert, alte gueltige Analyse bleibt bestehen
export type BatchRunOutcome = 'pending' | 'done' | 'error' | 'error_kept'

export const KEPT_OLD_ANALYSIS_MESSAGE = 'Aktualisierung fehlgeschlagen, alte Analyse behalten'

export function batchRunOutcome(
  row: Pick<RunRow, 'status' | 'score_total' | 'last_run_status'> | null | undefined,
): BatchRunOutcome {
  if (!row) return 'pending'
  switch (row.last_run_status) {
    case 'running':
      return 'pending'
    case 'done':
      return 'done'
    case 'error':
      return hasValidAnalysis(row) ? 'error_kept' : 'error'
  }
  // Zeilen ohne last_run_status (Backend vor Ticket f): wie bisher am status.
  if (row.status === 'done') return 'done'
  if (row.status === 'error') return 'error'
  return 'pending'
}
