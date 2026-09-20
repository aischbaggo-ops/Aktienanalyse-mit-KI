// Zentrale Typdefinitionen der Optionen-Strategie-App

export type OptionType = 'call' | 'put'
export type Direction = 'long' | 'short'
/** 'option' = Optionskontrakt, 'stock' = Basiswert (Aktie) als Leg (z. B. Covered Call) */
export type InstrumentKind = 'option' | 'stock'

export interface Leg {
  id: string
  kind: InstrumentKind
  /** nur bei kind === 'option' relevant */
  optionType?: OptionType
  direction: Direction
  /** Ausübungspreis; bei Aktien-Leg ignoriert */
  strike: number
  /** Restlaufzeit in Tagen bis Verfall; bei Aktien-Leg ignoriert */
  daysToExpiry: number
  /** Anzahl Kontrakte (Optionen) bzw. Vielfaches der Kontraktgröße (Aktie) */
  quantity: number
  /**
   * Preis pro Einheit:
   *  - Option: gezahlte/erhaltene Prämie pro Aktie (nicht pro Kontrakt)
   *  - Aktie: Einstandskurs pro Aktie
   */
  premium: number
}

export interface MarketParams {
  /** aktueller Kurs des Basiswerts */
  spot: number
  /** implizite Volatilität als Dezimalzahl (0.30 = 30 %) */
  iv: number
  /** risikofreier Zins als Dezimalzahl (0.03 = 3 %) */
  rate: number
  /** Kontraktgröße (Aktien je Optionskontrakt), i. d. R. 100 */
  contractSize: number
}

export interface Strategy {
  id: string
  name: string
  underlying: string
  legs: Leg[]
}

export interface Greeks {
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
}

export interface StrategyMetrics {
  /** Netto-Prämie: positiv = Gutschrift (Credit), negativ = Belastung (Debit) */
  netPremium: number
  maxProfit: number | null // null = unbegrenzt
  maxLoss: number | null // null = unbegrenzt
  breakEvens: number[]
  /** aggregierte Griechen der Gesamtposition */
  greeks: Greeks
  /** Gewinnwahrscheinlichkeit bei Verfall (0..1) */
  probabilityOfProfit: number
}
