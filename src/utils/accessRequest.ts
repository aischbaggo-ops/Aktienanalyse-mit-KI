// Grenzen entsprechen den CHECK-Constraints in access_requests (supabase/migrations).
export const ACCESS_REQUEST_LIMITS = { contact: 200, name: 100, message: 2000, email: 254 } as const

// Gleiche Regel wie serverseitig in approve-access-request - bewusst simpel
// (Format-Plausibilitaet, keine vollstaendige RFC-5322-Pruefung).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface AccessRequestInput {
  name: string
  email: string
  contact: string
  message: string
}

export type AccessRequestPayload = { name: string | null; email: string; contact: string; message: string | null }

// E-Mail ist Pflicht UND muss wie eine E-Mail aussehen (wird fuer die
// automatische Einladung gebraucht, siehe approve-access-request).
// Kontaktweg bleibt zusaetzlich Pflicht, aber bewusst NICHT auf
// E-Mail-Format geprueft (Telefon, Messenger o. ae. sind dort weiterhin
// erlaubt, falls der Admin lieber auf diesem Weg rueckfragt). Leere
// optionale Felder werden NULL.
export function buildAccessRequest(
  input: AccessRequestInput
): { error: string } | { payload: AccessRequestPayload } {
  const email = input.email.trim()
  const contact = input.contact.trim()
  const name = input.name.trim()
  const message = input.message.trim()

  if (!email) return { error: 'Bitte gib deine E-Mail-Adresse an, damit ich dich einladen kann.' }
  if (email.length > ACCESS_REQUEST_LIMITS.email)
    return { error: `Die E-Mail-Adresse darf höchstens ${ACCESS_REQUEST_LIMITS.email} Zeichen lang sein.` }
  if (!EMAIL_RE.test(email)) return { error: 'Bitte gib eine gültige E-Mail-Adresse an.' }

  if (!contact) return { error: 'Bitte gib einen Kontaktweg an, über den ich dich erreichen kann.' }
  if (contact.length > ACCESS_REQUEST_LIMITS.contact)
    return { error: `Der Kontaktweg darf höchstens ${ACCESS_REQUEST_LIMITS.contact} Zeichen lang sein.` }
  if (name.length > ACCESS_REQUEST_LIMITS.name)
    return { error: `Der Name darf höchstens ${ACCESS_REQUEST_LIMITS.name} Zeichen lang sein.` }
  if (message.length > ACCESS_REQUEST_LIMITS.message)
    return { error: `Die Nachricht darf höchstens ${ACCESS_REQUEST_LIMITS.message} Zeichen lang sein.` }

  return { payload: { name: name || null, email, contact, message: message || null } }
}
