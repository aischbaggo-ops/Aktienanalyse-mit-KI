const ANALYSE_WEBHOOK_URL = import.meta.env.VITE_ANALYSE_WEBHOOK_URL
const SYMBOL_SEARCH_WEBHOOK_URL = import.meta.env.VITE_SYMBOL_SEARCH_WEBHOOK_URL
const DELETE_ACCOUNT_WEBHOOK_URL = import.meta.env.VITE_DELETE_ACCOUNT_WEBHOOK_URL

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

export async function searchSymbols(query: string): Promise<SymbolSearchResponse> {
  const url = `${SYMBOL_SEARCH_WEBHOOK_URL}?q=${encodeURIComponent(query)}`
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) {
    throw new Error(`Symbol-Suche fehlgeschlagen (${res.status})`)
  }
  const data = await res.json()
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
  user_id: string
  max_age_days: number | null
  force_refresh: boolean
}

export interface AnalyseResponse {
  source: AnalyseSource
  ticker?: string
  [key: string]: unknown
}

export async function requestAnalyse(payload: AnalyseRequestPayload): Promise<AnalyseResponse> {
  const res = await fetch(ANALYSE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`Analyse-Anfrage fehlgeschlagen (${res.status})`)
  }
  return res.json()
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
