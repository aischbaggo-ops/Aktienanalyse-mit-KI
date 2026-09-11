import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { session, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    setSubmitting(true)

    if (mode === 'signin') {
      const { error } = await signIn(email, password)
      if (error) setError(error)
    } else {
      const { error } = await signUp(email, password)
      if (error) setError(error)
      else setInfo('Konto erstellt. Falls Bestätigung nötig ist, prüfe dein Postfach.')
    }
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-9 flex-shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-gold-500 px-4 text-sm font-bold text-black">
            AI Schbaggo
          </span>
          <h1 className="text-xl font-semibold text-navy-950">Aktienanalyse mit KI</h1>
          <p className="text-sm text-navy-600">Melde dich an, um fortzufahren</p>
        </div>

        <div className="rounded-xl border border-navy-200 bg-white p-6 shadow-card">
          <div className="mb-5 flex rounded-lg border border-navy-200 p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                mode === 'signin' ? 'bg-navy-700 text-gold-400' : 'text-navy-500'
              }`}
            >
              Anmelden
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                mode === 'signup' ? 'bg-navy-700 text-gold-400' : 'text-navy-500'
              }`}
            >
              Registrieren
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-600">E-Mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-navy-200 bg-navy-50 px-3 py-2.5 text-sm text-navy-950 outline-none focus:border-gold-500"
                placeholder="name@beispiel.de"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-600">Passwort</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-navy-200 bg-navy-50 px-3 py-2.5 text-sm text-navy-950 outline-none focus:border-gold-500"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-ampel-red">{error}</p>}
            {info && <p className="text-sm text-ampel-green">{info}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-gold-500 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-400 disabled:opacity-60"
            >
              {submitting ? 'Bitte warten...' : mode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
