import { jsPDF, GState } from 'jspdf'
import { MEMO_PLUS, MEMO_MINUS, MEMO_GRAU } from '../lib/memoColors.js'
import { fmtMoney, fmtCompact, fmtPct, dash, formatMarketCap } from '../lib/memoFormat'
import { scoreLabel } from '../lib/score'
import type { CriterionEntry, StockAnalysis, WarningEntry } from '../types/database'

type RGB = [number, number, number]

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const INK: RGB = [26, 26, 26]
const MUTED: RGB = [153, 153, 153]
const LINE2: RGB = [221, 221, 221]
const PLUS = hexToRgb(MEMO_PLUS)
const MINUS = hexToRgb(MEMO_MINUS)
const GRAU = hexToRgb(MEMO_GRAU)
const YELLOW: RGB = [234, 179, 8]

const MARGIN_X = 18
const PAGE_TOP = 20
const PAGE_BOTTOM = 280

// Dieselben 4 Dimensionen/derselbe Reihenfolge wie RADAR_DIMENSIONS in
// AnalysePage.tsx (Qualitaet/Fundamental/Krise/Trend - Stabilitaet ist
// bewusst nicht Teil des Kopfbereich-Radars, siehe dort).
const RADAR_DIMENSIONS = [
  { key: 'score_qualitaet', label: 'Qualität' },
  { key: 'score_fundamental', label: 'Fundamental' },
  { key: 'score_krise', label: 'Krise' },
  { key: 'score_trend', label: 'Trend' },
] as const satisfies { key: keyof StockAnalysis; label: string }[]

function ampelDotColor(ampel: string | undefined): RGB {
  switch (ampel) {
    case 'gruen':
      return PLUS
    case 'gelb':
      return YELLOW
    case 'rot':
      return MINUS
    default:
      return GRAU
  }
}

function scoreBandColor(score: number | null | undefined): RGB {
  if (score === null || score === undefined) return GRAU
  if (score >= 70) return PLUS
  if (score >= 40) return YELLOW
  return MINUS
}

function normalizeWarnings(warnings: StockAnalysis['warnings']): string[] {
  if (!Array.isArray(warnings)) return []
  return warnings
    .map((w) => (typeof w === 'string' ? w : (w as WarningEntry | null)?.text))
    .filter((w): w is string => Boolean(w))
}

// jsPDF-Standardfonts (Helvetica/Times) unterstuetzen nur WinAnsi-Encoding
// (~Latin-1) - Pfeilsymbole (U+2191/2193) faellen ausserhalb und wuerden
// als falsches Glyph gerendert, daher ASCII-Ersatz statt der App-Pfeile.
function directionArrow(action: string): string {
  if (action === 'upgrade') return '+'
  if (action === 'downgrade') return '-'
  return '–'
}

function endpointAndYearAgo<T extends { date: string }>(points: T[]): { latest: T | null; yearAgo: T | null } {
  if (points.length === 0) return { latest: null, yearAgo: null }
  const latest = points[points.length - 1]
  const yearAgo = points.length > 12 ? points[points.length - 13] : points[0]
  return { latest, yearAgo }
}

/**
 * Baut ein eigenstaendiges, mehrseitiges PDF (eine Seite pro App-Tab) aus
 * einer vollstaendig geladenen stock_analyses-Zeile. Spiegelt Design
 * (Papier/Ink, Serif fuer Identitaet/Kennzahlen, Memo-Farbpalette) und
 * Informationsgehalt (Kopfbereich + Quick-Check/Qualitaet/Fundamental/
 * KI-Einschaetzung-Tabs) der App wider - Linien-/Balken-Charts werden dabei
 * bewusst als kompakte Kennzahlen-Tabellen (aktuell + Vorjahr bzw.
 * Endwert) statt als Vektor-Nachbau dargestellt, mit Ausnahme des
 * Kopfbereich-Radars (gleiche Polygon-Geometrie wie AnalysePage.tsx).
 * Firmenlogo bewusst weggelassen (kein Bild-Fetch/CORS im Export).
 * Separat von generateAnalysisPdf() gehalten, damit Tests/Skripte das
 * jsPDF-Dokument bauen koennen, ohne den Browser-Download auszuloesen.
 */
export function buildAnalysisPdf(analysis: StockAnalysis): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - MARGIN_X * 2
  const currency = analysis.currency ?? ''
  let y = PAGE_TOP

  function ensureSpace(next: number) {
    if (y + next > PAGE_BOTTOM) {
      doc.addPage()
      y = PAGE_TOP
    }
  }

  function newPage() {
    doc.addPage()
    y = PAGE_TOP
  }

  function setColor(rgb: RGB) {
    doc.setTextColor(rgb[0], rgb[1], rgb[2])
  }

  function pageTitle(text: string) {
    ensureSpace(16)
    doc.setFont('times', 'bold')
    doc.setFontSize(17)
    setColor(INK)
    doc.text(text, MARGIN_X, y)
    y += 8
    doc.setDrawColor(LINE2[0], LINE2[1], LINE2[2])
    doc.setLineWidth(0.2)
    doc.line(MARGIN_X, y, pageWidth - MARGIN_X, y)
    y += 8
  }

  function sectionLabel(text: string) {
    ensureSpace(8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setColor(MUTED)
    doc.text(text.toUpperCase(), MARGIN_X, y)
    y += 6
    setColor(INK)
  }

  function bodyText(text: string, opts: { size?: number; color?: RGB; font?: 'times' | 'helvetica'; style?: 'normal' | 'bold' | 'italic' } = {}) {
    const { size = 10, color = INK, font = 'helvetica', style = 'normal' } = opts
    doc.setFont(font, style)
    doc.setFontSize(size)
    setColor(color)
    const lines = doc.splitTextToSize(text, contentWidth)
    const lh = size * 0.45
    ensureSpace(lines.length * lh + 1)
    doc.text(lines, MARGIN_X, y)
    y += lines.length * lh + 2
  }

  function bulletList(items: string[]) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    if (items.length === 0) {
      setColor(MUTED)
      ensureSpace(5)
      doc.text('–', MARGIN_X, y)
      y += 5
      return
    }
    setColor(INK)
    items.forEach((item) => {
      const lines = doc.splitTextToSize(`· ${item}`, contentWidth)
      ensureSpace(lines.length * 4.5 + 0.5)
      doc.text(lines, MARGIN_X, y)
      y += lines.length * 4.5 + 0.5
    })
  }

  function divider() {
    ensureSpace(3)
    doc.setDrawColor(LINE2[0], LINE2[1], LINE2[2])
    doc.setLineWidth(0.15)
    doc.line(MARGIN_X, y, pageWidth - MARGIN_X, y)
    y += 3
  }

  // Kompakte Label/Wert-Zeile: Label sans links, Wert rechtsbuendig (serif,
  // wenn es sich um eine "Headline-Kennzahl" handelt, sonst sans - wie in
  // der App: FairValue/EV-Umsatz/Bewertungsverfahren-Werte sind font-
  // analyst, Quick-Check-/Bank-Werte sind normale Schrift).
  function kvRow(label: string, value: string, opts: { sub?: string; valueColor?: RGB; serifValue?: boolean } = {}) {
    const { sub, valueColor = INK, serifValue = false } = opts
    ensureSpace(sub ? 10 : 6.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    setColor(INK)
    doc.text(label, MARGIN_X, y)
    doc.setFont(serifValue ? 'times' : 'helvetica', serifValue ? 'bold' : 'normal')
    setColor(valueColor)
    doc.text(value, pageWidth - MARGIN_X, y, { align: 'right' })
    y += 5.5
    if (sub) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      setColor(MUTED)
      doc.text(sub, pageWidth - MARGIN_X, y, { align: 'right' })
      y += 4.5
    }
    divider()
  }

  // Wie kvRow(), aber mit einem farbigen Punkt vor dem Label statt einem
  // Text-Marker (✓/✕ liegen ausserhalb WinAnsi und wuerden falsch
  // gerendert, siehe directionArrow()-Kommentar).
  function kvRowDot(label: string, dotColor: RGB, value: string, opts: { valueColor?: RGB } = {}) {
    ensureSpace(6.5)
    doc.setFillColor(dotColor[0], dotColor[1], dotColor[2])
    doc.circle(MARGIN_X + 1.3, y - 1.3, 1.3, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    setColor(INK)
    doc.text(label, MARGIN_X + 5, y)
    setColor(opts.valueColor ?? INK)
    doc.text(value, pageWidth - MARGIN_X, y, { align: 'right' })
    y += 5.5
    divider()
  }

  function drawRadar(cx: number, cy: number, rOuter: number, values: (number | null)[], bandColor: RGB) {
    const angles = [-90, 0, 90, 180]
    const point = (r: number, angleDeg: number): [number, number] => {
      const rad = (angleDeg * Math.PI) / 180
      return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
    }
    const gridPts = angles.map((a) => point(rOuter, a))
    doc.setDrawColor(LINE2[0], LINE2[1], LINE2[2])
    doc.setLineWidth(0.2)
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = gridPts[i]
      const [x2, y2] = gridPts[(i + 1) % 4]
      doc.line(x1, y1, x2, y2)
    }

    const dataPts = angles.map((a, i) => {
      const v = values[i]
      const r = v !== null && v !== undefined ? (Math.max(0, Math.min(100, v)) / 100) * rOuter : 0
      return point(r, a)
    })
    doc.saveGraphicsState()
    doc.setGState(new GState({ opacity: 0.15 }))
    doc.setFillColor(bandColor[0], bandColor[1], bandColor[2])
    const relSegments = dataPts.slice(1).map((p, i) => [p[0] - dataPts[i][0], p[1] - dataPts[i][1]])
    doc.lines(relSegments, dataPts[0][0], dataPts[0][1], [1, 1], 'F', true)
    doc.restoreGraphicsState()

    doc.setDrawColor(bandColor[0], bandColor[1], bandColor[2])
    doc.setLineWidth(0.5)
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = dataPts[i]
      const [x2, y2] = dataPts[(i + 1) % 4]
      doc.line(x1, y1, x2, y2)
    }
  }

  // ===================== Seite 1: Kopfbereich + Quick-Check =====================

  const score = analysis.score_total
  const meta = analysis.chart_data?.profileMeta
  const marketCapText = formatMarketCap(meta?.marketCap, analysis.currency)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setColor(MUTED)
  doc.text(
    `${analysis.ticker}${analysis.sector ? ` · ${analysis.sector.toUpperCase()}` : ''}`,
    MARGIN_X,
    y
  )
  doc.setFont('times', 'bold')
  doc.setFontSize(9)
  doc.text('SCORE', pageWidth - MARGIN_X, y, { align: 'right' })
  y += 8

  doc.setFont('times', 'bold')
  doc.setFontSize(20)
  setColor(INK)
  doc.text(analysis.company_name ?? analysis.ticker, MARGIN_X, y)
  doc.setFontSize(22)
  doc.text(score != null ? score.toFixed(0) : '–', pageWidth - MARGIN_X, y, { align: 'right' })
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setColor(scoreBandColor(score))
  doc.text(scoreLabel(score), pageWidth - MARGIN_X, y, { align: 'right' })
  y += 6

  if (marketCapText || meta?.industry || meta?.exchange) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setColor(MUTED)
    const metaParts = [
      marketCapText ? `Marktkap. ${marketCapText}` : null,
      meta?.industry ? `Segment ${meta.industry}` : null,
      meta?.exchange ? `Börse ${meta.exchange}` : null,
    ].filter((p): p is string => Boolean(p))
    doc.text(metaParts.join('   ·   '), MARGIN_X, y)
    y += 8
  }

  divider()
  y += 4

  // Radar (links) + Legende (rechts daneben), gleiche Geometrie wie im
  // App-Kopfbereich.
  const radarValues = RADAR_DIMENSIONS.map((d) => analysis[d.key] as number | null)
  const radarCx = MARGIN_X + 16
  const radarCy = y + 16
  ensureSpace(36)
  drawRadar(radarCx, radarCy, 14, radarValues, scoreBandColor(score))
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  let legendY = y + 6
  RADAR_DIMENSIONS.forEach((d, i) => {
    const v = radarValues[i]
    const c = scoreBandColor(v)
    doc.setFillColor(c[0], c[1], c[2])
    doc.circle(MARGIN_X + 38, legendY - 1.2, 1.2, 'F')
    setColor(INK)
    doc.text(`${d.label} ${v != null ? v.toFixed(0) : '–'}`, MARGIN_X + 42, legendY)
    legendY += 5.5
  })
  y += 36

  const warnings = normalizeWarnings(analysis.warnings)
  if (warnings.length > 0) {
    sectionLabel('Warnungen')
    warnings.forEach((w) => bodyText(w, { color: MINUS, style: 'bold' }))
    y += 2
  }

  pageTitle('Quick-Check')

  const qc = analysis.chart_data?.quickCheck
  const priceMonthly = analysis.chart_data?.priceMonthly?.stock ?? []
  const returnBars = analysis.chart_data?.returnBars ?? []
  const relStrength = analysis.chart_data?.relativeStrength ?? []

  sectionLabel('Vorfilter')
  const qcRows: { label: string; pass: boolean | null; value: string }[] = [
    { label: 'Kein Penny-Stock', pass: qc?.kein_penny_stock?.pass ?? null, value: fmtMoney(qc?.kein_penny_stock?.wert, currency) },
    { label: 'Liquidität', pass: qc?.liquiditaet?.pass ?? null, value: qc?.liquiditaet?.wert != null ? `${fmtCompact(qc.liquiditaet.wert)} Stk./Tag` : dash() },
    { label: 'Marktkap.-Klasse', pass: qc?.marktkap_klasse?.pass ?? null, value: qc?.marktkap_klasse?.klasse ?? dash() },
    { label: 'Aufwärtstrend', pass: qc?.aufwaertstrend?.pass ?? null, value: fmtPct(qc?.aufwaertstrend?.wert) },
  ]
  qcRows.forEach((r) => {
    const color = r.pass === null ? GRAU : r.pass ? PLUS : MINUS
    kvRowDot(r.label, color, r.value, { valueColor: color })
  })
  y += 2

  sectionLabel('Kursverlauf')
  if (priceMonthly.length > 0) {
    const { latest, yearAgo } = endpointAndYearAgo(priceMonthly)
    const change = latest && yearAgo && yearAgo.close !== 0 ? ((latest.close - yearAgo.close) / yearAgo.close) * 100 : null
    bodyText(
      `Aktuell: ${fmtMoney(latest?.close ?? null, currency)} (${latest?.date ?? '–'})   ·   vor 12 Monaten: ${fmtMoney(yearAgo?.close ?? null, currency)}${change != null ? `   ·   Veränderung: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : ''}`
    )
  } else {
    bodyText('Keine Kursdaten verfügbar.', { color: GRAU })
  }
  y += 2

  sectionLabel('Kursgewinn- und Drawdown-Phasen (jährlich)')
  if (returnBars.length > 0) {
    returnBars.forEach((rb) => {
      kvRow(rb.period, `${rb.pct >= 0 ? '+' : ''}${rb.pct.toFixed(1)}%`, { valueColor: rb.pct >= 0 ? PLUS : MINUS })
    })
  } else {
    bodyText('Keine Daten verfügbar.', { color: GRAU })
  }
  y += 2

  sectionLabel('Relative Stärke vs. S&P 500')
  if (relStrength.length > 0) {
    const latestRs = relStrength[relStrength.length - 1]
    bodyText(`Aktuell (indexiert = 100 am Beginn der Historie): ${latestRs.value.toFixed(1)} (${latestRs.date})`)
  } else {
    bodyText('Keine Daten verfügbar.', { color: GRAU })
  }

  // ===================== Seite 2: Qualität =====================

  newPage()
  pageTitle('Qualität')

  const swot = analysis.chart_data?.swot
  const noGoHart = analysis.chart_data?.no_go_hart === true
  const qualitaetKriterien = (analysis.criteria ?? []).filter((c) => c.dimension === 'Qualitaet')
  const KO_NAMES = ['Keine Skandale', 'Keine schweren Vorwuerfe gegen Unternehmen', 'Keine schweren Vorwuerfe gegen Management']
  const koVerletzt = qualitaetKriterien.filter((c) => KO_NAMES.includes(c.name) && c.ampel === 'rot')

  sectionLabel('SWOT — Stärken')
  bulletList(swot?.staerken ?? [])
  y += 2
  sectionLabel('SWOT — Schwächen')
  bulletList(swot?.schwaechen ?? [])
  y += 2
  sectionLabel('SWOT — Chancen')
  bulletList(swot?.chancen ?? [])
  y += 2
  sectionLabel('SWOT — Risiken')
  bulletList(swot?.risiken ?? [])
  y += 4

  sectionLabel('Härtegrad')
  const haertegradCounts = new Map<string, number>()
  function haertegradKategorie(c: CriterionEntry): string {
    if (c.haertegrad && typeof c.haertegrad === 'string') return c.haertegrad as string
    if (c.optional) return 'Bonus'
    if (typeof c.name === 'string' && c.name.includes(' ODER ')) return 'Entweder-oder'
    return 'Normal'
  }
  qualitaetKriterien.forEach((c) => {
    const key = haertegradKategorie(c)
    haertegradCounts.set(key, (haertegradCounts.get(key) ?? 0) + 1)
  })
  const haertegradOrder = ['Streng', 'Normal', 'Soft', 'Entweder-oder', 'Bonus']
  const haertegradKeys = [...haertegradCounts.keys()].sort((a, b) => haertegradOrder.indexOf(a) - haertegradOrder.indexOf(b))
  bodyText(
    haertegradKeys.length > 0 ? haertegradKeys.map((k) => `${k} · ${haertegradCounts.get(k)}`).join('   ') : '–',
    { color: MUTED }
  )
  y += 2

  sectionLabel('K.O.-Kriterien')
  if (koVerletzt.length > 0) {
    koVerletzt.forEach((c) => bodyText(`K.O. verletzt: ${c.name}`, { color: MINUS, style: 'bold' }))
    y += 1
  } else {
    bodyText('Keine verletzt', { color: MUTED })
    if (noGoHart) bodyText('Hinweis: no_go_hart-Flag gesetzt, aber kein K.O.-Kriterium rot.', { size: 8, color: MINUS })
  }
  y += 3

  sectionLabel('Kriterien')
  if (qualitaetKriterien.length > 0) {
    qualitaetKriterien.forEach((c) => {
      ensureSpace(6)
      const dotColor = ampelDotColor(c.ampel)
      doc.setFillColor(dotColor[0], dotColor[1], dotColor[2])
      doc.circle(MARGIN_X + 1.3, y - 1.3, 1.3, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      setColor(INK)
      doc.text(c.name, MARGIN_X + 5, y)
      y += 5
      if (c.begruendung) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        setColor(MUTED)
        const lines = doc.splitTextToSize(c.begruendung, contentWidth - 5)
        ensureSpace(lines.length * 4)
        doc.text(lines, MARGIN_X + 5, y)
        y += lines.length * 4 + 2
      }
    })
  } else {
    bodyText('Keine Kriterien verfügbar.', { color: GRAU })
  }

  // ===================== Seite 3: Fundamental =====================

  newPage()
  pageTitle('Fundamental')

  const fs = analysis.chart_data?.fundamentalSeries
  const valuation = analysis.bewertung?.valuation
  const fairValue = valuation?.fair_value

  sectionLabel('Fair Value (Ø-KGV/KCV + DCF)')
  if (fairValue && fairValue.value != null) {
    const k = fairValue.kontext
    const kontextParts = [
      k.avg_kgv != null ? `Ø-KGV ${k.avg_kgv.toFixed(1)}×` : null,
      k.avg_kcv != null ? `Ø-KCV ${k.avg_kcv.toFixed(1)}×` : null,
      k.dcf != null ? `DCF ${fmtMoney(k.dcf, currency)}` : null,
    ]
      .filter((p): p is string => p !== null)
      .join(' · ')
    const sub = [
      fairValue.abweichung_pct != null ? `Kurs ${fmtPct(fairValue.abweichung_pct)} vs. Fair Value` : null,
      kontextParts || null,
      k.jahre ? `Basis: ${k.jahre} Jahre Historie` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    kvRow(fairValue.label, fmtMoney(fairValue.value, currency), { sub, serifValue: true })
  } else {
    kvRow(fairValue?.label ?? 'keine Bewertung möglich', dash(), { serifValue: true, valueColor: GRAU })
  }
  y += 2

  sectionLabel('EV/Umsatz')
  const evUmsatz = valuation?.ev_umsatz
  kvRow(evUmsatz?.label ?? 'keine Bewertung möglich', evUmsatz?.value != null ? `${evUmsatz.value.toFixed(1)}×` : dash(), { serifValue: true })
  if (valuation?.verfuegbar === false && valuation.hinweis) {
    bodyText(valuation.hinweis, { size: 8, color: GRAU })
  }
  y += 3

  function fundamentalRow(label: string, values: (number | null)[]) {
    const latest = values.length > 0 ? values[values.length - 1] : null
    const prior = values.length > 1 ? values[values.length - 2] : null
    kvRow(label, fmtCompact(latest, currency), { sub: prior != null ? `Vorjahr: ${fmtCompact(prior, currency)}` : undefined })
  }

  if (fs) {
    sectionLabel('Bruttogewinn / EBIT / EBITDA / Nettogewinn')
    fundamentalRow('Bruttogewinn', fs.grossProfit)
    fundamentalRow('EBIT', fs.ebit)
    fundamentalRow('EBITDA', fs.ebitda)
    fundamentalRow('Nettogewinn', fs.netIncome)
    y += 2

    sectionLabel('Details')
    fundamentalRow('Operativer Cashflow', fs.operatingCashFlow)
    fundamentalRow('Free Cashflow', fs.freeCashFlow)
    const latestMargin = (arr: (number | null)[]) => (arr.length > 0 ? arr[arr.length - 1] : null)
    kvRow('Bruttomarge', fmtPct(latestMargin(fs.grossMargin)))
    kvRow('Operative Marge', fmtPct(latestMargin(fs.operatingMargin)))
    kvRow('Nettomarge', fmtPct(latestMargin(fs.netMargin)))
    if (fs.goodwill.some((v) => v != null && v !== 0)) fundamentalRow('Goodwill', fs.goodwill)
    fundamentalRow('Aktienanzahl', fs.sharesOut)
    fundamentalRow('Schulden (brutto)', fs.totalDebt)
    if (fs.isDividendPayer) fundamentalRow('Dividenden', fs.dividendsPaid)
  } else {
    bodyText('Keine Fundamentaldaten verfügbar.', { color: GRAU })
  }

  // ===================== Seite 4: KI-Einschätzung =====================

  newPage()
  pageTitle('KI-Einschätzung')

  const prognose = analysis.prognose
  const dcf = analysis.bewertung?.dcf
  const swot2 = analysis.chart_data?.swot
  const analystConsensus = analysis.chart_data?.analystConsensus
  const bankRatings = analysis.chart_data?.bankRatings ?? []

  sectionLabel('Erwartungskorridor (Bär / Basis / Bull)')
  if (prognose?.verfuegbar && prognose.baer && prognose.basis && prognose.bull) {
    ;([
      ['Bär', prognose.baer],
      ['Basis', prognose.basis],
      ['Bull', prognose.bull],
    ] as const).forEach(([label, szenario]) => {
      kvRow(label, fmtMoney(szenario.fair_value_heute, currency), {
        sub: `Wahrscheinlichkeit: ${(szenario.wahrscheinlichkeit * 100).toFixed(0)}%`,
        serifValue: true,
      })
    })
  } else {
    bodyText(prognose?.hinweis ?? 'Kein Erwartungskorridor berechenbar (fehlende Analysten-Schätzungen).', { color: GRAU })
  }
  y += 2

  sectionLabel('Bewertungsverfahren im Vergleich')
  const basisFairValue = prognose?.verfuegbar ? prognose.basis?.fair_value_heute ?? null : null
  const baerFairValue = prognose?.verfuegbar ? prognose.baer?.fair_value_heute ?? null : null
  const bullFairValue = prognose?.verfuegbar ? prognose.bull?.fair_value_heute ?? null : null
  const verfahren: { label: string; wert: string; sub?: string }[] = [
    {
      label: 'Eigenes Modell (Fair Value heute)',
      wert: basisFairValue != null ? fmtMoney(basisFairValue, currency) : dash(),
      sub: baerFairValue != null && bullFairValue != null ? `Bär ${fmtMoney(baerFairValue, currency)} – Bull ${fmtMoney(bullFairValue, currency)}` : undefined,
    },
    {
      label: 'Analysten-Kursziel (Konsens)',
      wert: analystConsensus != null ? fmtMoney(analystConsensus.target, currency) : dash(),
      sub: analystConsensus != null ? `Ø aus ${analystConsensus.count} Schätzungen, 12-Monats-Horizont` : undefined,
    },
    { label: 'Peer-Bewertung', wert: dash() },
    {
      label: 'DCF (heutiger Fair Value)',
      wert: dcf?.dcf != null ? fmtMoney(dcf.dcf, dcf['Stock Price'] != null ? currency : '') : dash(),
    },
  ]
  verfahren.forEach((v) => kvRow(v.label, v.wert, { sub: v.sub, serifValue: true }))
  bodyText(
    'Die vier Verfahren beziehen sich auf unterschiedliche Zeithorizonte und sind daher nicht direkt gegeneinander aufrechenbar.',
    { size: 8, color: MUTED }
  )
  y += 2

  if (bankRatings.length > 0) {
    sectionLabel('Einschätzung führender Banken')
    bankRatings.forEach((r) => {
      const sub = (r.action === 'upgrade' || r.action === 'downgrade') && r.previousGrade
        ? `${r.action === 'upgrade' ? 'hochgestuft von' : 'abgestuft von'} ${r.previousGrade}`
        : undefined
      kvRow(r.company, `${directionArrow(r.action)}  ${r.grade}`, { sub })
    })
    y += 2
  }

  sectionLabel('Rückenwind')
  bulletList(swot2?.chancen ?? [])
  y += 2
  sectionLabel('Gegenwind')
  bulletList(swot2?.risiken ?? [])
  y += 4

  if (!prognose?.verfuegbar) {
    bodyText('Kein belastbarer Zielkurs berechenbar — fehlende Analysten-Schätzungen oder Fundamentaldaten.', {
      font: 'times',
      style: 'italic',
      color: GRAU,
      size: 9,
    })
  }
  ensureSpace(14)
  doc.setDrawColor(INK[0], INK[1], INK[2])
  doc.setLineWidth(0.8)
  const fazitYStart = y
  doc.setFont('times', 'normal')
  doc.setFontSize(12)
  setColor(INK)
  const fazitLines = doc.splitTextToSize(analysis.fazit ?? 'Kein Fazit verfügbar.', contentWidth - 6)
  doc.text(fazitLines, MARGIN_X + 5, y)
  y += fazitLines.length * 5.5 + 2
  doc.line(MARGIN_X, fazitYStart - 4, MARGIN_X, y - 4)
  y += 4

  divider()
  y += 2
  bodyText(
    'Diese Einschätzung wird automatisiert durch ein KI-Modell erstellt, basiert auf öffentlich verfügbaren Daten und stellt keine Anlageberatung dar. Modellannahmen (u.a. Wahrscheinlichkeits-Gewichtung Bär/Basis/Bull, Bewertungsmultiplikatoren) sind eigene Setzungen, keine Garantie für zukünftige Kursentwicklung. Valuation-Kennzahlen (KGV/KCV/EV-Umsatz) verwenden pauschale, branchenunabhängige Schwellenwerte.',
    { size: 8, color: MUTED }
  )

  // ===================== Fußnote + Seitenzahlen =====================

  const footerLine = [
    `Datenquelle: ${analysis.data_source ?? '–'}`,
    analysis.cost_usd_claude != null ? `Kosten (Claude): $${analysis.cost_usd_claude.toFixed(4)}` : undefined,
    `Aktualisiert: ${new Date(analysis.updated_at).toLocaleString('de-DE')}`,
  ]
    .filter(Boolean)
    .join('   ·   ')

  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setColor(MUTED)
    doc.text(`Seite ${p} von ${pageCount}`, pageWidth - MARGIN_X, PAGE_BOTTOM + 8, { align: 'right' })
    if (p === pageCount) {
      doc.text(footerLine, MARGIN_X, PAGE_BOTTOM + 8)
    }
  }

  return doc
}

export function generateAnalysisPdf(analysis: StockAnalysis): void {
  const doc = buildAnalysisPdf(analysis)
  const dateStr = analysis.updated_at.slice(0, 10)
  doc.save(`${analysis.ticker}_Analyse_${dateStr}.pdf`)
}
