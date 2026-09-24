import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const MIN_LENGTH = 8

// Ziel-Seite fuer Einladungs- UND Passwort-vergessen-Links (redirectTo bei
// inviteUserByEmail bzw. resetPasswordForEmail zeigt hierher). Supabase-js
// erkennt den Token automatisch aus der URL (detectSessionInUrl, Standard-
// Implicit-Flow, siehe lib/supabase.ts) und legt darueber schon eine
// Session an, BEVOR ein Passwort existiert - ohne diese Seite landet man
// dadurch "eingeloggt", kann sich danach aber nie wieder anmelden (siehe
// Bugreport). Deshalb bewusst eine EIGENE, nicht durch ProtectedRoute
// gefuehrte Route: die Session-Existenz allein reicht hier nicht als
// "richtig angemeldet", erst nach dem Setzen eines Passworts geht es zum
// Dashboard weiter.
export function SetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Kurzzeitig nach dem Linkklick ist die Session noch nicht verarbeitet
  // (detectSessionInUrl laeuft asynchron) - loading kommt aus genau diesem
  // Zustand (AuthContext.getSession()).
  useEffect(() => {
    if (!loading && !session && !done) {
      setError('Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.')
    }
  }, [loading, session, done])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_LENGTH) {
      setError(`Das Passwort muss mindestens ${MIN_LENGTH} Zeichen lang sein.`)
      return
    }
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-memo-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-analyst text-2xl text-memo-ink">Passwort setzen</h1>
          <p className="mt-2 text-sm text-memo-muted">
            Vergib ein Passwort für dein Konto, um dich künftig anmelden zu können.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-sm text-memo-muted">Lade...</p>
        ) : !session ? (
          <p className="text-center text-sm text-memo-minusText">{error}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wide text-memo-muted">Neues Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                className="w-full rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-ink"
                placeholder={`Mindestens ${MIN_LENGTH} Zeichen`}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wide text-memo-muted">Passwort bestätigen</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-ink"
              />
            </div>

            {error && <p className="text-sm text-memo-minusText">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-sm bg-memo-ink py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? 'Wird gespeichert...' : 'Passwort setzen und fortfahren'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
