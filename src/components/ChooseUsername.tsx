import { FormEvent, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { validateUsername } from '../utils/userActivity'

// Blockierender Schritt fuer Bestandskonten ohne Nutzername: erscheint einmal
// nach dem Login, bevor die App weiter genutzt werden kann. Der Name ist
// danach nicht mehr aenderbar (set_my_username setzt nur bei username IS NULL).
export function ChooseUsername() {
  const { signOut, refreshProfile } = useAuth()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const validationError = validateUsername(name)
    if (validationError) {
      setError(validationError)
      return
    }
    setSubmitting(true)
    const { error: rpcError } = await supabase.rpc('set_my_username', { p_username: name.trim() })
    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      return
    }
    await refreshProfile()
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-memo-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-analyst text-2xl text-memo-ink">Nutzernamen wählen</h1>
          <p className="mt-2 text-sm text-memo-muted">
            Bitte wähle einen Nutzernamen, bevor es weitergeht. Er ist frei wählbar (kein Klarname nötig) und
            kann später nicht mehr geändert werden.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-memo-muted">Nutzername</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="username"
              maxLength={24}
              autoFocus
              className="w-full rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-ink"
              placeholder="z. B. aktien_fuchs"
            />
            <p className="mt-1 text-xs text-memo-muted">3–24 Zeichen: Buchstaben, Zahlen, _ und -. Muss eindeutig sein.</p>
          </div>

          {error && <p className="text-sm text-memo-minusText">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-sm bg-memo-ink py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? 'Bitte warten...' : 'Speichern und weiter'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 block w-full text-center text-xs text-memo-muted hover:text-memo-ink"
        >
          Abmelden
        </button>
      </div>
    </div>
  )
}
