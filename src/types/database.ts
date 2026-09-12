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

export interface ValuationData {
  verfuegbar: boolean
  hinweis?: string
  market_cap?: number
  ev?: number
  kgv?: ValuationMetric
  kcv?: ValuationMetric
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
