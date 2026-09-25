import { useState } from 'react'
import { TickerSelectionList } from './TickerSelectionList'
import { MAX_BATCH_SIZE } from '../utils/batchEstimate'
import { parseTickers } from '../utils/tickerParser'
import { validateTickers } from '../lib/webhooks'

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

    if (!accessToken || tickers.length === 0) {
      setParsed(tickers)
      setSelected(new Set(tickers))
      return
    }

    setValidating(true)
    try {
      const valid = await validateTickers(tickers, accessToken)
      const validSet = new Set(valid)
      const invalid = tickers.filter((t) => !validSet.has(t))
      const confirmed = tickers.filter((t) => validSet.has(t))
      setParsed(confirmed)
      setSelected(new Set(confirmed))
      setRejected(invalid)
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
