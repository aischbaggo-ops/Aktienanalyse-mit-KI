// Datenzugriffe, die Dashboard und "Alle Analysen" gemeinsam nutzen.
import { supabase } from './supabase'
import { ERROR_INFO_SELECT, type AnalysisTableRow } from './analysisTable'
import { generateAnalysisPdf } from '../utils/pdfExport'
import { REMOVE_CHUNK_SIZE, chunk, removalOutcome, type RemovalResult } from './watchlistRemoval'

// Zeilen mit status 'error' (z.B. FDXF, HONA, SPCX): Code und oeffentliche
// Meldung aus stock_analyses nachladen, damit die Tabelle "nicht bewertbar"
// statt "Fehler" zeigen kann. Betrifft nur wenige Zeilen.
export async function attachErrorInfo(rows: AnalysisTableRow[]): Promise<AnalysisTableRow[]> {
  const errorTickers = rows.filter((r) => r.status === 'error').map((r) => r.ticker)
  if (errorTickers.length === 0) return rows
  const { data, error } = await supabase.from('stock_analyses').select(ERROR_INFO_SELECT).in('ticker', errorTickers)
  if (error) {
    console.error('Fehlerinfo konnte nicht geladen werden:', error.message)
    return rows
  }
  const info = new Map(
    ((data ?? []) as { ticker: string; last_run_error_code: string | null; last_run_error_public: string | null }[]).map((d) => [
      d.ticker,
      d,
    ]),
  )
  return rows.map((r) => {
    const i = info.get(r.ticker)
    return i ? { ...r, error_code: i.last_run_error_code, error_public: i.last_run_error_public } : r
  })
}

// PDF einer Analyse: die volle Zeile wird nur fuer den Export geladen.
// Rueckgabe: Fehlermeldung oder null.
export async function downloadAnalysisPdf(ticker: string): Promise<string | null> {
  const { data, error } = await supabase.from('stock_analyses').select('*').eq('ticker', ticker).maybeSingle()
  if (error || !data) {
    console.error('PDF-Download fehlgeschlagen (vollständige Analyse konnte nicht geladen werden):', error)
    return `PDF für ${ticker} konnte nicht erstellt werden.`
  }
  generateAnalysisPdf(data)
  return null
}

// Ticker auf die Watchlist setzen (ohne die schon vorhandenen).
// Rueckgabe: Fehlermeldung oder null.
export async function addTickersToWatchlist(userId: string, tickers: string[]): Promise<string | null> {
  if (tickers.length === 0) return null
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('watchlists')
    .insert(tickers.map((ticker) => ({ user_id: userId, ticker, analysis_id: null, added_at: now })))
  if (error) {
    console.error('Watchlist insert fehlgeschlagen:', error)
    return error.message
  }
  return null
}

// Ticker von der Watchlist nehmen. Die Analysen bleiben, nur der Eintrag geht.
// .select('ticker') liefert die TATSAECHLICH geloeschten Zeilen zurueck: wird
// eine Zeile aus Berechtigungsgruenden uebersprungen, meldet Supabase keinen
// Fehler (siehe removalOutcome).
export async function removeTickersFromWatchlist(userId: string, tickers: string[]): Promise<RemovalResult> {
  const removed: string[] = []
  let dbError: string | null = null
  for (const part of chunk(tickers, REMOVE_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('watchlists')
      .delete()
      .eq('user_id', userId)
      .in('ticker', part)
      .select('ticker')
    if (error) {
      console.error('Watchlist delete fehlgeschlagen:', error)
      dbError = error.message
      break
    }
    removed.push(...((data ?? []) as { ticker: string }[]).map((r) => r.ticker))
  }
  return removalOutcome(tickers, removed, dbError)
}
