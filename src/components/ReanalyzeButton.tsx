import { useMemo, useRef, useState } from 'react'
import { requestAnalyse } from '../lib/webhooks'
import { FRESH_RUN_COST_HINT } from '../lib/preferences'
import { createReanalyzeStarter } from '../lib/reanalyze'

// "Neu analysieren" auf der Analyseseite: startet nach Bestaetigung einen
// frischen Lauf (force_refresh, kein 7-Tage-Cache). Den Fortschritt zeigt die
// Seite ueber den vorhandenen Hinweis "Aktualisierung läuft" (last_run_status).
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
  // Aktuelle Werte fuer den einmal erzeugten Starter (Doppelklick-Schutz
  // haengt an genau einer Instanz).
  const latest = useRef({ accessToken, onStarted })
  latest.current = { accessToken, onStarted }

  const start = useMemo(
    () =>
      createReanalyzeStarter({
        ticker,
        confirm: (message) => window.confirm(message),
        request: async () => {
          const token = latest.current.accessToken
          if (!token) throw new Error('Bitte neu anmelden.')
          setBusy(true)
          setError(null)
          try {
            await requestAnalyse({ ticker, max_age_days: null, force_refresh: true }, token)
            latest.current.onStarted()
          } catch (err) {
            // z.B. 409 "läuft bereits" oder 429 Stundenlimit - Meldung des Backends zeigen
            setError(err instanceof Error ? err.message : 'Neue Analyse konnte nicht gestartet werden.')
          } finally {
            setBusy(false)
          }
        },
      }),
    [ticker],
  )

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={() => void start()}
        disabled={busy || disabled || !accessToken}
        title={`Neuer Lauf ohne 7-Tage-Cache (${FRESH_RUN_COST_HINT})`}
        className="rounded-sm border border-memo-line px-3 py-1.5 text-xs font-medium text-memo-muted transition-colors hover:border-memo-ink hover:text-memo-ink disabled:opacity-50"
      >
        {busy ? 'Wird gestartet...' : 'Neu analysieren'}
      </button>
      {error && <span className="text-xs text-memo-minusText">{error}</span>}
    </span>
  )
}
