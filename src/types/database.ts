export type AnalysisStatus = 'pending' | 'running' | 'done' | 'error'
export type Ampel = 'gruen' | 'gelb' | 'rot' | 'na'

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

export interface BewertungData {
  dcf?: DcfData | null
  currency?: string | null
  methode?: string | null
  [key: string]: unknown
}

export interface PrognoseData {
  [key: string]: unknown
}

export interface KrisenFenster {
  name: string
  zeitraum?: string
  ddStock: number | null
  ddIndex: number | null
  [key: string]: unknown
}

export interface ChartData {
  krise?: KrisenFenster[]
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
  tokens_input: number | null
  tokens_output: number | null
  cost_usd_claude: number | null
  created_at: string
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

export interface Profile {
  id: string
  is_admin: boolean
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
