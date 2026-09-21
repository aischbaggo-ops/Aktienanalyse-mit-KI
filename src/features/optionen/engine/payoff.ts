// Payoff, Kennzahlen und aggregierte Griechen einer Strategie.
// Das Verfalls-Payoff ist stückweise linear – Extrema und Break-evens
// werden deshalb exakt an den Knickpunkten (Strikes) berechnet, nicht geschätzt.

import type { Greeks, Leg, MarketParams, StrategyMetrics } from '../types'
import { bsGreeks, bsPrice } from './blackScholes'

const sign = (l: Leg): number => (l.direction === 'long' ? 1 : -1)

/** Wert eines Legs pro Aktie am Verfall (innerer Wert bzw. Kurs) */
function valueAtExpiryPerShare(S: number, leg: Leg): number {
  if (leg.kind === 'stock') return S
  if (leg.optionType === 'call') return Math.max(S - leg.strike, 0)
  return Math.max(leg.strike - S, 0)
}

/** Gesamt-P/L der Strategie am Verfall beim Kurs S */
export function payoffAtExpiry(
  S: number,
  legs: Leg[],
  contractSize: number,
): number {
  return legs.reduce((sum, leg) => {
    const mult = leg.quantity * contractSize
    const pnlPerShare = sign(leg) * (valueAtExpiryPerShare(S, leg) - leg.premium)
    return sum + pnlPerShare * mult
  }, 0)
}

export interface SimState {
  /** verstrichene Tage seit heute (0 = heute) */
  elapsedDays: number
  iv: number
  rate: number
}

/** Gesamt-P/L der Strategie beim Kurs S zu einem Zeitpunkt VOR Verfall */
export function valueBeforeExpiry(
  S: number,
  legs: Leg[],
  sim: SimState,
  contractSize: number,
): number {
  return legs.reduce((sum, leg) => {
    const mult = leg.quantity * contractSize
    let perShare: number
    if (leg.kind === 'stock') {
      perShare = S
    } else {
      const remainingYears = Math.max(leg.daysToExpiry - sim.elapsedDays, 0) / 365
      perShare = bsPrice({
        spot: S,
        strike: leg.strike,
        timeYears: remainingYears,
        iv: sim.iv,
        rate: sim.rate,
        optionType: leg.optionType!,
      })
    }
    const pnlPerShare = sign(leg) * (perShare - leg.premium)
    return sum + pnlPerShare * mult
  }, 0)
}

/** Netto-Cashflow beim Eröffnen: positiv = Gutschrift (Credit), negativ = Belastung (Debit) */
export function netPremium(legs: Leg[], contractSize: number): number {
  return legs.reduce((sum, leg) => {
    const mult = leg.quantity * contractSize
    // long => Prämie/Kurs bezahlt (Abfluss), short => erhalten (Zufluss)
    return sum + -sign(leg) * leg.premium * mult
  }, 0)
}

/** Steigung des Verfalls-Payoffs für S → ∞ (in Einheiten P/L pro Kurspunkt) */
function slopeHigh(legs: Leg[], contractSize: number): number {
  return legs.reduce((s, leg) => {
    const mult = leg.quantity * contractSize
    let d = 0
    if (leg.kind === 'stock') d = 1
    else if (leg.optionType === 'call') d = 1
    else d = 0 // Put wertlos für große S
    return s + sign(leg) * d * mult
  }, 0)
}

/** Sortierte, eindeutige Knickpunkte (Strikes) plus 0 und ein hoher Endpunkt */
function breakpoints(legs: Leg[], spot: number): number[] {
  const strikes = legs
    .filter((l) => l.kind === 'option')
    .map((l) => l.strike)
  const maxStrike = Math.max(spot, ...strikes, 1)
  const points = new Set<number>([0, ...strikes, maxStrike * 3])
  return [...points].sort((a, b) => a - b)
}

/** Break-even-Punkte durch lineare Interpolation zwischen den Knickpunkten */
export function breakEvens(legs: Leg[], contractSize: number, spot: number): number[] {
  const pts = breakpoints(legs, spot)
  const result: number[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const fa = payoffAtExpiry(a, legs, contractSize)
    const fb = payoffAtExpiry(b, legs, contractSize)
    if (fa === 0) result.push(a)
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
      const cross = a + (b - a) * (-fa / (fb - fa))
      result.push(cross)
    }
  }
  // Duplikate (z. B. exakt auf einem Strike) zusammenfassen
  return [...new Set(result.map((x) => Math.round(x * 100) / 100))]
}

/** Aggregierte Griechen der Gesamtposition (heutiger Zeitpunkt) */
export function aggregateGreeks(legs: Leg[], market: MarketParams): Greeks {
  const acc: Greeks = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 }
  for (const leg of legs) {
    const mult = leg.quantity * market.contractSize
    const s = sign(leg)
    if (leg.kind === 'stock') {
      acc.delta += s * 1 * mult
      continue
    }
    const g = bsGreeks({
      spot: market.spot,
      strike: leg.strike,
      timeYears: leg.daysToExpiry / 365,
      iv: market.iv,
      rate: market.rate,
      optionType: leg.optionType!,
    })
    acc.delta += s * g.delta * mult
    acc.gamma += s * g.gamma * mult
    acc.theta += s * g.theta * mult
    acc.vega += s * g.vega * mult
    acc.rho += s * g.rho * mult
  }
  return acc
}

/** Standardnormal-CDF (aus blackScholes reexportiert, hier lokal für Lognormal-PoP) */
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422804014327 * Math.exp(-0.5 * x * x)
  const p =
    d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return x >= 0 ? 1 - p : p
}

/**
 * Gewinnwahrscheinlichkeit bei Verfall.
 * Terminalkurs S_T ist lognormalverteilt (risikoneutraler Drift).
 * Zeithorizont = längste Optionslaufzeit der Strategie.
 */
export function probabilityOfProfit(legs: Leg[], market: MarketParams): number {
  const optionDays = legs
    .filter((l) => l.kind === 'option')
    .map((l) => l.daysToExpiry)
  const days = optionDays.length ? Math.max(...optionDays) : 0
  const T = days / 365
  const { spot, iv, rate, contractSize } = market

  if (T <= 0 || iv <= 0) {
    return payoffAtExpiry(spot, legs, contractSize) > 0 ? 1 : 0
  }

  // P(S_T <= x) unter Lognormal mit Drift (rate - iv^2/2)
  const cdfS = (x: number): number => {
    if (x <= 0) return 0
    const z = (Math.log(x / spot) - (rate - (iv * iv) / 2) * T) / (iv * Math.sqrt(T))
    return normCdf(z)
  }

  // Gewinnintervalle aus Break-evens ableiten
  const bes = breakEvens(legs, contractSize, spot).sort((a, b) => a - b)
  const edges = [0, ...bes, Number.POSITIVE_INFINITY]
  let prob = 0
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i]
    const hi = edges[i + 1]
    const mid = hi === Number.POSITIVE_INFINITY ? lo + Math.max(spot, 1) : (lo + hi) / 2
    if (payoffAtExpiry(mid, legs, contractSize) > 0) {
      const pLo = cdfS(lo)
      const pHi = hi === Number.POSITIVE_INFINITY ? 1 : cdfS(hi)
      prob += pHi - pLo
    }
  }
  return Math.min(Math.max(prob, 0), 1)
}

/** Alle Kennzahlen einer Strategie in einem Aufruf */
export function computeMetrics(legs: Leg[], market: MarketParams): StrategyMetrics {
  const { spot, contractSize } = market
  const pts = breakpoints(legs, spot)
  const values = pts.map((s) => payoffAtExpiry(s, legs, contractSize))
  const slope = slopeHigh(legs, contractSize)

  // Extrema exakt an den Knickpunkten; Unbegrenztheit nur über die Steigung bei S → ∞
  // (nach unten ist S bei 0 begrenzt, daher immer endlich).
  const maxAtPoints = Math.max(...values)
  const minAtPoints = Math.min(...values)
  const maxProfit = slope > 0 ? null : maxAtPoints
  const maxLoss = slope < 0 ? null : minAtPoints

  return {
    netPremium: netPremium(legs, contractSize),
    maxProfit,
    maxLoss,
    breakEvens: breakEvens(legs, contractSize, spot),
    greeks: aggregateGreeks(legs, market),
    probabilityOfProfit: probabilityOfProfit(legs, market),
  }
}
