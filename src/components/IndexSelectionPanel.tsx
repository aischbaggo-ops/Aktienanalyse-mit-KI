import { useState } from 'react'
import { TickerSelectionList } from './TickerSelectionList'
import { MAX_BATCH_SIZE } from '../utils/batchEstimate'
import { SUPPORTED_INDICES, TOP_N_OPTIONS } from '../constants/indices'
import { getIndexConstituents, type IndexConstituent } from '../lib/webhooks'

const ALL = 'all'

// Nur aktivierte Indizes im Menue - DAX/MDAX/SDAX sind zurueckgestellt
// (FMP-Plan-Limitierung fuer XETRA-Ticker), siehe Kommentar in
// constants/indices.ts. Das Backend lehnt einen deaktivierten Index
// ohnehin zusaetzlich ab, das hier blendet ihn nur aus dem Menue aus.
const ENABLED_INDICES = SUPPORTED_INDICES.filter((idx) => idx.enabled)

// Auswahl eines Index (oder "Top N" davon) als Alternative zur Freitext-
// Eingabe (siehe BatchSelectionPanel). Laedt die Mitgliederliste ueber
// getIndexConstituents() und zeigt sie in derselben Checkbox-Vorschau.
export function IndexSelectionPanel({
  disabled,
  accessToken,
  onStart,
}: {
  disabled: boolean
  accessToken: string | undefined
  onStart: (tickers: string[]) => Promise<string | null>
}) {
  const [indexId, setIndexId] = useState(ENABLED_INDICES[0].id)
  const [topN, setTopN] = useState<string>(ALL)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState<IndexConstituent[] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  async function handleLoad() {
    if (!accessToken) {
      setError('Nicht angemeldet - bitte Seite neu laden.')
      return
    }
    setLoading(true)
    setError(null)
    setLoaded(null)
    setNote(null)
    try {
      const limit = topN === ALL ? null : Number(topN)
      const res = await getIndexConstituents(indexId, limit, accessToken)
      setLoaded(res.constituents)
      setSelected(new Set(res.constituents.map((c) => c.ticker)))
      if (res.note) setNote(res.note)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  async function handleStart() {
    if (!loaded) return
    const list = loaded.filter((c) => selected.has(c.ticker)).map((c) => c.ticker)
    setError(await onStart(list))
  }

  const overLimit = selected.size > MAX_BATCH_SIZE

  return (
    <section className="rounded-xl border border-memo-line bg-white p-6 shadow-card">
      <h2 className="mb-1 text-base font-semibold text-navy-950">Nach Index auswählen</h2>
      <p className="mb-3 text-xs text-memo-muted">
        "Top N" = die ersten N Werte in der von der Datenquelle gelieferten Reihenfolge, nicht zwingend nach
        Marktkapitalisierung sortiert.
      </p>
      <div className="flex flex-wrap gap-3">
        <select
          value={indexId}
          onChange={(e) => {
            setIndexId(e.target.value)
            setLoaded(null)
          }}
          disabled={disabled}
          className="rounded-lg border border-memo-line bg-white px-3 py-2.5 text-sm text-navy-950 outline-none focus:border-memo-ink disabled:opacity-60"
        >
          {ENABLED_INDICES.map((idx) => (
            <option key={idx.id} value={idx.id}>
              {idx.label}
            </option>
          ))}
        </select>
        <select
          value={topN}
          onChange={(e) => {
            setTopN(e.target.value)
            setLoaded(null)
          }}
          disabled={disabled}
          className="rounded-lg border border-memo-line bg-white px-3 py-2.5 text-sm text-navy-950 outline-none focus:border-memo-ink disabled:opacity-60"
        >
          <option value={ALL}>Alle Mitglieder</option>
          {TOP_N_OPTIONS.map((n) => (
            <option key={n} value={n}>
              Top {n}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleLoad}
          disabled={disabled || loading}
          title={disabled ? 'Ein anderer Batch-Lauf ist gerade aktiv.' : undefined}
          className="rounded-lg border border-memo-line px-4 py-2 text-sm font-medium text-memo-ink transition-colors hover:border-memo-ink disabled:opacity-50"
        >
          {loading ? 'Lädt...' : 'Mitglieder laden'}
        </button>
      </div>

      {disabled && (
        <p className="mt-2 text-xs text-memo-muted">Ein anderer Batch-Lauf ist gerade aktiv - bitte warten oder abbrechen.</p>
      )}
      {note && <p className="mt-3 text-sm text-memo-muted">{note}</p>}

      {loaded && loaded.length > 0 && (
        <div className="mt-4 space-y-3">
          <TickerSelectionList
            items={loaded.map((c) => ({ ticker: c.ticker, name: c.name }))}
            selected={selected}
            onChange={setSelected}
            maxSelectable={MAX_BATCH_SIZE}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={handleStart}
            disabled={disabled || selected.size === 0 || overLimit}
            className="rounded-lg bg-memo-ink px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Analyse starten
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-ampel-red">{error}</p>}
    </section>
  )
}
