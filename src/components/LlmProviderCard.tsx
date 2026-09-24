import { FormEvent, useState } from 'react'
import { saveLlmKey, type LlmProvider } from '../lib/webhooks'

// Ein Block pro LLM-Anbieter in der Konto-Seite: API-Key + Modellname,
// unabhaengig von den anderen drei speicherbar, ohne den Anbieter dadurch
// gleich aktiv zu setzen (siehe KontoPage.tsx fuer den separaten
// Aktiv-Schalter). Gleiches Eingabe-/Anzeige-Muster wie der bisherige
// FMP-/Claude-Key-Block (Key nur "...endet auf 1234" nach dem Speichern).
export function LlmProviderCard({
  provider,
  label,
  modelRequired,
  modelPlaceholder,
  keyLast4,
  savedModel,
  accessToken,
  onSaved,
}: {
  provider: LlmProvider
  label: string
  modelRequired: boolean
  modelPlaceholder: string
  keyLast4: string | null
  savedModel: string | null
  accessToken: string
  onSaved: () => void
}) {
  const [keyInput, setKeyInput] = useState('')
  const [modelInput, setModelInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    if (!keyInput.trim()) return
    if (modelRequired && !modelInput.trim() && !savedModel) {
      setError('Bitte gib einen Modellnamen an (bei diesem Anbieter Pflichtfeld).')
      return
    }
    setSaving(true)
    try {
      await saveLlmKey({ provider, api_key: keyInput.trim(), model: modelInput.trim() || undefined }, accessToken)
      setKeyInput('')
      setModelInput('')
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-md border border-memo-line p-4">
      <h3 className="font-analyst text-sm text-memo-ink">{label}</h3>
      <form onSubmit={handleSave} className="mt-3 space-y-3">
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wide text-memo-muted">
            API-Key
            {keyLast4 && <span className="ml-2 normal-case text-memo-muted">(gespeichert, endet auf {keyLast4})</span>}
          </label>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={keyLast4 ? 'Neuen Key eingeben, um zu ersetzen' : `${label}-API-Key eingeben`}
            className="w-full rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-ink"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wide text-memo-muted">
            Modellname{!modelRequired && ' (optional)'}
            {savedModel && <span className="ml-2 normal-case text-memo-muted">(gespeichert: {savedModel})</span>}
          </label>
          <input
            type="text"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            placeholder={modelPlaceholder}
            className="w-full rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-ink"
          />
        </div>

        {error && <p className="text-xs text-memo-minusText">{error}</p>}
        {saved && <p className="text-xs text-memo-plusText">Gespeichert.</p>}

        <button
          type="submit"
          disabled={saving || !keyInput.trim()}
          className="rounded-sm border border-memo-line px-3 py-1.5 text-xs font-medium text-memo-ink transition-colors hover:border-memo-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
      </form>
    </div>
  )
}
