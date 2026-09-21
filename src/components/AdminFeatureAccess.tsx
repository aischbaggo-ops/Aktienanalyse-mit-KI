import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchAdminUsers } from '../lib/webhooks'
import type { AdminUserRow } from '../lib/webhooks'

// Manuelle Vergabe des Bausteins "optionen" pro Nutzer. Schreibt direkt in
// feature_access (RLS-Policy erlaubt das nur Admins); die Nutzerliste kommt
// aus der admin-users-Function, weil E-Mails nur serverseitig lesbar sind.
export function AdminFeatureAccess() {
  const { session, user } = useAuth()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.access_token) return
    fetchAdminUsers(session.access_token)
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Nutzerliste konnte nicht geladen werden.'))
      .finally(() => setLoading(false))
  }, [session?.access_token])

  async function toggle(u: AdminUserRow) {
    if (!user || busyId) return
    const next = !u.optionen
    setBusyId(u.id)
    setError(null)
    const { error: upsertError } = await supabase.from('feature_access').upsert(
      {
        user_id: u.id,
        feature: 'optionen',
        unlocked: next,
        granted_by: user.id,
        granted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,feature' }
    )
    if (upsertError) {
      setError(upsertError.message)
    } else {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, optionen: next } : x)))
    }
    setBusyId(null)
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-memo-muted">
        Bausteine vergeben — Optionen
      </p>
      <p className="mb-3 text-xs text-memo-muted">
        Manuelle Freischaltung pro Nutzer (E-Mail maskiert). Ohne Eintrag ist der Baustein gesperrt.
      </p>
      {error && <p className="mb-2 text-sm text-memo-minusText">{error}</p>}
      {loading ? (
        <p className="text-sm text-memo-muted">Lade Nutzer...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-memo-muted">Keine Nutzer gefunden.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-memo-line2 text-left text-xs uppercase tracking-wide text-memo-muted">
                <th className="py-2 pr-4 font-medium">Nutzer</th>
                <th className="py-2 pr-4 font-medium">Ref</th>
                <th className="py-2 pr-4 font-medium">Rolle</th>
                <th className="py-2 font-medium">Optionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-memo-line2">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 pr-4 text-memo-ink">{u.email_masked}</td>
                  <td className="py-2.5 pr-4 text-memo-muted">{u.ref}</td>
                  <td className="py-2.5 pr-4 text-memo-muted">{u.is_admin ? 'Admin' : 'Nutzer'}</td>
                  <td className="py-2.5">
                    <button
                      onClick={() => toggle(u)}
                      disabled={busyId === u.id}
                      className={`rounded-sm border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                        u.optionen
                          ? 'border-memo-plus text-memo-plusText hover:border-memo-ink'
                          : 'border-memo-line text-memo-muted hover:border-memo-ink hover:text-memo-ink'
                      }`}
                    >
                      {u.optionen ? 'Freigeschaltet — entziehen' : 'Gesperrt — freischalten'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
