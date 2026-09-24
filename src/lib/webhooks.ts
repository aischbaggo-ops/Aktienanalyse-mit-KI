// Alle Edge Functions liegen unter demselben Supabase-Projekt unter
// /functions/v1/<name> - eine einzige, ohnehin schon zwingend gesetzte
// Basis-Variable (VITE_SUPABASE_URL, siehe lib/supabase.ts) reicht dafuer.
// Vorher hatte JEDE Function ihre eigene VITE_*_WEBHOOK_URL, die bei jeder
// neuen Function zusaetzlich manuell in Vercel gepflegt werden musste (pro
// Environment/Scope getrennt) - das hat wiederholt zu 405-Fehlern gefuehrt
// (Function existiert und funktioniert, aber die Env-Var wurde fuer eine
// Umgebung vergessen: index-constituents, approve-access-request,
// index-weight, save-llm-key). Mit dieser Ableitung entfaellt diese
// Fehlerklasse fuer jede bestehende UND kuenftige Function.
const FUNCTIONS_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

const ANALYSE_WEBHOOK_URL = `${FUNCTIONS_BASE_URL}/analyse`
const SYMBOL_SEARCH_WEBHOOK_URL = `${FUNCTIONS_BASE_URL}/symbol-search`
const DELETE_ACCOUNT_WEBHOOK_URL = `${FUNCTIONS_BASE_URL}/delete-account`
const SAVE_API_KEYS_WEBHOOK_URL = `${FUNCTIONS_BASE_URL}/save-api-keys`
const ADMIN_CHAT_WEBHOOK_URL = `${FUNCTIONS_BASE_URL}/admin-chat`
const ADMIN_USERS_WEBHOOK_URL = `${FUNCTIONS_BASE_URL}/admin-users`
const INDEX_CONSTITUENTS_WEBHOOK_URL = `${FUNCTIONS_BASE_URL}/index-constituents`
const INDEX_WEIGHT_WEBHOOK_URL = `${FUNCTIONS_BASE_URL}/index-weight`
const APPROVE_ACCESS_REQUEST_WEBHOOK_URL = `${FUNCTIONS_BASE_URL}/approve-access-request`
const LOG_EVENT_WEBHOOK_URL = `${FUNCTIONS_BASE_URL}/log-event`

export interface AdminUserRow {
  id: string
  ref: string
  email_masked: string
  username: string | null
  last_seen_at: string | null
  created_at: string
  is_admin: boolean
  optionen: boolean
}

export async function fetchAdminUsers(accessToken: string): Promise<AdminUserRow[]> {
  const res = await fetch(ADMIN_USERS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `Nutzerliste konnte nicht geladen werden (${res.status})`)
  }
  return data.users ?? []
}

export interface ApproveAccessRequestResult {
  invitedAt: string
}

// Genehmigt eine Zugangsanfrage und loest serverseitig die Einladungsmail
// aus (supabase.auth.admin.inviteUserByEmail) - siehe approve-access-request
// Function. Wirft bei einer ungueltigen E-Mail im Kontaktweg-Feld, bereits
// bearbeiteten Anfragen oder einem Fehler bei Supabase Auth.
export async function approveAccessRequest(requestId: string, accessToken: string): Promise<ApproveAccessRequestResult> {
  const res = await fetch(APPROVE_ACCESS_REQUEST_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ request_id: requestId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `Genehmigung fehlgeschlagen (${res.status})`)
  }
  return { invitedAt: data.invited_at }
}

export interface SymbolSearchResult {
  symbol: string
  name: string
  currency?: string
  isPrimary?: boolean
}

export interface SymbolSearchResponse {
  results: SymbolSearchResult[]
  rateLimited: boolean
}

// Sicherheitsfix 18.9.: analyse/symbol-search vertrauten bisher einer vom
// Client mitgeschickten user_id im Body/Query - damit haette jeder durch
// simples Aendern eines Feldes den API-Key eines fremden Nutzers mitnutzen
// koennen. Beide Functions verifizieren die user_id jetzt serverseitig aus
// dem Authorization-Bearer-Token, genau wie deleteOwnAccount() das schon
// tat - daher braucht searchSymbols()/requestAnalyse() jetzt zwingend den
// accessToken der aktuellen Session, keine user_id mehr im Payload.
export async function searchSymbols(query: string, accessToken: string): Promise<SymbolSearchResponse> {
  const url = `${SYMBOL_SEARCH_WEBHOOK_URL}?q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error ?? `Symbol-Suche fehlgeschlagen (${res.status})`)
  }
  // Webhook kann entweder ein Array direkt oder { results: [...] } liefern
  const list = Array.isArray(data) ? data : data.results ?? data.data ?? []
  return {
    results: list.map((item: Record<string, unknown>) => ({
      symbol: String(item.symbol ?? item.ticker ?? ''),
      name: String(item.name ?? item.companyName ?? ''),
      currency: item.currency ? String(item.currency) : undefined,
      isPrimary: item.isPrimary === true,
    })),
    rateLimited: data.rate_limited === true,
  }
}

export interface IndexConstituent {
  rank: number
  ticker: string
  name: string
}

export interface IndexConstituentsResponse {
  indexId: string
  label: string
  source: 'fmp' | 'fallback' | 'none'
  constituents: IndexConstituent[]
  note?: string
}

// limit = "Top N" (die ersten N in der von der Quelle gelieferten
// Reihenfolge, siehe index-constituents-Function). null/undefined laedt
// alle Mitglieder.
export async function getIndexConstituents(
  indexId: string,
  limit: number | null,
  accessToken: string
): Promise<IndexConstituentsResponse> {
  const res = await fetch(INDEX_CONSTITUENTS_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ index_id: indexId, limit }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `Index-Mitglieder konnten nicht geladen werden (${res.status})`)
  }
  return {
    indexId: data.index_id,
    label: data.label,
    source: data.source,
    constituents: data.constituents ?? [],
    note: data.note,
  }
}

export interface IndexWeighting {
  indexId: string
  label: string
  weightPct: number
}

// Rein informative Zusatzanzeige (siehe AnalysePage) - liefert leer statt
// zu werfen, wenn der Ticker in keinem der aktivierten Indizes vertreten
// ist oder die Function selbst nichts findet; ein echter Netzwerkfehler
// wird vom Aufrufer ebenfalls nur stillschweigend als "keine Anzeige"
// behandelt, siehe getIndexWeighting()-Aufruf in AnalysePage.tsx.
export async function getIndexWeighting(ticker: string, accessToken: string): Promise<IndexWeighting[]> {
  const res = await fetch(INDEX_WEIGHT_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ ticker }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `Index-Gewichtung konnte nicht geladen werden (${res.status})`)
  }
  const list = Array.isArray(data.weightings) ? data.weightings : []
  return list.map((w: Record<string, unknown>) => ({
    indexId: String(w.index_id ?? ''),
    label: String(w.label ?? ''),
    weightPct: Number(w.weight_pct ?? 0),
  }))
}

export type AnalyseSource = 'cache' | 'processing'

export interface AnalyseRequestPayload {
  ticker: string
  max_age_days: number | null
  force_refresh: boolean
  // Nur Admin + force_refresh: Freitext aus dem Admin-Chat, fliesst einmalig
  // in den Prompt dieses Laufs ein (wird nicht gespeichert).
  admin_chat_context?: string
}

export interface AnalyseResponse {
  source: AnalyseSource
  ticker?: string
  [key: string]: unknown
}

export async function requestAnalyse(payload: AnalyseRequestPayload, accessToken: string): Promise<AnalyseResponse> {
  const res = await fetch(ANALYSE_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error ?? `Analyse-Anfrage fehlgeschlagen (${res.status})`)
  }
  return data
}

// Anders als requestAnalyse()/searchSymbols() wird hier bewusst KEINE
// user_id im Body mitgeschickt - die Function ermittelt den Nutzer aus dem
// Authorization-Bearer-Token selbst (server-seitig validiert), damit ein
// Client niemals ein fremdes Konto loeschen kann, egal was im Body steht.
export async function deleteOwnAccount(accessToken: string): Promise<void> {
  const res = await fetch(DELETE_ACCOUNT_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `Konto-Loeschung fehlgeschlagen (${res.status})`)
  }
}

export interface SaveApiKeysPayload {
  fmp_api_key?: string
  claude_api_key?: string
}

// Leere/fehlende Felder lassen den jeweils bereits gespeicherten Key
// unangetastet (siehe save-api-keys-Function) - nur befuellte Felder
// werden ueberschrieben.
export async function saveApiKeys(payload: SaveApiKeysPayload, accessToken: string): Promise<void> {
  const res = await fetch(SAVE_API_KEYS_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `Speichern fehlgeschlagen (${res.status})`)
  }
}

// Ein Claude-Content-Block, so wie die Anthropic Messages API ihn liefert
// (text, server_tool_use, web_search_tool_result, ...) - wird bei einem
// Assistant-Turn unveraendert weitergereicht, nicht selbst geparst.
export interface AdminChatContentBlock {
  type: string
  text?: string
  [key: string]: unknown
}

// content ist entweder ein einfacher String (User-Turn) oder das rohe
// Block-Array einer frueheren Assistant-Antwort - siehe admin-chat/index.ts:
// bei Web-Search-Zitaten verlangt Anthropic, dieses Array bei einem
// Folge-Turn UNVERAENDERT zurueckzuschicken (inkl. encrypted_content),
// sonst 400-Fehler beim naechsten Aufruf.
export interface AdminChatMessage {
  role: 'user' | 'assistant'
  content: string | AdminChatContentBlock[]
}

export interface AdminChatResponse {
  content: AdminChatContentBlock[]
  tokens_input: number
  tokens_output: number
  web_search_count: number
  cost_usd: number
}

export async function sendAdminChatMessage(
  messages: AdminChatMessage[],
  accessToken: string
): Promise<AdminChatResponse> {
  const res = await fetch(ADMIN_CHAT_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messages }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `Chat-Anfrage fehlgeschlagen (${res.status})`)
  }
  return data
}

export type LogEventStatus = 'ok' | 'failed' | 'suspicious'

// Best-effort Diagnose-Log fuer "stille" Fehlschlaege ohne bestehenden
// Backend-Touchpoint (abgelaufener Passwort-Link, fehlgeschlagener Login -
// siehe SetPasswordPage.tsx/LoginPage.tsx). Bewusst fire-and-forget: kein
// await im Aufrufer noetig, ein Fehler hier darf den eigentlichen User-Flow
// nie beeintraechtigen oder verzoegern. event_type muss serverseitig in der
// Allowlist von supabase/functions/log-event stehen, sonst 400 (wird hier
// ignoriert).
export function logEvent(eventType: string, status: LogEventStatus, details?: Record<string, unknown>): void {
  fetch(LOG_EVENT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: eventType, status, details }),
  }).catch(() => {})
}
