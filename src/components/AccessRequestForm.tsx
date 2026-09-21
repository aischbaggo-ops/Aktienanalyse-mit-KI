import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ACCESS_REQUEST_LIMITS, buildAccessRequest } from '../utils/accessRequest'

const inputCls =
  'w-full rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-ink'
const labelCls = 'mb-1.5 block text-xs uppercase tracking-wide text-memo-muted'

// Zugangsanfrage fuer Interessenten ohne Konto. Die Registrierung ist
// serverseitig gesperrt; der Admin legt Accounts manuell an. Schreibt per
// Insert (auch ohne Login erlaubt) in access_requests - es entsteht kein Login.
export function AccessRequestForm() {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const built = buildAccessRequest({ name, contact, message })
    if ('error' in built) {
      setError(built.error)
      return
    }

    setSubmitting(true)
    const { error: insertError } = await supabase.from('access_requests').insert(built.payload)
    setSubmitting(false)

    if (insertError) {
      setError('Die Anfrage konnte nicht gesendet werden. Bitte versuche es später erneut.')
      return
    }
    setName('')
    setContact('')
    setMessage('')
    setSent(true)
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-memo-plusText">Danke, du hörst von mir.</p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-xs text-memo-muted underline hover:text-memo-ink"
        >
          Weitere Anfrage senden
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-memo-muted">
        Der Zugang wird manuell vergeben. Schreib kurz, wie ich dich erreiche, dann melde ich mich bei dir.
      </p>
      <div>
        <label className={labelCls}>Name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={ACCESS_REQUEST_LIMITS.name}
          className={inputCls}
          placeholder="Wie soll ich dich ansprechen?"
        />
      </div>
      <div>
        <label className={labelCls}>Kontaktweg</label>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={ACCESS_REQUEST_LIMITS.contact}
          className={inputCls}
          placeholder="E-Mail, Telefon oder anderer Weg"
        />
      </div>
      <div>
        <label className={labelCls}>Nachricht (optional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={ACCESS_REQUEST_LIMITS.message}
          rows={3}
          className={`${inputCls} resize-none`}
          placeholder="z. B. woher du mich kennst"
        />
      </div>

      {error && <p className="text-sm text-memo-minusText">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-sm bg-memo-ink py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? 'Bitte warten...' : 'Zugang anfragen'}
      </button>
    </form>
  )
}
