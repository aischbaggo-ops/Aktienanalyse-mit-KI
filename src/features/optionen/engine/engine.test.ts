import { describe, expect, it } from 'vitest'
import { bsGreeks, bsPrice, normCdf } from './blackScholes'
import { breakEvens, computeMetrics, payoffAtExpiry } from './payoff'
import type { Leg, MarketParams } from '../types'

// Referenzfall (Lehrbuch): S=100, K=100, T=1, r=5 %, sigma=20 %
const ref = {
  spot: 100,
  strike: 100,
  timeYears: 1,
  iv: 0.2,
  rate: 0.05,
} as const

describe('normCdf', () => {
  it('trifft Standardwerte', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 4)
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3)
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 3)
  })
})

describe('bsPrice', () => {
  it('bewertet Call und Put wie das Lehrbuch', () => {
    expect(bsPrice({ ...ref, optionType: 'call' })).toBeCloseTo(10.4506, 2)
    expect(bsPrice({ ...ref, optionType: 'put' })).toBeCloseTo(5.5735, 2)
  })
  it('erfüllt die Put-Call-Parität', () => {
    const c = bsPrice({ ...ref, optionType: 'call' })
    const p = bsPrice({ ...ref, optionType: 'put' })
    const parity = c - p
    const expected = ref.spot - ref.strike * Math.exp(-ref.rate * ref.timeYears)
    expect(parity).toBeCloseTo(expected, 4)
  })
  it('liefert am Verfall den inneren Wert', () => {
    expect(bsPrice({ ...ref, timeYears: 0, spot: 120, optionType: 'call' })).toBe(20)
    expect(bsPrice({ ...ref, timeYears: 0, spot: 120, optionType: 'put' })).toBe(0)
  })
})

describe('bsGreeks', () => {
  it('trifft die bekannten Griechen', () => {
    const g = bsGreeks({ ...ref, optionType: 'call' })
    expect(g.delta).toBeCloseTo(0.6368, 3)
    expect(g.gamma).toBeCloseTo(0.01876, 4)
    expect(g.vega).toBeCloseTo(0.3752, 3) // je 1 % IV
    expect(g.theta).toBeCloseTo(-0.01757, 3) // je Tag
    expect(g.rho).toBeCloseTo(0.5323, 3) // je 1 % Zins
  })
})

describe('payoff & Kennzahlen', () => {
  const market: MarketParams = { spot: 100, iv: 0.2, rate: 0.05, contractSize: 100 }

  it('Long Call: Payoff und Break-even', () => {
    const legs: Leg[] = [
      {
        id: 'a',
        kind: 'option',
        optionType: 'call',
        direction: 'long',
        strike: 100,
        daysToExpiry: 365,
        quantity: 1,
        premium: 10,
      },
    ]
    // bei S=120: (20 - 10) * 100 = 1000
    expect(payoffAtExpiry(120, legs, 100)).toBeCloseTo(1000, 6)
    // bei S=100: (0 - 10) * 100 = -1000 (max Verlust)
    expect(payoffAtExpiry(100, legs, 100)).toBeCloseTo(-1000, 6)
    // Break-even = Strike + Prämie = 110
    expect(breakEvens(legs, 100, 100)).toEqual([110])

    const m = computeMetrics(legs, market)
    expect(m.maxProfit).toBeNull() // nach oben unbegrenzt
    expect(m.maxLoss).toBeCloseTo(-1000, 6)
    expect(m.netPremium).toBeCloseTo(-1000, 6) // Debit
  })

  it('Bull Call Spread: definiertes Risiko und Ertrag', () => {
    const legs: Leg[] = [
      { id: 'l', kind: 'option', optionType: 'call', direction: 'long', strike: 100, daysToExpiry: 365, quantity: 1, premium: 10 },
      { id: 's', kind: 'option', optionType: 'call', direction: 'short', strike: 110, daysToExpiry: 365, quantity: 1, premium: 5 },
    ]
    const m = computeMetrics(legs, market)
    // Netto-Debit = -(10-5)*100 = -500
    expect(m.netPremium).toBeCloseTo(-500, 6)
    // Max Verlust = Debit = -500 ; Max Gewinn = (110-100-5)*100 = 500
    expect(m.maxLoss).toBeCloseTo(-500, 6)
    expect(m.maxProfit).toBeCloseTo(500, 6)
    expect(m.breakEvens).toEqual([105])
  })

  it('Short Put (CSP): Prämie als Credit, begrenzter Verlust bei S=0', () => {
    const legs: Leg[] = [
      { id: 'p', kind: 'option', optionType: 'put', direction: 'short', strike: 95, daysToExpiry: 365, quantity: 1, premium: 4 },
    ]
    const m = computeMetrics(legs, market)
    expect(m.netPremium).toBeCloseTo(400, 6) // Credit
    expect(m.maxProfit).toBeCloseTo(400, 6)
    // maximaler Verlust bei S=0: (0 - 95)*... eingenommene Prämie 4 → (4-95)*100 = -9100
    expect(m.maxLoss).toBeCloseTo(-9100, 6)
  })
})
