import type { StockAnalysis } from '../types/database'

export const PROGNOSE_MULTIPLES_NOTE =
  'Die Prognose ist mit Standard-Multiples gerechnet, ohne Anpassung an Reife und Wachstum des Unternehmens.'

export const KO_WITHOUT_NEWS_NOTE = 'K.O.-Kriterien ohne aktuelle News bewertet'

// Nur Laeufe mit data_flags (nach dem zugehoerigen Backend-Deploy) tragen einen
// news_status. Aeltere Zeilen haben keinen: dort wird kein Hinweis gezeigt,
// weil unbekannt ist, ob News vorlagen.
export function koWithoutNewsHint(analysis: Pick<StockAnalysis, 'chart_data'>): string | null {
  const status = analysis.chart_data?.data_flags?.news_status
  return status && status !== 'ok' ? KO_WITHOUT_NEWS_NOTE : null
}
