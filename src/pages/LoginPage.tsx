import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AccessRequestForm } from '../components/AccessRequestForm'

export function LoginPage() {
  const { session, signIn } = useAuth()
  const [mode, setMode] = useState<'signin' | 'request'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-memo-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="font-analyst text-2xl text-memo-ink">Aktienanalyse mit KI</h1>
          <p className="mt-1.5 text-xs uppercase tracking-wide text-memo-muted">
            {mode === 'signin' ? 'Anmelden, um fortzufahren' : 'Zugang anfragen'}
          </p>
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
            onClick={() => setMode('request')}
            className={`-mb-px border-b-2 pb-2 transition-colors ${
              mode === 'request' ? 'border-memo-ink text-memo-ink' : 'border-transparent text-memo-muted hover:text-memo-ink'
            }`}
          >
            Zugang anfragen
          </button>
        </div>

        {mode === 'signin' ? (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-sm bg-memo-ink py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? 'Bitte warten...' : 'Anmelden'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-memo-muted">
              Kein Zugang?{' '}
              <button
                type="button"
                onClick={() => setMode('request')}
                className="underline hover:text-memo-ink"
              >
                Zugang anfragen
              </button>
            </p>
          </>
        ) : (
          <AccessRequestForm />
        )}
      </div>
    </div>
  )
}
