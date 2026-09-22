import { useState } from 'react'
import { TickerSelectionList } from './TickerSelectionList'
import { MAX_BATCH_SIZE } from '../utils/batchEstimate'
import { parseTickers } from '../utils/tickerParser'

// Eingabe mehrerer Ticker per Freitext. Erkannte Ticker erscheinen als
// Vorschau mit Checkboxen (alle vorausgewaehlt); "Analyse starten" reicht die
// Auswahl an den Batch-Lauf weiter (Bestaetigungsdialog siehe BatchStatusPanel).
export function BatchSelectionPanel({
  disabled,
  onStart,
}: {
  disabled: boolean
  onStart: (tickers: string[]) => Promise<string | null>
}) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<string[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  function handleRecognize() {
    const tickers = parseTickers(text)
    setParsed(tickers)
    setSelected(new Set(tickers))
    setError(null)
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
          disabled={disabled || !text.trim()}
          className="rounded-lg border border-memo-line px-4 py-2 text-sm font-medium text-memo-ink transition-colors hover:border-memo-ink disabled:opacity-50"
        >
          Ticker erkennen
        </button>
        {parsed && parsed.length === 0 && (
          <span className="text-sm text-memo-muted">Keine Ticker erkannt.</span>
        )}
      </div>

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
