import { refreshNotice } from '../lib/analysisRun'
import type { StockAnalysis } from '../types/database'

// Hinweis ueber einer gueltigen Analyse, wenn ein Refresh laeuft oder
// gescheitert ist (Ticket f). Ohne solchen Lauf rendert er nichts.
export function RefreshNoticeBanner({ analysis, now }: { analysis: StockAnalysis; now?: number }) {
  const notice = refreshNotice(analysis, now)
  if (!notice) return null
  return (
    <div
      role="status"
      className={
        notice.kind === 'failed'
          ? 'rounded-sm border border-memo-minus/40 bg-memo-minus/10 p-3 text-sm text-memo-minusText'
          : 'rounded-sm border border-memo-line p-3 text-sm text-memo-muted'
      }
    >
      <p>{notice.text}</p>
      {notice.kind === 'failed' && notice.detail && <p className="mt-1 text-xs">{notice.detail}</p>}
    </div>
  )
}
