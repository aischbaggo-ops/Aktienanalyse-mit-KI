import type { AdminChatContentBlock } from './webhooks'

export function extractText(blocks: AdminChatContentBlock[]): string {
  return blocks
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
}

// Ohne diese Unterscheidung sah ein durch max_tokens abgeschnittener Content
// (Text noch gar nicht begonnen) im UI identisch aus wie eine echte leere
// Antwort - beides nur "(keine Textantwort erhalten)".
export function fallbackTextFor(stopReason: string | null): string {
  if (stopReason === 'max_tokens') {
    return 'Antwort wurde wegen Längenlimit abgeschnitten. Bitte die Aufgabe in kleinere Schritte aufteilen oder präziser formulieren.'
  }
  return '(keine Textantwort erhalten)'
}

export interface AssistantDisplay {
  displayText: string
  // true: Text ist vorhanden, wurde aber durch max_tokens abgeschnitten.
  truncated: boolean
}

export const CONTEXT_TRUNCATED_NOTE = '[Antwort wegen Längenlimit abgeschnitten, unvollständig]'

export interface ContextTurn {
  role: 'user' | 'assistant'
  displayText: string
  truncated?: boolean
}

// Gesamter sichtbarer Verlauf als reiner Text (keine Roh-Bloecke) fuer
// admin_chat_context. Ganzer Verlauf statt nur der letzten Antwort, weil bei
// mehrstufiger Recherche fruehere Erkenntnisse sonst verloren gingen; das
// Backend kuerzt auf die letzten 8000 Zeichen. Abgeschnittene Antworten tragen
// einen Vermerk, damit die Analyse sie nicht als vollstaendig behandelt.
export function buildContext(turns: ContextTurn[]): string {
  return turns
    .map((t) => {
      const line = `${t.role === 'user' ? 'Admin' : 'Recherche'}: ${t.displayText}`
      return t.role === 'assistant' && t.truncated ? `${line} ${CONTEXT_TRUNCATED_NOTE}` : line
    })
    .join('\n\n')
}

// Ein vorhandener Text wird immer angezeigt; bei max_tokens zusaetzlich mit
// Hinweis, dass er unvollstaendig ist.
export function describeAssistantResponse(blocks: AdminChatContentBlock[], stopReason: string | null): AssistantDisplay {
  const text = extractText(blocks)
  if (text) return { displayText: text, truncated: stopReason === 'max_tokens' }
  return { displayText: fallbackTextFor(stopReason), truncated: false }
}
