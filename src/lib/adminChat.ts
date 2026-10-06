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

// Ein vorhandener Text wird immer angezeigt; bei max_tokens zusaetzlich mit
// Hinweis, dass er unvollstaendig ist.
export function describeAssistantResponse(blocks: AdminChatContentBlock[], stopReason: string | null): AssistantDisplay {
  const text = extractText(blocks)
  if (text) return { displayText: text, truncated: stopReason === 'max_tokens' }
  return { displayText: fallbackTextFor(stopReason), truncated: false }
}
