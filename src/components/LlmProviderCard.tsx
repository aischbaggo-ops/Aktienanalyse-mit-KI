import { FormEvent, useEffect, useMemo, useState } from 'react'
import { saveLlmKey, type LlmProvider } from '../lib/webhooks'

// OpenRouter-Modell-IDs brauchen zwingend ein Anbieter-Praefix
// ("google/gemini-2.5-flash", nicht "gemini-2.5-flash") - ein leicht zu
// uebersehendes Detail, das real zu einem 404 ("No endpoints found for
// ...") gefuehrt hat. Die oeffentliche, unauthentifizierte Modell-Liste
// (kein API-Key noetig, live geprueft) erlaubt eine einfache Autocomplete/
// Korrektur-Vorschlag-Loesung, ohne einen eigenen Backend-Endpoint - siehe
// buildOpenRouterSuggestions() unten fuer die Zuordnungslogik. Bewusst nur
// fuer OpenRouter: OpenAI/Gemini haben kein Praefix-Problem, und deren
// Modell-Listen-Endpoints brauchen den (hier noch gar nicht gespeicherten)
// eigenen Key des Nutzers - andere Abwaegung, nicht Teil dieses Fixes.
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'
let openRouterModelsCache: string[] | null = null

async function fetchOpenRouterModels(): Promise<string[]> {
  if (openRouterModelsCache) return openRouterModelsCache
  try {
    const res = await fetch(OPENROUTER_MODELS_URL)
    if (!res.ok) return []
    const data = await res.json()
    const ids = Array.isArray(data?.data) ? data.data.map((m: { id?: string }) => m.id).filter((id: unknown): id is string => typeof id === 'string') : []
    openRouterModelsCache = ids
    return ids
  } catch {
    return []
  }
}

interface OpenRouterMatch {
  // Exakte Uebereinstimmung (inkl. Praefix) - Eingabe ist bereits gueltig.
  exact: boolean
  // Praefix fehlt vermutlich: der Teil nach dem letzten "/" einer echten
  // Modell-ID stimmt exakt mit der Eingabe ueberein (z.B. Eingabe
  // "gemini-2.5-flash" -> "google/gemini-2.5-flash").
  suffixSuggestion: string | null
  // Bis zu 8 Modell-IDs, die die Eingabe als Teilstring enthalten - zum
  // Durchstoebern, falls weder exact noch suffixSuggestion greifen.
  suggestions: string[]
}

function matchOpenRouterModel(input: string, allModels: string[]): OpenRouterMatch {
  const needle = input.trim().toLowerCase()
  if (!needle) return { exact: false, suffixSuggestion: null, suggestions: [] }

  const exact = allModels.some((id) => id.toLowerCase() === needle)
  const suffixMatch = allModels.find((id) => id.toLowerCase().endsWith(`/${needle}`))
  const suggestions = exact
    ? []
    : allModels.filter((id) => id.toLowerCase().includes(needle)).slice(0, 8)

  return { exact, suffixSuggestion: exact ? null : suffixMatch ?? null, suggestions }
}

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

  const isOpenRouter = provider === 'openrouter'
  const [openRouterModels, setOpenRouterModels] = useState<string[]>([])
  const [modelFieldFocused, setModelFieldFocused] = useState(false)

  useEffect(() => {
    if (!isOpenRouter) return
    fetchOpenRouterModels().then(setOpenRouterModels)
  }, [isOpenRouter])

  const openRouterMatch = useMemo(
    () => (isOpenRouter ? matchOpenRouterModel(modelInput, openRouterModels) : null),
    [isOpenRouter, modelInput, openRouterModels],
  )
  const showOpenRouterHint =
    isOpenRouter &&
    modelFieldFocused &&
    modelInput.trim() !== '' &&
    openRouterMatch !== null &&
    !openRouterMatch.exact &&
    (openRouterMatch.suffixSuggestion !== null || openRouterMatch.suggestions.length > 0)

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
        <div className="relative">
          <label className="mb-1.5 block text-xs uppercase tracking-wide text-memo-muted">
            Modellname{!modelRequired && ' (optional)'}
            {savedModel && <span className="ml-2 normal-case text-memo-muted">(gespeichert: {savedModel})</span>}
          </label>
          <input
            type="text"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            onFocus={() => setModelFieldFocused(true)}
            onBlur={() => setTimeout(() => setModelFieldFocused(false), 150)}
            placeholder={modelPlaceholder}
            className="w-full rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-ink"
          />
          {showOpenRouterHint && openRouterMatch && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-sm border border-memo-line bg-white p-2.5 text-xs shadow-lg">
              {openRouterMatch.suffixSuggestion ? (
                <p className="text-memo-minusText">
                  Kein exakter Treffer - OpenRouter-Modell-IDs brauchen ein Anbieter-Präfix. Meintest du:{' '}
                  <button
                    type="button"
                    onClick={() => setModelInput(openRouterMatch.suffixSuggestion!)}
                    className="font-semibold underline hover:no-underline"
                  >
                    {openRouterMatch.suffixSuggestion}
                  </button>
                  ?
                </p>
              ) : (
                <p className="text-memo-muted">Kein exakter Treffer in der OpenRouter-Modell-Liste.</p>
              )}
              {openRouterMatch.suggestions.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {openRouterMatch.suggestions.map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => setModelInput(id)}
                        className="text-memo-ink hover:underline"
                      >
                        {id}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
