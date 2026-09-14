import { MEMO_PLUS, MEMO_MINUS, MEMO_GRAU } from './memoColors.js'

export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return '#64748b'
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#eab308'
  return '#ef4444'
}

// Viergliedriges Einordnungswort fuer den Analyse-Kopfbereich - nutzt
// dieselben Bandgrenzen wie scoreColor() (70/40), unterteilt das
// bestehende Gruen-Band zusaetzlich bei 85 in "Stark"/"Solide". Bewusst
// getrennt von scoreColor()s Farbwerten (alte, kraeftige Ampelfarben) -
// die Analyse-Kopfzeile nutzt die gedaempfte Memo-Palette, siehe
// scoreLabelColorClass()/scoreBandHex() weiter unten.
export function scoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return '–'
  if (score >= 85) return 'Stark'
  if (score >= 70) return 'Solide'
  if (score >= 40) return 'Durchschnittlich'
  return 'Schwach'
}

// Tailwind-Textfarbklasse fuer scoreLabel() bzw. beliebige 0-100-Scores im
// Analyse-Kopfbereich, gedaempfte Memo-Palette statt scoreColor()s kraeftiger
// Ampelfarben. Gelb bleibt bewusst die neutrale funktionale Ampelfarbe (wie
// bereits in DashboardPage.scoreBorderClass()) - es gibt keine eigene
// "memo-gelb"-Markenfarbe.
export function scoreLabelColorClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-memo-grau'
  if (score >= 70) return 'text-memo-plus'
  if (score >= 40) return 'text-ampel-yellow'
  return 'text-memo-minus'
}

// Rohe Hex-Werte derselben Baender, fuer Inline-SVG (Radar-Chart), wo
// Tailwind-Utility-Klassen nicht greifen.
export function scoreBandHex(score: number | null | undefined): string {
  if (score === null || score === undefined) return MEMO_GRAU
  if (score >= 70) return MEMO_PLUS
  if (score >= 40) return '#eab308'
  return MEMO_MINUS
}

export function scoreBandFill(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'rgba(120,90,156,0.15)'
  if (score >= 70) return 'rgba(53,122,56,0.15)'
  if (score >= 40) return 'rgba(234,179,8,0.15)'
  return 'rgba(194,67,28,0.15)'
}

export function scoreTextClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-slate-500'
  if (score >= 70) return 'text-ampel-green'
  if (score >= 40) return 'text-ampel-yellow'
  return 'text-ampel-red'
}

export function scoreBgClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'bg-slate-200'
  if (score >= 70) return 'bg-ampel-green'
  if (score >= 40) return 'bg-ampel-yellow'
  return 'bg-ampel-red'
}

export function ampelColor(ampel: string | null | undefined): string {
  switch (ampel) {
    case 'gruen':
      return '#22c55e'
    case 'gelb':
      return '#eab308'
    case 'rot':
      return '#ef4444'
    case 'grau':
      return '#9CA3AF'
    default:
      return '#64748b'
  }
}

export function ampelRgb(ampel: string | null | undefined): [number, number, number] {
  switch (ampel) {
    case 'gruen':
      return [34, 197, 94]
    case 'gelb':
      return [234, 179, 8]
    case 'rot':
      return [239, 68, 68]
    case 'grau':
      return [156, 163, 175]
    default:
      return [100, 116, 139]
  }
}
