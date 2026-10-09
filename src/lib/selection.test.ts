import { describe, expect, it } from 'vitest'
import { deselectShown, headerState, selectShown, toggleSelection } from './selection'

const set = (...t: string[]) => new Set(t)

describe('Auswahl', () => {
  it('jede Zeile ist an- und wieder abwählbar', () => {
    const a = toggleSelection(set(), 'AAPL')
    expect([...a.next]).toEqual(['AAPL'])
    const b = toggleSelection(a.next, 'AAPL')
    expect(b.next.size).toBe(0)
  })

  it('respektiert die Obergrenze (MAX_BATCH_SIZE) beim Einzelklick', () => {
    const full = new Set(Array.from({ length: 100 }, (_, i) => `T${i}`))
    const r = toggleSelection(full, 'NEU', 100)
    expect(r.capped).toBe(true)
    expect(r.next.size).toBe(100)
    expect(toggleSelection(full, 'T0', 100).next.size).toBe(99) // Abwählen geht immer
  })

  it('"Alle angezeigten" ergänzt bis zur Obergrenze, in Anzeigereihenfolge', () => {
    const shown = Array.from({ length: 245 }, (_, i) => `T${i}`)
    const r = selectShown(set(), shown, 100)
    expect(r.next.size).toBe(100)
    expect(r.capped).toBe(true)
    expect(r.next.has('T99')).toBe(true)
    expect(r.next.has('T100')).toBe(false)
    expect(selectShown(set('X'), ['A', 'B']).next).toEqual(set('X', 'A', 'B'))
  })

  it('Kopfzeilen-Checkbox: Zustand und Abwählen nur der angezeigten', () => {
    expect(headerState(set(), ['A', 'B'])).toBe('none')
    expect(headerState(set('A'), ['A', 'B'])).toBe('some')
    expect(headerState(set('A', 'B', 'X'), ['A', 'B'])).toBe('all')
    expect(deselectShown(set('A', 'B', 'X'), ['A', 'B'])).toEqual(set('X'))
  })
})
