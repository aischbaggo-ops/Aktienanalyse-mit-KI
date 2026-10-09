import { describe, expect, it, vi } from 'vitest'
import { createReanalyzeStarter, reanalyzeConfirmText } from './reanalyze'

describe('"Neu analysieren": Bestätigung und Doppelklick-Schutz', () => {
  it('fragt mit Kostenhinweis nach und startet erst nach Bestätigung', async () => {
    const confirm = vi.fn(() => true)
    const request = vi.fn(async () => {})
    const start = createReanalyzeStarter({ ticker: 'FE', confirm, request })
    expect(await start()).toBe('started')
    expect(confirm).toHaveBeenCalledWith(reanalyzeConfirmText('FE'))
    expect(reanalyzeConfirmText('FE')).toContain('ca. 0,04 USD')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('startet nichts, wenn abgebrochen wird', async () => {
    const request = vi.fn(async () => {})
    const start = createReanalyzeStarter({ ticker: 'FE', confirm: () => false, request })
    expect(await start()).toBe('cancelled')
    expect(request).not.toHaveBeenCalled()
  })

  it('Doppelklick: der zweite Klick während des Starts löst keinen zweiten Lauf aus', async () => {
    let release!: () => void
    const request = vi.fn(() => new Promise<void>((r) => (release = r)))
    const start = createReanalyzeStarter({ ticker: 'FE', confirm: () => true, request })
    const first = start()
    expect(await start()).toBe('busy')
    release()
    expect(await first).toBe('started')
    expect(request).toHaveBeenCalledTimes(1)
    // danach ist ein neuer Start wieder möglich
    const again = start()
    release()
    expect(await again).toBe('started')
    expect(request).toHaveBeenCalledTimes(2)
  })
})
