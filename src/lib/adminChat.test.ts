import { describe, expect, it } from 'vitest'
import { describeAssistantResponse } from './adminChat'

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
