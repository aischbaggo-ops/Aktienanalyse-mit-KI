import { KeyboardEvent, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { sendAdminChatMessage } from '../lib/webhooks'
import type { AdminChatContentBlock, AdminChatMessage } from '../lib/webhooks'

// Ein Turn im sichtbaren Verlauf. blocks ist nur bei role:'assistant'
// gesetzt und haelt das ROHE Claude-content-Array (inkl. server_tool_use/
// web_search_tool_result mit encrypted_content) - wird beim naechsten
// Request unveraendert als content dieses Turns mitgeschickt, siehe
// buildPayload(). displayText ist nur der daraus extrahierte Anzeigetext.
interface ChatTurn {
  role: 'user' | 'assistant'
  displayText: string
  blocks?: AdminChatContentBlock[]
  webSearchCount?: number
}

function extractText(blocks: AdminChatContentBlock[]): string {
  return blocks
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
}

function buildPayload(turns: ChatTurn[]): AdminChatMessage[] {
  return turns.map((t) =>
    t.role === 'assistant' && t.blocks ? { role: 'assistant', content: t.blocks } : { role: 'user', content: t.displayText }
  )
}

export function AdminChatPage() {
  const { session } = useAuth()
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCostUsd, setTotalCostUsd] = useState(0)

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending || !session?.access_token) return

    const nextTurns: ChatTurn[] = [...turns, { role: 'user', displayText: text }]
    setTurns(nextTurns)
    setInput('')
    setSending(true)
    setError(null)

    try {
      const res = await sendAdminChatMessage(buildPayload(nextTurns), session.access_token)
      const displayText = extractText(res.content) || '(keine Textantwort erhalten)'
      setTurns([
        ...nextTurns,
        { role: 'assistant', displayText, blocks: res.content, webSearchCount: res.web_search_count },
      ])
      setTotalCostUsd((c) => c + res.cost_usd)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat-Anfrage fehlgeschlagen.')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-analyst text-lg text-memo-ink">Recherche-Chat</h2>
        <p className="text-sm text-memo-muted">
          Diese Sitzung bisher: <span className="text-memo-ink">${totalCostUsd.toFixed(2)}</span>
        </p>
      </div>
      <p className="text-xs text-memo-muted">
        Jede Nachricht ruft Claude mit Websuche auf und kostet echtes Budget (dein eigener Claude-Key). Der
        Verlauf wird nur für diese Sitzung gehalten und geht bei einem Reload verloren.
      </p>

      <div className="min-h-[300px] space-y-4 border border-memo-line bg-white p-4">
        {turns.length === 0 ? (
          <p className="text-sm text-memo-muted">Noch keine Nachrichten. Stell eine Frage, um loszulegen.</p>
        ) : (
          turns.map((t, idx) => (
            <div key={idx} className={t.role === 'user' ? 'border-l-2 border-memo-ink pl-3' : 'border-l-2 border-memo-line2 pl-3'}>
              <p className="text-xs font-medium uppercase tracking-wide text-memo-muted">
                {t.role === 'user' ? 'Du' : 'Claude'}
                {t.webSearchCount ? ` — ${t.webSearchCount} Websuche${t.webSearchCount === 1 ? '' : 'n'}` : ''}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-memo-ink">{t.displayText}</p>
            </div>
          ))
        )}
        {sending && <p className="text-sm text-memo-muted">Claude denkt nach und recherchiert...</p>}
      </div>

      {error && <p className="text-sm text-memo-minusText">{error}</p>}

      <div className="flex gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          rows={2}
          placeholder="Frage stellen (Enter zum Senden, Shift+Enter für neue Zeile)..."
          className="w-full resize-none rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm text-memo-ink outline-none focus:border-memo-ink disabled:opacity-60"
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          className="shrink-0 self-end rounded-sm bg-memo-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Senden
        </button>
      </div>
    </div>
  )
}
