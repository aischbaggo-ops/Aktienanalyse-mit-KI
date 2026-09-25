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

interface OpenRouterModel {
  id: string
  supported_parameters?: string[]
  context_length?: number
}

let openRouterModelsCache: OpenRouterModel[] | null = null

async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  if (openRouterModelsCache) return openRouterModelsCache
  try {
    const res = await fetch(OPENROUTER_MODELS_URL)
    if (!res.ok) return []
    const data = await res.json()
    const models: OpenRouterModel[] = Array.isArray(data?.data)
      ? data.data
          .filter((m: unknown): m is { id: string } => typeof (m as { id?: unknown })?.id === 'string')
          .map((m: { id: string; supported_parameters?: string[]; context_length?: number }) => ({
            id: m.id,
            supported_parameters: m.supported_parameters,
            context_length: m.context_length,
          }))
      : []
    openRouterModelsCache = models
    return models
  } catch {
    return []
  }
}

// Kuratierungskriterien fuer die STANDARD-Vorschlagsliste im Autocomplete-
// Dropdown - Freitext-Eingabe eines beliebigen anderen Modells bleibt davon
// unabhaengig immer moeglich (siehe offCuratedList-Warnhinweis unten). Live
// ueber OpenRouters /api/v1/models ermittelt (2026-09-25):
// 1. Tool-/Function-Calling-Pflicht (supported_parameters enthaelt "tools") -
//    unsere Analyse-Function braucht den strukturierten Tool-Output zwingend,
//    Modelle ohne diese Faehigkeit sind fuer die Analyse-Aufgabe ungeeignet.
// 2. Nur etablierte grosse Anbieter (Anthropic/OpenAI/Google/Meta/Mistral/
//    xAI/DeepSeek/Qwen) - keine obskuren/kleinen Drittanbieter-Finetunes.
// 3. Keine "mini/nano/lite/tiny/small/haiku"-Tier-Varianten - per WORTGRENZEN-
//    Abgleich (Tokenisierung), NICHT reine Substring-Suche: ein naiver
//    ".includes('mini')" wuerde z.B. "Gemini" faelschlich ausschliessen, weil
//    das Wort "mini" darin als Teilstring vorkommt (live geprueft, echter Bug
//    im ersten Entwurf dieses Filters).
// 4. Keine expliziten Parametergroessen unter 30B im Modellnamen (z.B.
//    "-8b", "-14b") - bei MoE-Namen wie "235b-a22b" zaehlt die ERSTE
//    (Gesamt-)Groesse, nicht die "aXXb"-Aktiv-Parameter-Angabe.
// 5. Mindestens 128K Kontextfenster - trennt in der Praxis sauber aeltere/
//    kleinere Modellgenerationen (z.B. gpt-3.5-turbo, gpt-4, deepseek-r1,
//    mixtral-8x22b) von der aktuellen Flaggschiff-Klasse ab.
// 6. Keine reinen Bild-/Audio-Generierungsvarianten (am Namen erkennbar) -
//    fuer unsere textbasierte, strukturierte Analyse-Ausgabe ungeeignet.
// Ausserdem kein ":batch"/":free"-Suffix - fuer unseren synchronen Analyse-
// Call nicht relevant bzw. typischerweise eingeschraenkter nutzbar.
const CURATED_MAJOR_PROVIDERS = ['anthropic/', 'openai/', 'google/', 'meta-llama/', 'mistralai/', 'x-ai/', 'deepseek/', 'qwen/']
const CURATED_EXCLUDE_TIER_WORDS = new Set(['mini', 'nano', 'lite', 'tiny', 'small', 'haiku'])
const CURATED_MIN_CONTEXT = 128_000
const CURATED_MIN_PARAM_B = 30

function tokenize(id: string): string[] {
  return id.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

function isCuratedOpenRouterModel(m: OpenRouterModel): boolean {
  if (!m.supported_parameters?.includes('tools')) return false
  if (!CURATED_MAJOR_PROVIDERS.some((p) => m.id.startsWith(p))) return false
  if (m.id.endsWith(':batch') || m.id.endsWith(':free')) return false
  const toks = new Set(tokenize(m.id))
  for (const w of CURATED_EXCLUDE_TIER_WORDS) if (toks.has(w)) return false
  if ((m.context_length ?? 0) < CURATED_MIN_CONTEXT) return false
  const bMatch = m.id.match(/(\d+(?:\.\d+)?)b(?!\w)/i)
  if (bMatch && parseFloat(bMatch[1]) < CURATED_MIN_PARAM_B) return false
  if (toks.has('image') && !toks.has('vl')) return false
  return true
}

interface OpenRouterMatch {
  // Exakte Uebereinstimmung (inkl. Praefix) - Eingabe ist bereits gueltig.
  exact: boolean
  // Praefix fehlt vermutlich: der Teil nach dem letzten "/" einer echten
  // Modell-ID stimmt exakt mit der Eingabe ueberein (z.B. Eingabe
  // "gemini-2.5-flash" -> "google/gemini-2.5-flash").
  suffixSuggestion: string | null
  // Bis zu 8 Modell-IDs aus der KURATIERTEN Liste, die die Eingabe als
  // Teilstring enthalten - zum Durchstoebern, falls weder exact noch
  // suffixSuggestion greifen.
  suggestions: string[]
  // Eingabe ist ein technisch gueltiges OpenRouter-Modell (exact-Treffer),
  // aber nicht in der kuratierten Empfehlungsliste - kein Blocker, nur ein
  // dezenter Warnhinweis (Freitext bleibt immer moeglich).
  offCuratedList: boolean
}

function matchOpenRouterModel(input: string, allModels: OpenRouterModel[]): OpenRouterMatch {
  const needle = input.trim().toLowerCase()
  if (!needle) return { exact: false, suffixSuggestion: null, suggestions: [], offCuratedList: false }

  const exactModel = allModels.find((m) => m.id.toLowerCase() === needle)
  const exact = Boolean(exactModel)
  const suffixMatch = allModels.find((m) => m.id.toLowerCase().endsWith(`/${needle}`))
  const suggestions = exact
    ? []
    : allModels
        .filter(isCuratedOpenRouterModel)
        .filter((m) => m.id.toLowerCase().includes(needle))
        .map((m) => m.id)
        .slice(0, 8)

  return {
    exact,
    suffixSuggestion: exact ? null : suffixMatch?.id ?? null,
    suggestions,
    offCuratedList: Boolean(exactModel) && !isCuratedOpenRouterModel(exactModel!),
  }
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
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([])
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
    ((!openRouterMatch.exact && (openRouterMatch.suffixSuggestion !== null || openRouterMatch.suggestions.length > 0)) ||
      openRouterMatch.offCuratedList)

  // "Geaendert" heisst: Feld enthaelt etwas anderes als den bereits
  // gespeicherten Stand. Ein leeres Modellfeld gilt bewusst NICHT als
  // Aenderung (Platzhalter-Text "gespeichert: X" impliziert: leer = alten
  // Wert behalten), ebenso ein leeres Key-Feld ("Neuen Key eingeben, um zu
  // ersetzen" impliziert: leer = bestehenden Key behalten).
  const keyChanged = keyInput.trim() !== ''
  const modelChanged = modelInput.trim() !== '' && modelInput.trim() !== (savedModel ?? '')
  const canSave = keyChanged || modelChanged

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    if (!canSave) return
    if (modelRequired && !modelInput.trim() && !savedModel) {
      setError('Bitte gib einen Modellnamen an (bei diesem Anbieter Pflichtfeld).')
      return
    }
    setSaving(true)
    try {
      await saveLlmKey(
        { provider, api_key: keyChanged ? keyInput.trim() : undefined, model: modelInput.trim() || undefined },
        accessToken,
      )
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
              {openRouterMatch.exact ? (
                <p className="text-memo-muted">
                  Dieses Modell ist nicht in unserer Empfehlungsliste – Ergebnisqualität ggf. eingeschränkt.
                </p>
              ) : openRouterMatch.suffixSuggestion ? (
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
                <p className="text-memo-muted">Kein exakter Treffer in unserer Empfehlungsliste.</p>
              )}
              {!openRouterMatch.exact && openRouterMatch.suggestions.length > 0 && (
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
          disabled={saving || !canSave}
          className="rounded-sm border border-memo-line px-3 py-1.5 text-xs font-medium text-memo-ink transition-colors hover:border-memo-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
      </form>
    </div>
  )
}
