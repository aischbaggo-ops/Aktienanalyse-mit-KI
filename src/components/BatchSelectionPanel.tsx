import { useState } from 'react'
import { TickerSelectionList } from './TickerSelectionList'
import { MAX_BATCH_SIZE } from '../utils/batchEstimate'
import { parseTickers } from '../utils/tickerParser'
import { validateTickers, type TickerKollision } from '../lib/webhooks'
import { mitVorschlaegen, ohneVerdaechtige } from '../lib/tickerKollision'

// Eingabe mehrerer Ticker per Freitext. Erkannte Ticker erscheinen als
// Vorschau mit Checkboxen (alle vorausgewaehlt); "Analyse starten" reicht die
// Auswahl an den Batch-Lauf weiter (Bestaetigungsdialog siehe BatchStatusPanel).
export function BatchSelectionPanel({
  disabled,
  accessToken,
  onStart,
}: {
  disabled: boolean
  accessToken: string | undefined
  onStart: (tickers: string[]) => Promise<string | null>
}) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<string[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])
  const [validationWarning, setValidationWarning] = useState<string | null>(null)
  const [kollisionen, setKollisionen] = useState<TickerKollision[]>([])

  // Der Parser erkennt nur das FORMAT eines Tickers (Grossbuchstaben, 1-5
  // Zeichen, ...), nicht ob er wirklich existiert - "zzzz" oder ein
  // Firmennamen-Fragment wie "WALLETUSD" sehen fuer den Parser wie ein
  // gueltiger Ticker aus. Deshalb zusaetzlich gegen echte FMP-Profildaten
  // pruefen (siehe validate-tickers-Function), BEVOR ein Kandidat in die
  // Auswahl-Liste kommt - reale Muell-Eintraege in "Letzte Analysen" waren
  // sonst die Folge. Schlaegt die Pruefung selbst fehl (z.B. fehlender
  // FMP-Key), wird NICHT blockiert - der Nutzer bekommt nur einen Hinweis
  // und kann ungeprueft fortfahren, statt komplett ausgesperrt zu werden.
  async function handleRecognize() {
    const tickers = parseTickers(text)
    setError(null)
    setRejected([])
    setValidationWarning(null)
    setKollisionen([])

    if (!accessToken || tickers.length === 0) {
      setParsed(tickers)
      setSelected(new Set(tickers))
      return
    }

    setValidating(true)
    try {
      const { valid, kollisionen: koll } = await validateTickers(tickers, accessToken)
      const validSet = new Set(valid)
      const invalid = tickers.filter((t) => !validSet.has(t))
      const confirmed = tickers.filter((t) => validSet.has(t))
      // Verdaechtige Kuerzel bleiben in der Liste, aber NICHT in der
      // Vorauswahl: ein Klick auf "Analyse starten" darf nicht aus Versehen
      // 14 fremde Firmen analysieren (21.10.2026).
      setParsed(confirmed)
      setSelected(new Set(ohneVerdaechtige(confirmed, koll)))
      setRejected(invalid)
      setKollisionen(koll)
    } catch (err) {
      // Fail-open: Pruefung selbst fehlgeschlagen (z.B. kein FMP-Key
      // hinterlegt) - Kandidaten bleiben ungeprueft nutzbar, nur ein
      // Hinweis statt eines harten Blocks.
      setParsed(tickers)
      setSelected(new Set(tickers))
      setValidationWarning(
        err instanceof Error
          ? `Ticker konnten nicht geprüft werden (${err.message}) - Auswahl ungeprüft.`
          : 'Ticker konnten nicht geprüft werden - Auswahl ungeprüft.',
      )
    } finally {
      setValidating(false)
    }
  }

  // Ersetzt die verdaechtigen Kuerzel durch die Schreibweise mit
  // Boersenzusatz (ADS -> ADS.DE). Die Vorschlaege stammen aus
  // index_constituents, sind also bereits bestaetigte Ticker und brauchen
  // keine zweite Pruefung.
  function handleUebernehmen() {
    if (!parsed) return
    const neu = mitVorschlaegen(parsed, kollisionen)
    setParsed(neu)
    setSelected(new Set(neu))
    setKollisionen([])
  }

  async function handleStart() {
    if (!parsed) return
    // Reihenfolge der Eingabe beibehalten.
    const list = parsed.filter((t) => selected.has(t))
    setError(await onStart(list))
  }

  const overLimit = selected.size > MAX_BATCH_SIZE

  return (
    <section className="rounded-xl border border-memo-line bg-white p-6 shadow-card">
      <h2 className="mb-1 text-base font-semibold text-navy-950">Mehrere Aktien analysieren</h2>
      <p className="mb-3 text-xs text-memo-muted">
        Liste einfügen (Markdown-Tabelle, nummerierte Liste oder Ticker mit Komma/Zeilenumbruch). Ticker in
        Großbuchstaben, z. B. <span className="font-analyst">NVDA, BRK.B</span>.
      </p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setParsed(null)
        }}
        rows={5}
        disabled={disabled}
        placeholder={'| 1 | NVDA | Nvidia |\n| 2 | MSFT | Microsoft |'}
        className="w-full rounded-lg border border-memo-line bg-white px-3 py-2 font-mono text-sm text-navy-950 outline-none focus:border-memo-ink disabled:opacity-60"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleRecognize}
          disabled={disabled || validating || !text.trim()}
          className="rounded-lg border border-memo-line px-4 py-2 text-sm font-medium text-memo-ink transition-colors hover:border-memo-ink disabled:opacity-50"
        >
          {validating ? 'Prüfe Ticker...' : 'Ticker erkennen'}
        </button>
        {parsed && parsed.length === 0 && rejected.length === 0 && (
          <span className="text-sm text-memo-muted">Keine Ticker erkannt.</span>
        )}
      </div>
      {disabled && (
        <p className="mt-2 text-xs text-memo-muted">Ein anderer Batch-Lauf ist gerade aktiv - bitte warten oder abbrechen.</p>
      )}

      {validationWarning && <p className="mt-2 text-xs text-ampel-red">{validationWarning}</p>}
      {rejected.length > 0 && (
        <p className="mt-2 text-xs text-memo-muted">
          {rejected.length} von {rejected.length + (parsed?.length ?? 0)} erkannten Einträgen{' '}
          {rejected.length === 1 ? 'konnte' : 'konnten'} nicht als gültiger Ticker bestätigt werden und{' '}
          {rejected.length === 1 ? 'wurde' : 'wurden'} entfernt: {rejected.join(', ')}
        </p>
      )}

      {kollisionen.length > 0 && (
        <div className="mt-3 rounded-lg border border-ampel-yellow bg-amber-50 p-3">
          <p className="text-sm font-medium text-navy-950">
            {kollisionen.length === 1 ? 'Ein Kürzel ist' : `${kollisionen.length} Kürzel sind`} vermutlich
            verwechselt
          </p>
          <p className="mt-1 text-xs text-memo-muted">
            Ohne Börsenzusatz liefert FMP das gleichnamige US-Papier. Diese Einträge sind deshalb{' '}
            <strong>nicht vorausgewählt</strong>.
          </p>
          <ul className="mt-2 space-y-1">
            {kollisionen.map((k) => (
              <li key={k.eingabe} className="text-xs text-memo-ink">
                <span className="font-analyst">{k.eingabe}</span> ={' '}
                {k.gefunden ?? 'unbekannt'}
                {k.waehrung ? ` (${k.waehrung})` : ''} &rarr; gemeint war vermutlich{' '}
                <span className="font-analyst">{k.vorschlag}</span>
                {k.vorschlag_name ? ` - ${k.vorschlag_name}` : ''}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleUebernehmen}
            disabled={disabled}
            className="mt-3 rounded-lg border border-memo-line bg-white px-4 py-2 text-sm font-medium text-memo-ink transition-colors hover:border-memo-ink disabled:opacity-50"
          >
            {kollisionen.length === 1
              ? 'Vorschlag übernehmen'
              : `Alle ${kollisionen.length} Vorschläge übernehmen`}
          </button>
        </div>
      )}

      {parsed && parsed.length > 0 && (
        <div className="mt-4 space-y-3">
          <TickerSelectionList
            items={parsed.map((ticker) => ({ ticker }))}
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
