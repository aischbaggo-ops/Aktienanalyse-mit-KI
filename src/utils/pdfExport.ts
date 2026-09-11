import { jsPDF } from 'jspdf'
import { ampelRgb } from '../lib/score'
import type { CriterionEntry, StockAnalysis, WarningEntry } from '../types/database'

const MARGIN_X = 18
const PAGE_BOTTOM = 280

function normalizeWarnings(warnings: StockAnalysis['warnings']): string[] {
  if (!Array.isArray(warnings)) return []
  return warnings
    .map((w) => (typeof w === 'string' ? w : (w as WarningEntry | null)?.text))
    .filter((w): w is string => Boolean(w))
}

function formatDrawdown(value: number | null): string {
  return value != null ? `-${(Math.abs(value) * 100).toFixed(1)}%` : 'keine Daten'
}

/**
 * Baut ein textbasiertes PDF aus einer vollstaendig geladenen stock_analyses-Zeile
 * und loest den Download im Browser aus. Wird sowohl von der Detailseite als auch
 * von den Listen-Eintraegen im Dashboard verwendet.
 */
export function generateAnalysisPdf(analysis: StockAnalysis): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - MARGIN_X * 2
  let y = 20

  function ensureSpace(next: number) {
    if (y + next > PAGE_BOTTOM) {
      doc.addPage()
      y = 20
    }
  }

  function heading(text: string) {
    ensureSpace(10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(20, 20, 20)
    doc.text(text, MARGIN_X, y)
    y += 7
  }

  // --- Kopfzeile ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.text(analysis.ticker, MARGIN_X, y)
  y += 7

  if (analysis.company_name) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.text(analysis.company_name, MARGIN_X, y)
    y += 6
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  const metaLine = [
    analysis.sector ?? undefined,
    analysis.current_price != null
      ? `Kurs: ${analysis.current_price.toFixed(2)} ${analysis.currency ?? ''}`
      : undefined,
    `Analyse vom ${new Date(analysis.updated_at).toLocaleDateString('de-DE')}`,
  ]
    .filter(Boolean)
    .join('   ·   ')
  doc.text(metaLine, MARGIN_X, y)
  y += 8

  doc.setDrawColor(210)
  doc.line(MARGIN_X, y, pageWidth - MARGIN_X, y)
  y += 8

  // --- Scores ---
  heading('Scores')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(20, 20, 20)
  doc.text(`Gesamt-Score: ${analysis.score_total ?? '–'} / 100`, MARGIN_X, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const subScores: [string, number | null][] = [
    ['Fundamental', analysis.score_fundamental],
    ['Qualität', analysis.score_qualitaet],
    ['Krise', analysis.score_krise],
    ['Trend', analysis.score_trend],
  ]
  subScores.forEach(([label, value]) => {
    ensureSpace(6)
    doc.text(`${label}: ${value ?? '–'}`, MARGIN_X + 4, y)
    y += 6
  })
  if (analysis.score_stabilitaet != null) {
    ensureSpace(6)
    doc.text(`Stabilität: ${analysis.score_stabilitaet}`, MARGIN_X + 4, y)
    y += 6
  }
  y += 4

  // --- Warnungen ---
  const warnings = normalizeWarnings(analysis.warnings)
  if (warnings.length > 0) {
    heading('Warnungen')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(160, 90, 0)
    warnings.forEach((w) => {
      const lines = doc.splitTextToSize(`⚠ ${w}`, contentWidth)
      ensureSpace(lines.length * 5 + 1)
      doc.text(lines, MARGIN_X, y)
      y += lines.length * 5 + 1
    })
    doc.setTextColor(20, 20, 20)
    y += 4
  }

  // --- Fazit ---
  if (analysis.fazit) {
    heading('Fazit')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(40, 40, 40)
    const lines = doc.splitTextToSize(analysis.fazit, contentWidth)
    ensureSpace(lines.length * 5)
    doc.text(lines, MARGIN_X, y)
    y += lines.length * 5 + 6
    doc.setTextColor(20, 20, 20)
  }

  // --- Kriterien (gruppiert nach dimension) ---
  const criteria = Array.isArray(analysis.criteria) ? analysis.criteria.filter(Boolean) : []
  if (criteria.length > 0) {
    heading('Kriterien')

    const groups = criteria.reduce<Record<string, CriterionEntry[]>>((acc, c) => {
      const key = c.dimension || 'Sonstiges'
      acc[key] = acc[key] ? [...acc[key], c] : [c]
      return acc
    }, {})

    Object.entries(groups).forEach(([dimension, items]) => {
      ensureSpace(8)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(20, 20, 20)
      doc.text(dimension, MARGIN_X, y)
      y += 6

      items.forEach((c) => {
        ensureSpace(6)
        const color = ampelRgb(c.ampel)
        doc.setFillColor(color[0], color[1], color[2])
        doc.circle(MARGIN_X + 1.5, y - 1.5, 1.4, 'F')

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(20, 20, 20)
        doc.text(c.name, MARGIN_X + 6, y)
        y += 5

        if (c.begruendung) {
          const lines = doc.splitTextToSize(c.begruendung, contentWidth - 6)
          ensureSpace(lines.length * 4.5)
          doc.setFontSize(9)
          doc.setTextColor(110, 110, 110)
          doc.text(lines, MARGIN_X + 6, y)
          y += lines.length * 4.5 + 2
          doc.setTextColor(20, 20, 20)
        }
      })
      y += 3
    })
    y += 3
  }

  // --- Bewertung (DCF) ---
  const dcfValue = analysis.bewertung?.dcf?.dcf ?? null
  const dcfStockPrice = analysis.bewertung?.dcf?.['Stock Price'] ?? null
  if (dcfValue != null) {
    heading('Bewertung (DCF)')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(40, 40, 40)
    const currency = analysis.bewertung?.currency ?? analysis.currency ?? ''
    doc.text(`DCF-Wert: ${dcfValue.toFixed(2)} ${currency}`, MARGIN_X, y)
    y += 6
    if (dcfStockPrice != null) {
      doc.text(`Kurs bei Bewertung: ${dcfStockPrice.toFixed(2)} ${currency}`, MARGIN_X, y)
      y += 6
      if (dcfStockPrice !== 0) {
        const upside = ((dcfValue - dcfStockPrice) / dcfStockPrice) * 100
        doc.text(
          `Differenz zum Kurs: ${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`,
          MARGIN_X,
          y
        )
        y += 6
      }
    }
    doc.setTextColor(20, 20, 20)
    y += 4
  }

  // --- Krisenfenster (nur als Text/Tabelle, kein Chart) ---
  const krise = Array.isArray(analysis.chart_data?.krise) ? analysis.chart_data!.krise! : []
  if (krise.length > 0) {
    heading('Krisenverhalten — Drawdown Aktie vs. S&P 500')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(40, 40, 40)
    krise.forEach((k) => {
      ensureSpace(6)
      const line = `${k.name}: Aktie ${formatDrawdown(k.ddStock)}   ·   S&P 500 ${formatDrawdown(
        k.ddIndex
      )}`
      doc.text(line, MARGIN_X, y)
      y += 6
    })
    doc.setTextColor(20, 20, 20)
    y += 4
  }

  // --- Fussnote ---
  ensureSpace(14)
  doc.setDrawColor(210)
  doc.line(MARGIN_X, y, pageWidth - MARGIN_X, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(130, 130, 130)
  const footerLine = [
    `Datenquelle: ${analysis.data_source ?? '–'}`,
    analysis.cost_usd_claude != null
      ? `Kosten (Claude): $${analysis.cost_usd_claude.toFixed(4)}`
      : undefined,
    `Aktualisiert: ${new Date(analysis.updated_at).toLocaleString('de-DE')}`,
  ]
    .filter(Boolean)
    .join('   ·   ')
  doc.text(footerLine, MARGIN_X, y)

  const dateStr = analysis.updated_at.slice(0, 10)
  doc.save(`${analysis.ticker}_Analyse_${dateStr}.pdf`)
}
