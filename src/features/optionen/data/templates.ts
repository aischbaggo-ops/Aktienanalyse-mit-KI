// Vordefinierte Strategie-Vorlagen.
// Prämien werden bei Erzeugung mit Black-Scholes berechnet, damit die
// Beispielzahlen in sich stimmig sind. Alles bleibt danach editierbar.

import type { Leg, OptionType } from '../types'
import { bsPrice } from '../engine/blackScholes'

const TPL_IV = 0.3
const TPL_RATE = 0.04
const TPL_DAYS = 45

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

/** Strike auf einen sinnvollen Schritt runden (abhängig von der Kursgröße) */
function niceStrike(x: number): number {
  const step = x >= 200 ? 5 : x >= 50 ? 2.5 : 1
  return Math.round(x / step) * step
}

function optionLeg(
  spot: number,
  optionType: OptionType,
  direction: 'long' | 'short',
  strikeFactor: number,
  quantity = 1,
  days = TPL_DAYS,
): Leg {
  const strike = niceStrike(spot * strikeFactor)
  const premium = bsPrice({
    spot,
    strike,
    timeYears: days / 365,
    iv: TPL_IV,
    rate: TPL_RATE,
    optionType,
  })
  return {
    id: uid(),
    kind: 'option',
    optionType,
    direction,
    strike,
    daysToExpiry: days,
    quantity,
    premium: Math.round(premium * 100) / 100,
  }
}

function stockLeg(spot: number, direction: 'long' | 'short', quantity = 1): Leg {
  return {
    id: uid(),
    kind: 'stock',
    direction,
    strike: 0,
    daysToExpiry: 0,
    quantity,
    premium: Math.round(spot * 100) / 100,
  }
}

export interface StrategyTemplate {
  id: string
  name: string
  expectation: string
  build: (spot: number) => Leg[]
}

export const TEMPLATES: StrategyTemplate[] = [
  {
    id: 'single-call',
    name: 'Long Call',
    expectation: 'steigend',
    build: (s) => [optionLeg(s, 'call', 'long', 1.0)],
  },
  {
    id: 'single-put',
    name: 'Long Put',
    expectation: 'fallend',
    build: (s) => [optionLeg(s, 'put', 'long', 1.0)],
  },
  {
    id: 'covered-call',
    name: 'Covered Call',
    expectation: 'leicht steigend / seitwärts',
    build: (s) => [stockLeg(s, 'long'), optionLeg(s, 'call', 'short', 1.05)],
  },
  {
    id: 'cash-secured-put',
    name: 'Cash-Secured Put',
    expectation: 'seitwärts / Einstieg gewünscht',
    build: (s) => [optionLeg(s, 'put', 'short', 0.95)],
  },
  {
    id: 'bull-call-spread',
    name: 'Bull Call Spread',
    expectation: 'moderat steigend',
    build: (s) => [
      optionLeg(s, 'call', 'long', 1.0),
      optionLeg(s, 'call', 'short', 1.1),
    ],
  },
  {
    id: 'bear-put-spread',
    name: 'Bear Put Spread',
    expectation: 'moderat fallend',
    build: (s) => [
      optionLeg(s, 'put', 'long', 1.0),
      optionLeg(s, 'put', 'short', 0.9),
    ],
  },
  {
    id: 'straddle',
    name: 'Long Straddle',
    expectation: 'starke Bewegung, Richtung offen',
    build: (s) => [
      optionLeg(s, 'call', 'long', 1.0),
      optionLeg(s, 'put', 'long', 1.0),
    ],
  },
  {
    id: 'strangle',
    name: 'Long Strangle',
    expectation: 'starke Bewegung, günstiger',
    build: (s) => [
      optionLeg(s, 'call', 'long', 1.05),
      optionLeg(s, 'put', 'long', 0.95),
    ],
  },
  {
    id: 'iron-condor',
    name: 'Iron Condor',
    expectation: 'seitwärts, definiertes Risiko',
    build: (s) => [
      optionLeg(s, 'put', 'long', 0.85),
      optionLeg(s, 'put', 'short', 0.9),
      optionLeg(s, 'call', 'short', 1.1),
      optionLeg(s, 'call', 'long', 1.15),
    ],
  },
  {
    id: 'butterfly',
    name: 'Call Butterfly',
    expectation: 'Kurs bleibt nahe Mittelstrike',
    build: (s) => [
      optionLeg(s, 'call', 'long', 0.95),
      optionLeg(s, 'call', 'short', 1.0, 2),
      optionLeg(s, 'call', 'long', 1.05),
    ],
  },
  {
    id: 'calendar',
    name: 'Call Calendar Spread',
    expectation: 'seitwärts, Zeitwertdifferenz',
    build: (s) => [
      optionLeg(s, 'call', 'short', 1.0, 1, 30),
      optionLeg(s, 'call', 'long', 1.0, 1, 60),
    ],
  },
]
