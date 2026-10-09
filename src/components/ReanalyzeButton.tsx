import { useState } from 'react'
import { requestAnalyse } from '../lib/webhooks'

// "Neu analysieren" auf der Analyseseite: startet einen frischen Lauf
// (force_refresh, kein 7-Tage-Cache). Den Fortschritt zeigt die Seite ueber
// den vorhandenen Hinweis "Aktualisierung läuft" (last_run_status).
export function ReanalyzeButton({
  ticker,
  accessToken,
  disabled,
  onStarted,
}: {
  ticker: string
  accessToken: string | undefined
  // z.B. waehrend bereits ein Lauf fuer den Ticker laeuft
  disabled?: boolean
  onStarted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    if (!accessToken) return
    setBusy(true)
    setError(null)
    try {
      await requestAnalyse({ ticker, max_age_days: null, force_refresh: true }, accessToken)
      onStarted()
    } catch (err) {
      // z.B. 409 "läuft bereits" oder 429 Stundenlimit - Meldung des Backends zeigen
      setError(err instanceof Error ? err.message : 'Neue Analyse konnte nicht gestartet werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={start}
        disabled={busy || disabled || !accessToken}
        title="Neuer Lauf ohne 7-Tage-Cache (FMP und Claude, ca. 0,04 USD)"
        className="rounded-sm border border-memo-line px-3 py-1.5 text-xs font-medium text-memo-muted transition-colors hover:border-memo-ink hover:text-memo-ink disabled:opacity-50"
      >
        {busy ? 'Wird gestartet...' : 'Neu analysieren'}
      </button>
      {error && <span className="text-xs text-memo-minusText">{error}</span>}
    </span>
  )
}
