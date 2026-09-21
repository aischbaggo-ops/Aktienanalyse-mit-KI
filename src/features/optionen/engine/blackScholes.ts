// Black-Scholes-Bewertung einer europäischen Option und ihrer Griechen.
// Alle Zeitangaben in Jahren, Volatilität und Zins als Dezimalzahlen.

import type { Greeks, OptionType } from '../types'

const DAYS_PER_YEAR = 365

/** Dichte der Standardnormalverteilung φ(x) */
export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

/**
 * Verteilungsfunktion der Standardnormalverteilung N(x).
 * Hohe Genauigkeit über die Abramowitz-Stegun-Näherung (Fehler < 1e-7).
 */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422804014327 * Math.exp(-0.5 * x * x)
  const p =
    d *
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return x >= 0 ? 1 - p : p
}

export interface BsInput {
  spot: number
  strike: number
  /** Restlaufzeit in Jahren */
  timeYears: number
  /** implizite Volatilität (0.30 = 30 %) */
  iv: number
  /** risikofreier Zins (0.03 = 3 %) */
  rate: number
  optionType: OptionType
}

/** d1 und d2 des Black-Scholes-Modells */
export function d1d2(input: BsInput): { d1: number; d2: number } {
  const { spot, strike, timeYears, iv, rate } = input
  const volSqrtT = iv * Math.sqrt(timeYears)
  const d1 =
    (Math.log(spot / strike) + (rate + (iv * iv) / 2) * timeYears) / volSqrtT
  const d2 = d1 - volSqrtT
  return { d1, d2 }
}

/** Theoretischer Optionspreis (pro Aktie) nach Black-Scholes */
export function bsPrice(input: BsInput): number {
  const { spot, strike, timeYears, rate, optionType } = input

  // Bei Verfall (oder abgelaufen): innerer Wert
  if (timeYears <= 0) {
    return optionType === 'call'
      ? Math.max(spot - strike, 0)
      : Math.max(strike - spot, 0)
  }

  const { d1, d2 } = d1d2(input)
  const discount = Math.exp(-rate * timeYears)

  if (optionType === 'call') {
    return spot * normCdf(d1) - strike * discount * normCdf(d2)
  }
  return strike * discount * normCdf(-d2) - spot * normCdf(-d1)
}

/**
 * Griechen einer einzelnen Option (pro Aktie, für 1 Long-Kontrakt-Einheit).
 * Konventionen:
 *  - theta: Wertverlust pro Kalendertag
 *  - vega: Wertänderung je 1 Prozentpunkt IV
 *  - rho: Wertänderung je 1 Prozentpunkt Zins
 */
export function bsGreeks(input: BsInput): Greeks {
  const { spot, strike, timeYears, iv, rate, optionType } = input

  if (timeYears <= 0) {
    // Am Verfall gibt es keine Sensitivitäten mehr; Delta ist 0/±1 im Grenzwert.
    const itm =
      optionType === 'call' ? spot > strike : spot < strike
    const delta = itm ? (optionType === 'call' ? 1 : -1) : 0
    return { delta, gamma: 0, theta: 0, vega: 0, rho: 0 }
  }

  const { d1, d2 } = d1d2(input)
  const sqrtT = Math.sqrt(timeYears)
  const discount = Math.exp(-rate * timeYears)
  const pdf = normPdf(d1)

  const delta =
    optionType === 'call' ? normCdf(d1) : normCdf(d1) - 1
  const gamma = pdf / (spot * iv * sqrtT)
  const vegaPerUnit = spot * pdf * sqrtT // je 1.0 (=100 %) IV
  const vega = vegaPerUnit / 100 // je 1 Prozentpunkt

  const thetaYear =
    optionType === 'call'
      ? -(spot * pdf * iv) / (2 * sqrtT) -
        rate * strike * discount * normCdf(d2)
      : -(spot * pdf * iv) / (2 * sqrtT) +
        rate * strike * discount * normCdf(-d2)
  const theta = thetaYear / DAYS_PER_YEAR // je Kalendertag

  const rhoPerUnit =
    optionType === 'call'
      ? strike * timeYears * discount * normCdf(d2)
      : -strike * timeYears * discount * normCdf(-d2)
  const rho = rhoPerUnit / 100 // je 1 Prozentpunkt

  return { delta, gamma, theta, vega, rho }
}
