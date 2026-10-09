import { describe, expect, it } from 'vitest'
import { dataSourceLabel, formatReturnPct } from './memoFormat'

describe('formatReturnPct (Kursgewinn- und Drawdown-Phasen)', () => {
  it('rechnet den gespeicherten Anteil in Prozent um', () => {
    // FAST 2001 und 2022 aus chart_data.returnBars
    expect(formatReturnPct(0.209)).toBe('+20,9 %')
    expect(formatReturnPct(-0.261)).toBe('-26,1 %')
    expect(formatReturnPct(0)).toBe('+0,0 %')
  })
})

describe('dataSourceLabel', () => {
  it('zeigt den Anbieter statt des internen Codes', () => {
    expect(dataSourceLabel('fmp_full')).toBe('Financial Modeling Prep (FMP)')
    expect(dataSourceLabel('fmp_free_limited')).toBe('Financial Modeling Prep (FMP), eingeschränkte Daten')
    expect(dataSourceLabel(null)).toBe('–')
  })
})
