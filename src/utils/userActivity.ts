// Muss zur DB-Constraint profiles_username_format passen (supabase/migrations).
const USERNAME_RE = /^[A-Za-z0-9_-]{3,24}$/

export function validateUsername(name: string): string | null {
  const v = name.trim()
  if (!v) return 'Bitte einen Nutzernamen angeben.'
  if (/\s/.test(v)) return 'Der Nutzername darf keine Leerzeichen enthalten.'
  if (v.length < 3 || v.length > 24) return 'Der Nutzername muss 3 bis 24 Zeichen lang sein.'
  if (!USERNAME_RE.test(v)) return 'Erlaubt sind nur Buchstaben, Zahlen, _ und -.'
  return null
}

export const ONLINE_THRESHOLD_MS = 3 * 60 * 1000

export type PresenceStatus = { online: boolean; label: string }

// last_seen_at jünger als 3 Minuten => online, sonst relative Zeit.
export function presenceStatus(lastSeenAt: string | null, now: number = Date.now()): PresenceStatus {
  if (!lastSeenAt) return { online: false, label: 'noch nie aktiv' }
  const diff = Math.max(0, now - new Date(lastSeenAt).getTime())
  if (diff < ONLINE_THRESHOLD_MS) return { online: true, label: 'online' }
  const min = Math.floor(diff / 60_000)
  if (min < 60) return { online: false, label: `zuletzt aktiv vor ${min} Min` }
  const h = Math.floor(min / 60)
  if (h < 24) return { online: false, label: `zuletzt aktiv vor ${h} Std` }
  const d = Math.floor(h / 24)
  return { online: false, label: `zuletzt aktiv vor ${d} ${d === 1 ? 'Tag' : 'Tagen'}` }
}
