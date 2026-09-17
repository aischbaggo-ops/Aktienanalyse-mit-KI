import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { deleteOwnAccount } from '../lib/webhooks'

export function KontoPage() {
  const { user, session, signOut } = useAuth()
  const navigate = useNavigate()
  const [confirmEmail, setConfirmEmail] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailMatches = confirmEmail.trim().toLowerCase() === (user?.email ?? '').toLowerCase()

  async function handleDelete(e: FormEvent) {
    e.preventDefault()
    if (!emailMatches || !session?.access_token) return
    setError(null)
    setDeleting(true)
    try {
      await deleteOwnAccount(session.access_token)
      await signOut()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Konto konnte nicht gelöscht werden.')
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <div>
        <h1 className="font-analyst text-2xl text-memo-ink">Konto</h1>
        <p className="mt-1.5 text-sm text-memo-muted">{user?.email}</p>
      </div>

      <div className="rounded-lg border border-memo-minus/40 bg-memo-minus/5 p-6">
        <h2 className="font-analyst text-lg text-memo-minusText">Konto löschen</h2>
        <p className="mt-2 text-sm text-memo-ink">
          Diese Aktion ist unwiderruflich. Dein Profil, deine Watchlist und dein Anfrage-Verlauf
          werden vollständig gelöscht, danach wirst du abgemeldet. Bereits erstellte Analyse-
          Ergebnisse (geteilter Cache über alle Nutzer) bleiben bestehen, da sie keine
          personenbezogenen Daten sind — nur der Bezug zu deinem Konto wird entfernt.
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

          {error && <p className="text-sm text-memo-minusText">{error}</p>}

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
