// Druckansicht (Stufe 1): Bereiche und Fusszeile, rein und testbar.
import { dataSourceLabel } from './memoFormat'
import { formatAnalysisDate } from './analysisRun'
import type { StockAnalysis } from '../types/database'

export const PRINT_SECTIONS = [
  { key: 'quickcheck', title: 'Quick-Check' },
  { key: 'qualitaet', title: 'Qualität' },
  { key: 'fundamental', title: 'Fundamental' },
  { key: 'ki', title: 'KI-Einschätzung' },
] as const

export function printFooterLines(analysis: StockAnalysis, printedAt: Date): string[] {
  const methodik = analysis.chart_data?.data_flags?.methodik_version
  return [
    `Datenquelle: ${dataSourceLabel(analysis.data_source)}`,
    `Analyse vom ${formatAnalysisDate(analysis.updated_at)}${methodik ? ` · Methodik ${methodik}` : ''}`,
    `Gedruckt am ${printedAt.toLocaleString('de-DE')}`,
    'Keine Anlageberatung. Nur für den Eigengebrauch; Weitergabe an Dritte erst nach Klärung der FMP-Lizenz.',
  ]
}
