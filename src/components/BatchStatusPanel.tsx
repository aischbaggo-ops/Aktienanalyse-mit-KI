import { formatDurationRange } from '../utils/batchEstimate'
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
              ⚠ Ca. {e.fmpCalls} FMP-Abrufe (13 pro Wert) – das übersteigt das Tageslimit von 250 im FMP-Free-Plan.
              Einzelne Analysen können dadurch fehlschlagen.
            </p>
          )}
        </div>
      )}
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

function Running({ batch }: { batch: Batch }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-memo-ink">
          {batch.results.length} von {batch.tickers.length} erledigt ·{' '}
          <span className="font-analyst">{batch.tickers[batch.index]}</span> läuft...
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
    </>
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
          {failed.length > 0 && `, ${failed.length} fehlgeschlagen`}
          {skipped > 0 && `, ${skipped} abgebrochen`}
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

      {failed.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-memo-minusText">
          {failed.map((r) => (
            <li key={r.ticker}>
              {r.ticker}: {r.error}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
