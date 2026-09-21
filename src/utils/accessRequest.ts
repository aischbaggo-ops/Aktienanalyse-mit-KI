// Grenzen entsprechen den CHECK-Constraints in access_requests (supabase/migrations).
export const ACCESS_REQUEST_LIMITS = { contact: 200, name: 100, message: 2000 } as const

export interface AccessRequestInput {
  name: string
  contact: string
  message: string
}

export type AccessRequestPayload = { name: string | null; contact: string; message: string | null }

// Kontaktweg ist Pflicht, aber bewusst nicht auf E-Mail-Format geprueft
// (Telefon, Messenger o. ae. sind erlaubt). Leere optionale Felder werden NULL.
export function buildAccessRequest(
  input: AccessRequestInput
): { error: string } | { payload: AccessRequestPayload } {
  const contact = input.contact.trim()
  const name = input.name.trim()
  const message = input.message.trim()

  if (!contact) return { error: 'Bitte gib einen Kontaktweg an, über den ich dich erreichen kann.' }
  if (contact.length > ACCESS_REQUEST_LIMITS.contact)
    return { error: `Der Kontaktweg darf höchstens ${ACCESS_REQUEST_LIMITS.contact} Zeichen lang sein.` }
  if (name.length > ACCESS_REQUEST_LIMITS.name)
    return { error: `Der Name darf höchstens ${ACCESS_REQUEST_LIMITS.name} Zeichen lang sein.` }
  if (message.length > ACCESS_REQUEST_LIMITS.message)
    return { error: `Die Nachricht darf höchstens ${ACCESS_REQUEST_LIMITS.message} Zeichen lang sein.` }

  return { payload: { name: name || null, contact, message: message || null } }
}
