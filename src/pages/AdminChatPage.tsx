import { KeyboardEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { requestAnalyse, sendAdminChatMessage } from '../lib/webhooks'
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

// Gesamter sichtbarer Verlauf als reiner Text (keine Roh-Bloecke). Ganzer
// Verlauf statt nur der letzten Antwort, weil bei mehrstufiger Recherche
// fruehere Erkenntnisse sonst verloren gingen; das Backend kuerzt auf die
// letzten 8000 Zeichen.
function buildContext(turns: ChatTurn[]): string {
  return turns.map((t) => `${t.role === 'user' ? 'Admin' : 'Recherche'}: ${t.displayText}`).join('\n\n')
}

export function AdminChatPage() {
  const { session } = useAuth()
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCostUsd, setTotalCostUsd] = useState(0)
  const [adoptTicker, setAdoptTicker] = useState('')
  const [adopting, setAdopting] = useState(false)
  const [adoptError, setAdoptError] = useState<string | null>(null)
  const [adoptedTicker, setAdoptedTicker] = useState<string | null>(null)

  async function adoptIntoAnalysis() {
    const ticker = adoptTicker.trim().toUpperCase()
    if (!ticker || adopting || turns.length === 0 || !session?.access_token) return
    const confirmed = window.confirm(
      `Neuen Analyse-Lauf für ${ticker} starten (force_refresh) und den bisherigen Chat-Verlauf als Zusatzkontext mitgeben? Das kostet echtes Geld (FMP + Claude) und ersetzt die aktuelle Analyse von ${ticker}.`
    )
    if (!confirmed) return
    setAdopting(true)
    setAdoptError(null)
    setAdoptedTicker(null)
    try {
      await requestAnalyse(
        { ticker, max_age_days: null, force_refresh: true, admin_chat_context: buildContext(turns) },
        session.access_token
      )
      setAdoptedTicker(ticker)
    } catch (err) {
      setAdoptError(err instanceof Error ? err.message : 'Analyse konnte nicht gestartet werden.')
    } finally {
      setAdopting(false)
    }
  }

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

      <div className="space-y-2 border-t border-memo-line pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-memo-muted">In Analyse übernehmen</p>
        <p className="text-xs text-memo-muted">
          Startet einen neuen Analyse-Lauf (force_refresh) für den Ticker und gibt den bisherigen Chat-Verlauf
          einmalig als Zusatzkontext in den Prompt. Der Kontext wird nicht gespeichert.
        </p>
        <div className="flex gap-3">
          <input
            value={adoptTicker}
            onChange={(e) => setAdoptTicker(e.target.value)}
            disabled={adopting}
            placeholder="Ticker, z. B. NVDA"
            className="w-48 rounded-sm border border-memo-line bg-white px-3 py-2.5 text-sm uppercase text-memo-ink outline-none focus:border-memo-ink disabled:opacity-60"
          />
          <button
            onClick={adoptIntoAnalysis}
            disabled={adopting || !adoptTicker.trim() || turns.length === 0 || sending}
            className="rounded-sm border border-memo-ink px-4 py-2.5 text-sm font-medium text-memo-ink transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {adopting ? 'Wird gestartet...' : 'In Analyse übernehmen'}
          </button>
        </div>
        {adoptError && <p className="text-sm text-memo-minusText">{adoptError}</p>}
        {adoptedTicker && (
          <p className="text-sm text-memo-plusText">
            Analyse für {adoptedTicker} gestartet.{' '}
            <Link to={`/analyse/${encodeURIComponent(adoptedTicker)}`} className="underline">
              Zur Analyse
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
