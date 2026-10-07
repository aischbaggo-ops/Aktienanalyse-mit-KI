import { describe, expect, it } from 'vitest'
import { buildContext, CONTEXT_TRUNCATED_NOTE, describeAssistantResponse } from './adminChat'

const text = (t: string) => ({ type: 'text', text: t })
const search = { type: 'server_tool_use', name: 'web_search' }

describe('describeAssistantResponse', () => {
  it('max_tokens mit vorhandenem Text: Text bleibt, Hinweis wird gesetzt', () => {
    const r = describeAssistantResponse([search, text('Erster Teil '), text('der Antwort')], 'max_tokens')
    expect(r.displayText).toBe('Erster Teil der Antwort')
    expect(r.truncated).toBe(true)
  })

  it('max_tokens ohne Text: bisherige Meldung, kein Teiltext-Hinweis', () => {
    const r = describeAssistantResponse([search], 'max_tokens')
    expect(r.displayText).toContain('Längenlimit')
    expect(r.truncated).toBe(false)
  })

  it('end_turn mit Text: unveraendert, kein Hinweis', () => {
    const r = describeAssistantResponse([text('Fertig.')], 'end_turn')
    expect(r).toEqual({ displayText: 'Fertig.', truncated: false })
  })

  it('kein Text und anderer Stop-Grund: bisherige Meldung', () => {
    expect(describeAssistantResponse([search], 'pause_turn').displayText).toBe('(keine Textantwort erhalten)')
    expect(describeAssistantResponse([], null).displayText).toBe('(keine Textantwort erhalten)')
  })
})

describe('buildContext', () => {
  it('unveraendertes Format ohne abgeschnittene Antwort', () => {
    const ctx = buildContext([
      { role: 'user', displayText: 'Frage' },
      { role: 'assistant', displayText: 'Antwort', truncated: false },
    ])
    expect(ctx).toBe('Admin: Frage\n\nRecherche: Antwort')
  })

  it('abgeschnittene Antwort traegt den Vermerk direkt dahinter', () => {
    const ctx = buildContext([
      { role: 'user', displayText: 'Frage' },
      { role: 'assistant', displayText: 'Teil der Antwort', truncated: true },
      { role: 'user', displayText: 'Weiter' },
    ])
    expect(ctx).toBe(`Admin: Frage\n\nRecherche: Teil der Antwort ${CONTEXT_TRUNCATED_NOTE}\n\nAdmin: Weiter`)
  })

  it('Vermerk nur bei Recherche-Antworten, nie bei Admin-Eingaben', () => {
    const ctx = buildContext([{ role: 'user', displayText: 'Frage', truncated: true }])
    expect(ctx).toBe('Admin: Frage')
  })
})
