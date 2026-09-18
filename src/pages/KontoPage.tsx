import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { deleteOwnAccount, saveApiKeys } from '../lib/webhooks'
import type { UserApiKeys } from '../types/database'

export function KontoPage() {
  const { user, session, signOut } = useAuth()
  const navigate = useNavigate()

  // ---------- API-Keys ----------
  const [keyStatus, setKeyStatus] = useState<Pick<
    UserApiKeys,
    'fmp_key_last4' | 'claude_key_last4' | 'updated_at'
  > | null>(null)
  const [fmpKeyInput, setFmpKeyInput] = useState('')
  const [claudeKeyInput, setClaudeKeyInput] = useState('')
  const [savingKeys, setSavingKeys] = useState(false)
  const [keysError, setKeysError] = useState<string | null>(null)
  const [keysSaved, setKeysSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase
      .from('user_api_keys')
      .select('fmp_key_last4, claude_key_last4, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setKeyStatus(data)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleSaveKeys(e: FormEvent) {
    e.preventDefault()
    if (!session?.access_token) return
    if (!fmpKeyInput.trim() && !claudeKeyInput.trim()) return
    setKeysError(null)
    setKeysSaved(false)
    setSavingKeys(true)
    try {
      await saveApiKeys(
        {
          fmp_api_key: fmpKeyInput.trim() || undefined,
          claude_api_key: claudeKeyInput.trim() || undefined,
        },
        session.access_token,
      )
      setFmpKeyInput('')
      setClaudeKeyInput('')
      setKeysSaved(true)
      const { data } = await supabase
        .from('user_api_keys')
        .select('fmp_key_last4, claude_key_last4, updated_at')
        .eq('user_id', user!.id)
        .maybeSingle()
      setKeyStatus(data)
    } catch (err) {
      setKeysError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSavingKeys(false)
    }
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
        <h2 className="font-analyst text-lg text-memo-ink">Eigene API-Keys</h2>
        <p className="mt-2 text-sm text-memo-muted">
          Analysen laufen über deinen eigenen FMP- und Claude-API-Key, nicht über einen geteilten
          Key — damit bestimmst du selbst Umfang und Kosten. Ohne beide Keys können keine neuen
          Analysen gestartet werden; bereits vorhandene, gecachte Analysen bleiben weiterhin
          abrufbar.
        </p>
        <p className="mt-2 text-xs text-memo-muted">
          FMP-Key:{' '}
          <a
            href="https://financialmodelingprep.com/developer/docs/pricing"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-memo-ink"
          >
            financialmodelingprep.com
          </a>{' '}
          · Claude-Key:{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-memo-ink"
          >
            console.anthropic.com
          </a>
        </p>

        <form onSubmit={handleSaveKeys} className="mt-5 space-y-4">
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

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-memo-muted">
              Claude-API-Key
              {keyStatus?.claude_key_last4 && (
                <span className="ml-2 normal-case text-memo-muted">
                  (gespeichert, endet auf {keyStatus.claude_key_last4})
                </span>
              )}
            </label>
            <input
              type="password"
              value={claudeKeyInput}
              onChange={(e) => setClaudeKeyInput(e.target.value)}
              placeholder={keyStatus?.claude_key_last4 ? 'Neuen Key eingeben, um zu ersetzen' : 'Claude-API-Key eingeben'}
              className="w-full rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-ink"
            />
          </div>

          {keysError && <p className="text-sm text-memo-minusText">{keysError}</p>}
          {keysSaved && <p className="text-sm text-memo-plusText">Gespeichert.</p>}

          <button
            type="submit"
            disabled={savingKeys || (!fmpKeyInput.trim() && !claudeKeyInput.trim())}
            className="rounded-sm bg-memo-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {savingKeys ? 'Speichern...' : 'Speichern'}
          </button>
        </form>
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
