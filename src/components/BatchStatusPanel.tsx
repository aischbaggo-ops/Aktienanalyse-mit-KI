import { useEffect, useState } from 'react'
import { FMP_CALLS_PER_ANALYSIS, formatDurationRange } from '../utils/batchEstimate'
import type { BatchSummary } from '../lib/batchRunner'
import { AnalysisResultsList, type AnalysisResultRow } from './AnalysisResultsList'
import type { useBatchAnalysis } from '../hooks/useBatchAnalysis'

type Batch = ReturnType<typeof useBatchAnalysis>

// Bestaetigungsdialog, Fortschritt und Ergebnisliste eines Batch-Laufs.
export function BatchStatusPanel({
  batch,
  userId,
  watchlistTickers,
  onWatchlistChanged,
  onOpenTicker,
}: {
  batch: Batch
  userId: string | undefined
  watchlistTickers: Set<string>
  onWatchlistChanged: () => void
  onOpenTicker: (ticker: string) => void
}) {
  if (batch.phase === 'idle') return null

  return (
    <div className="rounded-lg border border-memo-line bg-white p-4">
      {batch.phase === 'confirming' && <Confirm batch={batch} />}
      {batch.phase === 'running' && <Running batch={batch} />}
      {batch.phase === 'paused' && <Paused batch={batch} />}
      {batch.phase === 'done' && (
        <Done
          batch={batch}
          userId={userId}
          watchlistTickers={watchlistTickers}
          onWatchlistChanged={onWatchlistChanged}
          onOpenTicker={onOpenTicker}
        />
      )}
    </div>
  )
}

function Confirm({ batch }: { batch: Batch }) {
  const e = batch.estimate
  return (
    <>
      {batch.estimating || !e ? (
        <p className="text-sm text-memo-ink">Schätzung wird berechnet...</p>
      ) : (
        <div className="space-y-1 text-sm text-memo-ink">
          <p>
            <strong>{e.total}</strong> Werte ausgewählt
            {!batch.forceRefresh && e.cached > 0 && (
              <>
                , davon <strong>{e.cached}</strong> mit aktueller Analyse im 7-Tage-Cache (werden nicht neu berechnet)
              </>
            )}
            .
          </p>
          {batch.forceRefresh && (
            <p className="text-memo-minusText">
              Der Watchlist-Batch erzwingt frische Läufe: Alle ausgewählten Werte werden neu berechnet, auch wenn
              eine aktuelle Analyse im 7-Tage-Cache liegt.
            </p>
          )}
          {e.uncached > 0 ? (
            <p>
              Neu zu analysieren: <strong>{e.uncached}</strong> · Dauer {formatDurationRange(e.minSeconds, e.maxSeconds)}{' '}
              (ca. 20–40 s pro Wert)
              {e.costUsd != null
                ? ` · geschätzte Claude-Kosten ca. $${e.costUsd.toFixed(2)} (Ø aus den letzten 20 Läufen)`
                : ' · keine Kostenschätzung verfügbar (noch keine historischen Daten)'}
              . Das kostet echtes Geld.
            </p>
          ) : (
            <p>Alle Werte sind bereits im Cache – es entstehen keine Kosten.</p>
          )}
          {e.exceedsFmpFreeLimit && (
            <p className="text-memo-minusText">
              ⚠ Ca. {e.fmpCalls} FMP-Abrufe ({FMP_CALLS_PER_ANALYSIS} pro Wert) – das übersteigt das Tageslimit von 250 im FMP-Free-Plan.
              Einzelne Analysen können dadurch fehlschlagen.
            </p>
          )}
        </div>
      )}
      <div className="mt-3 space-y-2 text-xs text-memo-muted">
        <label className="flex flex-wrap items-center gap-2">
          Abstand zwischen zwei neuen Analysen
          <input
            type="number"
            min={0}
            max={600}
            value={batch.intervalSeconds}
            onChange={(ev) => batch.setIntervalSeconds(Math.max(0, Math.min(600, Number(ev.target.value) || 0)))}
            className="w-16 rounded-sm border border-memo-line px-1.5 py-0.5 text-memo-ink"
          />
          Sekunden (Standard 30 s hält das Limit von 150 Analysen pro Stunde ein; Cache-Treffer ohne Pause)
        </label>
        <p>{STAY_AWAKE_HINT}</p>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={batch.start}
          disabled={batch.estimating}
          className="rounded-md bg-memo-ink px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Ja, starten
        </button>
        <button
          onClick={batch.reset}
          className="rounded-md border border-memo-line px-4 py-1.5 text-xs font-medium text-memo-muted transition-colors hover:border-memo-ink hover:text-memo-ink"
        >
          Abbrechen
        </button>
      </div>
    </>
  )
}

const STAY_AWAKE_HINT =
  'Während des Laufs diesen Tab offen lassen und den Rechner wach halten (kein Ruhezustand). Ein Wechsel auf eine andere Seite der App bricht die Warteschlange ab.'

function Counters({ summary }: { summary: BatchSummary }) {
  const items: [string, number][] = [
    ['erledigt', summary.done + summary.cached],
    ['davon aus Cache', summary.cached],
    ['übersprungen', summary.skipped],
    ['fehlgeschlagen', summary.failed],
    ['gerettet (Fangnetz)', summary.rescued],
    ['alte Analyse behalten', summary.keptOld],
  ]
  return (
    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-memo-muted">
      {items.map(([label, n]) => (
        <span key={label}>
          {label}: <strong className="text-memo-ink">{n}</strong>
        </span>
      ))}
    </p>
  )
}

// Sekundengenauer Countdown fuer Pausen.
function useSecondsLeft(until: number | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!until) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [until])
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0
}

function Running({ batch }: { batch: Batch }) {
  const secondsLeft = useSecondsLeft(batch.wait?.until)
  const current = batch.tickers[batch.index]
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-memo-ink">
          {batch.results.length} von {batch.tickers.length} bearbeitet ·{' '}
          <span className="font-analyst">{current}</span>{' '}
          {batch.wait?.reason === 'rate_limit'
            ? `– Rate-Limit, nächster Versuch in ${secondsLeft} s`
            : batch.wait?.reason === 'throttle'
              ? `– startet in ${secondsLeft} s`
              : 'läuft...'}
        </p>
        <button onClick={batch.cancel} className="whitespace-nowrap text-xs text-memo-muted hover:text-memo-ink">
          Abbrechen
        </button>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-memo-paper">
        <div
          className="h-full bg-memo-ink transition-all duration-500"
          style={{ width: `${(batch.results.length / batch.tickers.length) * 100}%` }}
        />
      </div>
      <Counters summary={batch.summary} />
      <p className="mt-2 text-xs text-memo-muted">
        {STAY_AWAKE_HINT}
        {batch.wakeLockActive && ' Die Bildschirmsperre ist für diesen Tab ausgesetzt.'}
      </p>
    </>
  )
}

function Paused({ batch }: { batch: Batch }) {
  return (
    <>
      <p className="text-sm text-memo-minusText">
        Batch pausiert: Die Anmeldung ist abgelaufen. Bitte neu anmelden (am besten in einem neuen Tab, damit
        dieser Lauf erhalten bleibt) und dann hier fortsetzen.
      </p>
      <Counters summary={batch.summary} />
      <div className="mt-3 flex gap-2">
        <button
          onClick={batch.resume}
          className="rounded-md bg-memo-ink px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          Fortsetzen ({batch.tickers.length - batch.results.length} offen)
        </button>
        <button
          onClick={batch.cancel}
          className="rounded-md border border-memo-line px-4 py-1.5 text-xs font-medium text-memo-muted transition-colors hover:border-memo-ink hover:text-memo-ink"
        >
          Beenden
        </button>
      </div>
    </>
  )
}

function RetryList({ tickers }: { tickers: string[] }) {
  const [copied, setCopied] = useState(false)
  const text = tickers.join(', ')
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="mt-3 space-y-1">
      <p className="text-xs text-memo-muted">
        Nicht erfolgreich ({tickers.length}) – für einen zweiten Durchgang kopieren und erneut einfügen
        (fertige Werte überspringt der 7-Tage-Cache):
      </p>
      <textarea
        readOnly
        value={text}
        rows={Math.min(6, Math.max(2, Math.ceil(text.length / 90)))}
        className="w-full rounded-sm border border-memo-line p-2 font-mono text-xs text-memo-ink"
        onFocus={(ev) => ev.currentTarget.select()}
      />
      <button onClick={copy} className="text-xs font-medium text-memo-ink underline hover:opacity-70">
        {copied ? 'Kopiert' : 'Liste kopieren'}
      </button>
    </div>
  )
}

function Done({
  batch,
  userId,
  watchlistTickers,
  onWatchlistChanged,
  onOpenTicker,
}: {
  batch: Batch
  userId: string | undefined
  watchlistTickers: Set<string>
  onWatchlistChanged: () => void
  onOpenTicker: (ticker: string) => void
}) {
  const ok = batch.results
    .filter((r) => r.success)
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
  const failed = batch.results.filter((r) => !r.success)
  const skipped = batch.tickers.length - batch.results.length

  const rows: AnalysisResultRow[] = ok.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    image: r.image,
    score: r.score ?? null,
    analysisId: r.analysisId,
    cached: r.cached,
  }))

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-memo-ink">
          Batch abgeschlossen: {ok.length} erfolgreich
          {failed.length > 0 && `, ${failed.length} nicht erfolgreich`}
          {skipped > 0 && `, ${skipped} nicht gestartet`}
        </p>
        <button onClick={batch.reset} className="whitespace-nowrap text-xs text-memo-muted hover:text-memo-ink">
          Schließen
        </button>
      </div>

      {ok.length > 0 && (
        <div className="mt-3">
          <AnalysisResultsList
            rows={rows}
            watchlistTickers={watchlistTickers}
            userId={userId}
            onWatchlistChanged={onWatchlistChanged}
            onOpenTicker={onOpenTicker}
            heading="Ergebnisse nach Score"
          />
        </div>
      )}

      <Counters summary={batch.summary} />

      {failed.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-memo-minusText">
          {failed.map((r) => (
            <li key={r.ticker}>
              {r.ticker}: {r.error}
            </li>
          ))}
        </ul>
      )}

      {batch.notSuccessful.length > 0 && <RetryList tickers={batch.notSuccessful} />}
    </>
  )
}
