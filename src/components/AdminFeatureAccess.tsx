import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchAdminUsers } from '../lib/webhooks'
import type { AdminUserRow } from '../lib/webhooks'
import { presenceStatus } from '../utils/userActivity'

const POLL_INTERVAL_MS = 45_000

// Nutzername, wo vorhanden - sonst die maskierte E-Mail als Fallback
// (Bestandskonten ohne Nutzername).
function displayName(u: AdminUserRow): string {
  return u.username ?? u.email_masked
}

// Nutzerbereich im Admin-Dashboard: neueste Registrierungen, Online-Status
// pro Nutzer und die manuelle Vergabe des Bausteins "optionen". Die Liste
// kommt aus der admin-users-Function (E-Mails nur serverseitig lesbar); das
// Freischalten schreibt direkt in feature_access (RLS erlaubt das nur Admins).
export function AdminFeatureAccess() {
  const { session, user } = useAuth()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const token = session?.access_token

  const load = useCallback(() => {
    if (!token) return
    fetchAdminUsers(token)
      .then((list) => {
        setUsers(list)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Nutzerliste konnte nicht geladen werden.'))
      .finally(() => setLoading(false))
  }, [token])

  // Polling, damit der Online-Status bei offener Admin-Seite nicht veraltet.
  useEffect(() => {
    load()
    const poll = setInterval(load, POLL_INTERVAL_MS)
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [load])

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

  const recent = [...users].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 10)

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-memo-minusText">{error}</p>}

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-memo-muted">
          Neueste Registrierungen
        </p>
        {loading ? (
          <p className="text-sm text-memo-muted">Lade Nutzer...</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-memo-muted">Keine Nutzer gefunden.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((u) => (
              <li key={u.id} className="flex items-center gap-3 text-sm">
                <span className="w-40 flex-shrink-0 truncate text-memo-ink">{displayName(u)}</span>
                <span className="text-memo-muted">{new Date(u.created_at).toLocaleString('de-DE')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-memo-muted">
          Nutzer, Online-Status und Baustein Optionen
        </p>
        <p className="mb-3 text-xs text-memo-muted">
          Online = in den letzten 3 Minuten aktiv. Ohne Nutzername wird die maskierte E-Mail gezeigt. Ohne
          Freischaltungs-Eintrag ist der Baustein gesperrt.
        </p>
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
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">Optionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-memo-line2">
                {users.map((u) => {
                  const status = presenceStatus(u.last_seen_at, now)
                  return (
                    <tr key={u.id}>
                      <td className={`py-2.5 pr-4 ${u.username ? 'text-memo-ink' : 'italic text-memo-muted'}`}>
                        {displayName(u)}
                      </td>
                      <td className="py-2.5 pr-4 text-memo-muted">{u.ref}</td>
                      <td className="py-2.5 pr-4 text-memo-muted">{u.is_admin ? 'Admin' : 'Nutzer'}</td>
                      <td className="whitespace-nowrap py-2.5 pr-4">
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={`inline-block h-2 w-2 rounded-full ${
                              status.online ? 'bg-memo-plus' : 'bg-memo-line'
                            }`}
                          />
                          <span className={status.online ? 'text-memo-plusText' : 'text-memo-muted'}>
                            {status.label}
                          </span>
                        </span>
                      </td>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
