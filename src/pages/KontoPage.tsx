import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { deleteOwnAccount, saveApiKeys } from '../lib/webhooks'
import { LlmProviderCard } from '../components/LlmProviderCard'
import type { UserApiKeys, UserLlmKey, LlmProvider } from '../types/database'

const LLM_PROVIDERS: {
  id: LlmProvider
  label: string
  modelRequired: boolean
  modelPlaceholder: string
}[] = [
  { id: 'claude', label: 'Claude', modelRequired: false, modelPlaceholder: 'Standard: claude-sonnet-5' },
  { id: 'openai', label: 'ChatGPT', modelRequired: true, modelPlaceholder: 'z. B. gpt-4o' },
  { id: 'gemini', label: 'Gemini', modelRequired: true, modelPlaceholder: 'z. B. gemini-2.0-flash' },
  { id: 'openrouter', label: 'OpenRouter', modelRequired: true, modelPlaceholder: 'z. B. anthropic/claude-sonnet-5' },
]

export function KontoPage() {
  const { user, session, signOut } = useAuth()
  const navigate = useNavigate()

  // ---------- FMP-Key ----------
  const [keyStatus, setKeyStatus] = useState<Pick<UserApiKeys, 'fmp_key_last4' | 'updated_at'> | null>(null)
  const [fmpKeyInput, setFmpKeyInput] = useState('')
  const [savingFmpKey, setSavingFmpKey] = useState(false)
  const [fmpKeyError, setFmpKeyError] = useState<string | null>(null)
  const [fmpKeySaved, setFmpKeySaved] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase
      .from('user_api_keys')
      .select('fmp_key_last4, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setKeyStatus(data)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleSaveFmpKey(e: FormEvent) {
    e.preventDefault()
    if (!session?.access_token || !fmpKeyInput.trim()) return
    setFmpKeyError(null)
    setFmpKeySaved(false)
    setSavingFmpKey(true)
    try {
      await saveApiKeys({ fmp_api_key: fmpKeyInput.trim() }, session.access_token)
      setFmpKeyInput('')
      setFmpKeySaved(true)
      const { data } = await supabase
        .from('user_api_keys')
        .select('fmp_key_last4, updated_at')
        .eq('user_id', user!.id)
        .maybeSingle()
      setKeyStatus(data)
    } catch (err) {
      setFmpKeyError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSavingFmpKey(false)
    }
  }

  // ---------- LLM-Anbieter ----------
  const [llmKeys, setLlmKeys] = useState<Pick<UserLlmKey, 'provider' | 'key_last4' | 'model'>[]>([])
  const [activeProvider, setActiveProvider] = useState<LlmProvider>('claude')
  const [activeProviderLoading, setActiveProviderLoading] = useState(true)
  const [switchingProvider, setSwitchingProvider] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

  const loadLlmSettings = useCallback(async () => {
    if (!user) return
    const [keysRes, profileRes] = await Promise.all([
      supabase.from('user_llm_keys').select('provider, key_last4, model').eq('user_id', user.id),
      supabase.from('profiles').select('active_llm_provider').eq('id', user.id).maybeSingle(),
    ])
    setLlmKeys(keysRes.data ?? [])
    setActiveProvider((profileRes.data?.active_llm_provider as LlmProvider) ?? 'claude')
    setActiveProviderLoading(false)
  }, [user])

  useEffect(() => {
    void loadLlmSettings()
  }, [loadLlmSettings])

  // Aendert NUR den aktiven Anbieter (gilt fuer alle kuenftigen Analysen,
  // kein Umschalten pro Lauf) - unabhaengig davon, ob/welche Keys bereits
  // hinterlegt sind. profiles hat keine UPDATE-Policy fuer authenticated
  // (schuetzt is_admin), daher ueber die SECURITY DEFINER RPC statt eines
  // direkten Table-Updates - gleiches Muster wie set_my_username.
  async function handleSwitchProvider(provider: LlmProvider) {
    if (!user || switchingProvider) return
    setSwitchError(null)
    setSwitchingProvider(true)
    const { error } = await supabase.rpc('set_active_llm_provider', { p_provider: provider })
    setSwitchingProvider(false)
    if (error) {
      setSwitchError(error.message)
      return
    }
    setActiveProvider(provider)
  }

  // ---------- Konto löschen ----------
  const [confirmEmail, setConfirmEmail] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const emailMatches = confirmEmail.trim().toLowerCase() === (user?.email ?? '').toLowerCase()

  async function handleDelete(e: FormEvent) {
    e.preventDefault()
    if (!emailMatches || !session?.access_token) return
    setDeleteError(null)
    setDeleting(true)
    try {
      await deleteOwnAccount(session.access_token)
      await signOut()
      navigate('/', { replace: true })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Konto konnte nicht gelöscht werden.')
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <div>
        <h1 className="font-analyst text-2xl text-memo-ink">Konto</h1>
        <p className="mt-1.5 text-sm text-memo-muted">{user?.email}</p>
      </div>

      <div className="rounded-lg border border-memo-line bg-white p-6">
        <h2 className="font-analyst text-lg text-memo-ink">FMP-API-Key</h2>
        <p className="mt-2 text-sm text-memo-muted">
          Analysen laufen über deinen eigenen FMP-API-Key, nicht über einen geteilten Key — damit
          bestimmst du selbst Umfang und Kosten. Ohne Key können keine neuen Analysen gestartet
          werden; bereits vorhandene, gecachte Analysen bleiben weiterhin abrufbar.
        </p>
        <p className="mt-2 text-xs text-memo-muted">
          <a
            href="https://financialmodelingprep.com/developer/docs/pricing"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-memo-ink"
          >
            financialmodelingprep.com
          </a>
        </p>

        <form onSubmit={handleSaveFmpKey} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-memo-muted">
              FMP-API-Key
              {keyStatus?.fmp_key_last4 && (
                <span className="ml-2 normal-case text-memo-muted">
                  (gespeichert, endet auf {keyStatus.fmp_key_last4})
                </span>
              )}
            </label>
            <input
              type="password"
              value={fmpKeyInput}
              onChange={(e) => setFmpKeyInput(e.target.value)}
              placeholder={keyStatus?.fmp_key_last4 ? 'Neuen Key eingeben, um zu ersetzen' : 'FMP-API-Key eingeben'}
              className="w-full rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-ink"
            />
          </div>

          {fmpKeyError && <p className="text-sm text-memo-minusText">{fmpKeyError}</p>}
          {fmpKeySaved && <p className="text-sm text-memo-plusText">Gespeichert.</p>}

          <button
            type="submit"
            disabled={savingFmpKey || !fmpKeyInput.trim()}
            className="rounded-sm bg-memo-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {savingFmpKey ? 'Speichern...' : 'Speichern'}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-memo-line bg-white p-6">
        <h2 className="font-analyst text-lg text-memo-ink">KI-Anbieter</h2>
        <p className="mt-2 text-sm text-memo-muted">
          Claude ist der Standard-Anbieter. Du kannst zusätzlich eigene Keys für ChatGPT, Gemini
          oder OpenRouter hinterlegen und einen davon als aktiv festlegen — der aktive Anbieter
          gilt dann für alle künftigen Analysen, bis du ihn wieder änderst (kein Umschalten pro
          Analyse). Ein Anbieter kann gespeichert werden, ohne ihn sofort aktiv zu setzen.
        </p>

        <div className="mt-5">
          <label className="mb-2 block text-xs uppercase tracking-wide text-memo-muted">Aktiver Anbieter</label>
          <div className="flex flex-wrap gap-2">
            {LLM_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSwitchProvider(p.id)}
                disabled={activeProviderLoading || switchingProvider}
                className={`rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  activeProvider === p.id
                    ? 'border-memo-ink bg-memo-ink text-white'
                    : 'border-memo-line text-memo-ink hover:border-memo-ink'
                }`}
              >
                {p.label}
                {p.id === 'claude' && ' (Standard)'}
              </button>
            ))}
          </div>
          {switchError && <p className="mt-2 text-xs text-memo-minusText">{switchError}</p>}
        </div>

        <div className="mt-5 space-y-4">
          {LLM_PROVIDERS.map((p) => {
            const saved = llmKeys.find((k) => k.provider === p.id)
            return (
              <LlmProviderCard
                key={p.id}
                provider={p.id}
                label={p.label}
                modelRequired={p.modelRequired}
                modelPlaceholder={p.modelPlaceholder}
                keyLast4={saved?.key_last4 ?? null}
                savedModel={saved?.model ?? null}
                accessToken={session?.access_token ?? ''}
                onSaved={loadLlmSettings}
              />
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-memo-minus/40 bg-memo-minus/5 p-6">
        <h2 className="font-analyst text-lg text-memo-minusText">Konto löschen</h2>
        <p className="mt-2 text-sm text-memo-ink">
          Diese Aktion ist unwiderruflich. Dein Profil, deine Watchlist, deine API-Keys und dein
          Anfrage-Verlauf werden vollständig gelöscht, danach wirst du abgemeldet. Bereits
          erstellte Analyse-Ergebnisse (geteilter Cache über alle Nutzer) bleiben bestehen, da sie
          keine personenbezogenen Daten sind — nur der Bezug zu deinem Konto wird entfernt.
        </p>

        <form onSubmit={handleDelete} className="mt-5 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-memo-muted">
              Zur Bestätigung deine E-Mail-Adresse eintippen: <span className="text-memo-ink">{user?.email}</span>
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user?.email ?? ''}
              className="w-full rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-minus"
            />
          </div>

          {deleteError && <p className="text-sm text-memo-minusText">{deleteError}</p>}

          <button
            type="submit"
            disabled={!emailMatches || deleting}
            className="rounded-sm bg-memo-minus px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? 'Konto wird gelöscht...' : 'Konto endgültig löschen'}
          </button>
        </form>
      </div>
    </div>
  )
}
