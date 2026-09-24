export type AnalysisStatus = 'pending' | 'running' | 'done' | 'error'
export type Ampel = 'gruen' | 'gelb' | 'rot' | 'grau'

export interface CriterionEntry {
  dimension: string
  name: string
  ampel: Ampel
  begruendung?: string
  value?: string | number
  [key: string]: unknown
}

export interface WarningEntry {
  text: string
  severity?: 'info' | 'warning' | 'critical'
  [key: string]: unknown
}

export interface DcfData {
  dcf: number | null
  'Stock Price'?: number | null
  [key: string]: unknown
}

export interface ValuationMetric {
  value: number | null
  label: string
}

export interface FairValueData {
  value: number | null
  label: string
  abweichung_pct: number | null
  kontext: {
    avg_kgv: number | null
    avg_kcv: number | null
    dcf: number | null
    jahre: number
  }
}

export interface ValuationData {
  verfuegbar: boolean
  hinweis?: string
  market_cap?: number
  ev?: number
  fair_value?: FairValueData
  ev_umsatz?: ValuationMetric
}

export interface BewertungData {
  dcf?: DcfData | null
  currency?: string | null
  methode?: string | null
  valuation?: ValuationData
  [key: string]: unknown
}

export interface PrognoseSzenario {
  ziel: number
  jahresrendite: number
  gesamtrendite: number
  fair_value_heute: number
  wahrscheinlichkeit: number
}

export interface PrognosePfadPunkt {
  jahr: number
  baer: number | null
  basis: number | null
  bull: number | null
}

export interface PrognoseData {
  verfuegbar: boolean
  hinweis?: string
  zieljahr?: number
  jahre_bis_zieljahr?: number
  aktueller_kurs?: number
  baer?: PrognoseSzenario | null
  basis?: PrognoseSzenario | null
  bull?: PrognoseSzenario | null
  erwartungswert?: number | null
  pfad?: PrognosePfadPunkt[]
  [key: string]: unknown
}

export interface KrisenFenster {
  name: string
  zeitraum?: string
  ddStock: number | null
  ddIndex: number | null
  [key: string]: unknown
}

export interface FundamentalSeries {
  years: string[]
  revenue: (number | null)[]
  grossProfit: (number | null)[]
  ebit: (number | null)[]
  ebitda: (number | null)[]
  netIncome: (number | null)[]
  grossMargin: (number | null)[]
  operatingMargin: (number | null)[]
  netMargin: (number | null)[]
  operatingCashFlow: (number | null)[]
  freeCashFlow: (number | null)[]
  goodwill: (number | null)[]
  sharesOut: (number | null)[]
  totalDebt: (number | null)[]
  cash: (number | null)[]
  dividendsPaid: (number | null)[]
  isDividendPayer: boolean
}

export interface MonthlyPricePoint {
  date: string
  close: number
}

export interface RelativeStrengthPoint {
  date: string
  value: number
}

export interface ReturnBar {
  period: string
  pct: number
}

export interface QuickCheckItem {
  pass: boolean | null
  wert?: number | null
  klasse?: string | null
}

export interface QuickCheckData {
  kein_penny_stock: QuickCheckItem
  liquiditaet: QuickCheckItem
  marktkap_klasse: QuickCheckItem
  aufwaertstrend: QuickCheckItem
}

export interface SwotData {
  staerken: string[]
  schwaechen: string[]
  chancen: string[]
  risiken: string[]
}

export interface AnalystConsensus {
  target: number
  count: number
}

export interface BankRating {
  company: string
  grade: string
  action: string
  date: string
  previousGrade: string
}

export interface ProfileMeta {
  image: string | null
  marketCap: number | null
  exchange: string | null
  industry: string | null
  description: string | null
}

export interface ChartData {
  krise?: KrisenFenster[]
  trend?: { wCagrStock: number | null; wCagrIndex: number | null; wVola: number | null }
  stabilitaet?: { piotroski: number | null; piotroskiAmpel: number | null; altman: number | null; altmanAmpel: number | null; hinweis?: string }
  swot?: SwotData | null
  no_go_hart?: boolean
  fundamentalSeries?: FundamentalSeries
  priceMonthly?: { stock: MonthlyPricePoint[]; index: MonthlyPricePoint[] }
  relativeStrength?: RelativeStrengthPoint[]
  returnBars?: ReturnBar[]
  quickCheck?: QuickCheckData
  analystConsensus?: AnalystConsensus | null
  bankRatings?: BankRating[]
  profileMeta?: ProfileMeta
  [key: string]: unknown
}

export interface StockAnalysis {
  id: string
  ticker: string
  status: AnalysisStatus
  company_name: string | null
  sector: string | null
  currency: string | null
  current_price: number | null
  score_total: number | null
  score_fundamental: number | null
  score_qualitaet: number | null
  score_krise: number | null
  score_trend: number | null
  score_stabilitaet: number | null
  criteria: CriterionEntry[] | null
  warnings: WarningEntry[] | string[] | null
  fazit: string | null
  bewertung: BewertungData | null
  prognose: PrognoseData | null
  chart_data: ChartData | null
  data_source: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

// tokens_input/tokens_output/cost_usd_claude wurden aus stock_analyses
// entfernt (Pentest-Fix, siehe Migration 20260924120000) - der geteilte
// Cache ist fuer ALLE authentifizierten Nutzer lesbar, die Kosten pro
// Analyse sollen das nicht sein. Eigene admin-only Tabelle stattdessen,
// nur ueber AdminPage.tsx gelesen (gleiches is_admin-RLS-Muster wie
// request_log/function_errors).
export interface StockAnalysisCosts {
  ticker: string
  tokens_input: number | null
  tokens_output: number | null
  cost_usd_claude: number | null
  updated_at: string
  [key: string]: unknown
}

export interface Watchlist {
  user_id: string
  ticker: string
  analysis_id: string | null
  added_at: string
  [key: string]: unknown
}

export interface WatchlistWithAnalysis extends Watchlist {
  stock_analyses: StockAnalysis | null
}

export type RequestLogStatus = 'cache' | 'processing' | 'done' | 'error'
export type DataQuality = 'full' | 'limited'

export interface RequestLog {
  id?: string
  ticker: string
  user_id: string | null
  requested_at: string
  source: 'cache' | 'processing'
  max_age_days: number | null
  force_refresh: boolean
  status: RequestLogStatus
  duration_ms: number | null
  error_message: string | null
  data_quality: DataQuality | null
  deviation_triggered: boolean
  deviation_amount: number | null
  [key: string]: unknown
}

export interface SearchLog {
  id?: string
  query: string
  rate_limited: boolean
  requested_at: string
  [key: string]: unknown
}

export interface FeatureAccess {
  user_id: string
  feature: string
  unlocked: boolean
  granted_by: string | null
  granted_at: string | null
  [key: string]: unknown
}

export type AccessRequestStatus = 'neu' | 'erledigt' | 'abgelehnt'

export interface AccessRequest {
  id: string
  name: string | null
  // Alt-Anfragen (vor 2026-09-23) haben kein email-Feld - siehe Migration
  // 20260923100000. Neue Anfragen erzwingen es ueber die Insert-RLS-Policy.
  email: string | null
  contact: string
  message: string | null
  status: AccessRequestStatus
  created_at: string
  invited_at: string | null
  [key: string]: unknown
}

export interface FunctionError {
  id?: string
  function_name: string
  user_id: string | null
  error_message: string
  created_at: string
  [key: string]: unknown
}

// Granulares Tracking JEDES einzelnen FMP-/Claude-Calls (nicht nur
// aggregiert pro Analyse wie request_log) - siehe Migration
// 20260925090000. Admin-only, 7 Tage Aufbewahrung.
export interface ApiCallLog {
  id?: string
  function_name: string
  provider: string
  call_type: string | null
  ticker: string | null
  success: boolean
  duration_ms: number
  tokens_input: number | null
  tokens_output: number | null
  cost_usd: number | null
  error_message: string | null
  created_at: string
  [key: string]: unknown
}

export type AppEventStatus = 'ok' | 'failed' | 'suspicious'

// Allgemeines Ereignis-Log fuer "stille" Fehlschlaege (HTTP-technisch
// erfolgreich, aber Ziel nicht erreicht) und Auffaelligkeiten - siehe
// Migration 20260925090000. Admin-only, 7 Tage Aufbewahrung.
export interface AppEvent {
  id?: string
  event_type: string
  function_name: string
  status: AppEventStatus
  user_id: string | null
  details: Record<string, unknown> | null
  created_at: string
  [key: string]: unknown
}

export interface Profile {
  id: string
  is_admin: boolean
  username: string | null
  last_seen_at: string | null
  [key: string]: unknown
}

// Ciphertext-/IV-Spalten sind ohne das serverseitige Function-Secret
// wertlos (siehe supabase/functions/_shared/crypto.ts) - werden im
// Frontend nie zur Anzeige verwendet, nur *_last4/updated_at.
export interface UserApiKeys {
  user_id: string
  fmp_key_ciphertext: string | null
  fmp_key_iv: string | null
  fmp_key_last4: string | null
  claude_key_ciphertext: string | null
  claude_key_iv: string | null
  claude_key_last4: string | null
  updated_at: string
  [key: string]: unknown
}

export interface Database {
  public: {
    Tables: {
      stock_analyses: {
        Row: StockAnalysis
        Insert: Partial<StockAnalysis>
        Update: Partial<StockAnalysis>
        Relationships: []
      }
      watchlists: {
        Row: Watchlist
        Insert: Partial<Watchlist>
        Update: Partial<Watchlist>
        Relationships: []
      }
      request_log: {
        Row: RequestLog
        Insert: Partial<RequestLog>
        Update: Partial<RequestLog>
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: Partial<Profile>
        Update: Partial<Profile>
        Relationships: []
      }
      search_log: {
        Row: SearchLog
        Insert: Partial<SearchLog>
        Update: Partial<SearchLog>
        Relationships: []
      }
      access_requests: {
        Row: AccessRequest
        Insert: Partial<AccessRequest>
        Update: Partial<AccessRequest>
        Relationships: []
      }
      feature_access: {
        Row: FeatureAccess
        Insert: Partial<FeatureAccess>
        Update: Partial<FeatureAccess>
        Relationships: []
      }
      function_errors: {
        Row: FunctionError
        Insert: Partial<FunctionError>
        Update: Partial<FunctionError>
        Relationships: []
      }
      user_api_keys: {
        Row: UserApiKeys
        Insert: Partial<UserApiKeys>
        Update: Partial<UserApiKeys>
        Relationships: []
      }
      stock_analyses_costs: {
        Row: StockAnalysisCosts
        Insert: Partial<StockAnalysisCosts>
        Update: Partial<StockAnalysisCosts>
        Relationships: []
      }
      api_call_log: {
        Row: ApiCallLog
        Insert: Partial<ApiCallLog>
        Update: Partial<ApiCallLog>
        Relationships: []
      }
      app_events: {
        Row: AppEvent
        Insert: Partial<AppEvent>
        Update: Partial<AppEvent>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_avg_recent_analysis_cost: { Args: Record<string, never>; Returns: number | null }
      username_available: { Args: { p_username: string }; Returns: boolean }
      set_my_username: { Args: { p_username: string }; Returns: undefined }
      touch_last_seen: { Args: Record<string, never>; Returns: undefined }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
