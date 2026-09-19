const ANALYSE_WEBHOOK_URL = import.meta.env.VITE_ANALYSE_WEBHOOK_URL
const SYMBOL_SEARCH_WEBHOOK_URL = import.meta.env.VITE_SYMBOL_SEARCH_WEBHOOK_URL
const DELETE_ACCOUNT_WEBHOOK_URL = import.meta.env.VITE_DELETE_ACCOUNT_WEBHOOK_URL
const SAVE_API_KEYS_WEBHOOK_URL = import.meta.env.VITE_SAVE_API_KEYS_WEBHOOK_URL
const ADMIN_CHAT_WEBHOOK_URL = import.meta.env.VITE_ADMIN_CHAT_WEBHOOK_URL

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

export type AnalyseSource = 'cache' | 'processing'

export interface AnalyseRequestPayload {
  ticker: string
  max_age_days: number | null
  force_refresh: boolean
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
