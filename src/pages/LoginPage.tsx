import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { validateUsername } from '../utils/userActivity'

export function LoginPage() {
  const { session, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (mode === 'signup') {
      const usernameError = validateUsername(username)
      if (usernameError) {
        setError(usernameError)
        return
      }
    }

    setSubmitting(true)

    if (mode === 'signin') {
      const { error } = await signIn(email, password)
      if (error) setError(error)
    } else {
      const { error } = await signUp(email, password, username)
      if (error) setError(error)
      else setInfo('Konto erstellt. Falls Bestätigung nötig ist, prüfe dein Postfach.')
    }
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-memo-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="font-analyst text-2xl text-memo-ink">Aktienanalyse mit KI</h1>
          <p className="mt-1.5 text-xs uppercase tracking-wide text-memo-muted">Anmelden, um fortzufahren</p>
        </div>

        <div className="mb-6 flex gap-6 border-b border-memo-line2 text-sm">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`-mb-px border-b-2 pb-2 transition-colors ${
              mode === 'signin' ? 'border-memo-ink text-memo-ink' : 'border-transparent text-memo-muted hover:text-memo-ink'
            }`}
          >
            Anmelden
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`-mb-px border-b-2 pb-2 transition-colors ${
              mode === 'signup' ? 'border-memo-ink text-memo-ink' : 'border-transparent text-memo-muted hover:text-memo-ink'
            }`}
          >
            Registrieren
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wide text-memo-muted">Nutzername</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                maxLength={24}
                className="w-full rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-ink"
                placeholder="frei wählbar, kein Klarname nötig"
              />
              <p className="mt-1 text-xs text-memo-muted">
                3–24 Zeichen: Buchstaben, Zahlen, _ und -. Muss eindeutig sein.
              </p>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-memo-muted">E-Mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-ink"
              placeholder="name@beispiel.de"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-memo-muted">Passwort</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-ink"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-memo-minusText">{error}</p>}
          {info && <p className="text-sm text-memo-plusText">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-sm bg-memo-ink py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? 'Bitte warten...' : mode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-memo-muted">Kein Zugang? Wende dich an den Administrator.</p>
      </div>
    </div>
  )
}
