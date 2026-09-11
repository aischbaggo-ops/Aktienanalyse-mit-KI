const ANALYSE_WEBHOOK_URL = import.meta.env.VITE_ANALYSE_WEBHOOK_URL
const SYMBOL_SEARCH_WEBHOOK_URL = import.meta.env.VITE_SYMBOL_SEARCH_WEBHOOK_URL

export interface SymbolSearchResult {
  symbol: string
  name: string
  currency?: string
}

export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  const url = `${SYMBOL_SEARCH_WEBHOOK_URL}?q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'ngrok-skip-browser-warning': 'true' },
  })
  if (!res.ok) {
    throw new Error(`Symbol-Suche fehlgeschlagen (${res.status})`)
  }
  const data = await res.json()
  // Webhook kann entweder ein Array direkt oder { results: [...] } liefern
  const list = Array.isArray(data) ? data : data.results ?? data.data ?? []
  return list.map((item: Record<string, unknown>) => ({
    symbol: String(item.symbol ?? item.ticker ?? ''),
    name: String(item.name ?? item.companyName ?? ''),
    currency: item.currency ? String(item.currency) : undefined,
  }))
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
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`Analyse-Anfrage fehlgeschlagen (${res.status})`)
  }
  return res.json()
}
