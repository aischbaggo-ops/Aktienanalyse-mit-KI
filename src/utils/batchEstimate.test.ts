import { describe, expect, it } from 'vitest'
import { estimateBatch, formatDurationRange } from './batchEstimate'

describe('estimateBatch', () => {
  it('rechnet nur nicht gecachte Ticker in Zeit, Kosten und FMP-Calls ein', () => {
    const e = estimateBatch(10, 4, 0.05)
    expect(e.uncached).toBe(6)
    expect(e.minSeconds).toBe(120)
    expect(e.maxSeconds).toBe(240)
    expect(e.costUsd).toBeCloseTo(0.3)
    expect(e.fmpCalls).toBe(78)
    expect(e.exceedsFmpFreeLimit).toBe(false)
  })

  it('warnt, wenn das FMP-Free-Tageslimit ueberschritten wuerde', () => {
    expect(estimateBatch(19, 0, null).exceedsFmpFreeLimit).toBe(false) // 247
    expect(estimateBatch(20, 0, null).exceedsFmpFreeLimit).toBe(true) // 260
  })

  it('liefert ohne historische Kosten keine Kostenschaetzung', () => {
    expect(estimateBatch(5, 0, null).costUsd).toBeNull()
  })

  it('geht bei vollstaendigem Cache auf null', () => {
    const e = estimateBatch(5, 5, 0.05)
    expect(e.uncached).toBe(0)
    expect(e.costUsd).toBe(0)
    expect(e.exceedsFmpFreeLimit).toBe(false)
  })
})

describe('formatDurationRange', () => {
  it('formatiert Bereiche und identische Grenzen', () => {
    expect(formatDurationRange(120, 240)).toBe('ca. 2–4 Min.')
    expect(formatDurationRange(20, 40)).toBe('ca. 1 Min.')
  })
})
