import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AccessRequest, AccessRequestStatus } from '../types/database'

const PREVIEW_LEN = 100

// Zugangsanfragen aus dem Formular auf der Login-Seite (Tabelle access_requests,
// lesen/aendern nur Admins per RLS). Es gibt keinen automatischen Account-
// Mechanismus: Der Admin legt den Account manuell in Supabase an. Aktionen
// aendern nur den Status, es wird nichts geloescht.
export function AdminAccessRequests() {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showDone, setShowDone] = useState(false)

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('access_requests')
      .select('id, name, contact, message, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (loadError) setError(loadError.message)
    else {
      setError(null)
      setRequests(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function setStatus(id: string, status: AccessRequestStatus) {
    if (busyId) return
    setBusyId(id)
    setError(null)
    const { error: updateError } = await supabase.from('access_requests').update({ status }).eq('id', id)
    if (updateError) setError(updateError.message)
    else setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    setBusyId(null)
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const open = requests.filter((r) => r.status === 'neu')
  const done = requests.filter((r) => r.status !== 'neu')

  function renderMessage(r: AccessRequest) {
    if (!r.message) return <span className="text-memo-muted">—</span>
    const long = r.message.length > PREVIEW_LEN
    const isOpen = expanded.has(r.id)
    return (
      <span title={r.message}>
        {long && !isOpen ? `${r.message.slice(0, PREVIEW_LEN)}…` : r.message}
        {long && (
          <button
            onClick={() => toggleExpanded(r.id)}
            className="ml-1 text-xs text-memo-muted underline hover:text-memo-ink"
          >
            {isOpen ? 'weniger' : 'mehr'}
          </button>
        )}
      </span>
    )
  }

  function renderRow(r: AccessRequest, withActions: boolean) {
    return (
      <tr key={r.id}>
        <td className="py-2.5 pr-4 align-top text-memo-ink">{r.name ?? '—'}</td>
        <td className="py-2.5 pr-4 align-top text-memo-ink">{r.contact}</td>
        <td className="max-w-xs py-2.5 pr-4 align-top text-memo-ink">{renderMessage(r)}</td>
        <td className="whitespace-nowrap py-2.5 pr-4 align-top text-memo-muted">
          {new Date(r.created_at).toLocaleString('de-DE')}
        </td>
        <td className="whitespace-nowrap py-2.5 align-top">
          {withActions ? (
            <span className="inline-flex gap-2">
              <button
                onClick={() => setStatus(r.id, 'erledigt')}
                disabled={busyId === r.id}
                className="rounded-sm border border-memo-plus px-3 py-1 text-xs font-medium text-memo-plusText transition-colors hover:border-memo-ink disabled:opacity-50"
              >
                Erledigt
              </button>
              <button
                onClick={() => setStatus(r.id, 'abgelehnt')}
                disabled={busyId === r.id}
                className="rounded-sm border border-memo-line px-3 py-1 text-xs font-medium text-memo-muted transition-colors hover:border-memo-ink hover:text-memo-ink disabled:opacity-50"
              >
                Ablehnen
              </button>
            </span>
          ) : (
            <span className={r.status === 'erledigt' ? 'text-memo-plusText' : 'text-memo-muted'}>
              {r.status === 'erledigt' ? 'erledigt' : 'abgelehnt'}
            </span>
          )}
        </td>
      </tr>
    )
  }

  const head = (last: string) => (
    <thead>
      <tr className="border-b border-memo-line2 text-left text-xs uppercase tracking-wide text-memo-muted">
        <th className="py-2 pr-4 font-medium">Name</th>
        <th className="py-2 pr-4 font-medium">Kontaktweg</th>
        <th className="py-2 pr-4 font-medium">Nachricht</th>
        <th className="py-2 pr-4 font-medium">Zeitpunkt</th>
        <th className="py-2 font-medium">{last}</th>
      </tr>
    </thead>
  )

  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-memo-muted">
        Zugangsanfragen{open.length > 0 ? ` — ${open.length} neu` : ''}
      </p>
      <p className="mb-3 text-xs text-memo-muted">
        Nach Prüfung: Account manuell in Supabase anlegen (Authentication → Users → Add user) und die
        Zugangsdaten auf dem angegebenen Weg mitteilen. „Erledigt“ und „Ablehnen“ ändern nur den Status.
      </p>
      {error && <p className="mb-2 text-sm text-memo-minusText">{error}</p>}
      {loading ? (
        <p className="text-sm text-memo-muted">Lade Anfragen...</p>
      ) : (
        <>
          {open.length === 0 ? (
            <p className="text-sm text-memo-muted">Keine neuen Anfragen.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {head('Aktion')}
                <tbody className="divide-y divide-memo-line2">{open.map((r) => renderRow(r, true))}</tbody>
              </table>
            </div>
          )}

          {done.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowDone((v) => !v)}
                className="text-xs text-memo-muted underline hover:text-memo-ink"
              >
                {showDone ? 'Bearbeitete ausblenden' : `Bearbeitete anzeigen (${done.length})`}
              </button>
              {showDone && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    {head('Status')}
                    <tbody className="divide-y divide-memo-line2">{done.map((r) => renderRow(r, false))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
