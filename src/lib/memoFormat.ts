// Formatierungs-Helfer fuer das "Analysten-Memo"-Redesign (Etappe 1). Ueberall
// gilt: null (grauer/fehlender Datenzustand) wird als "–" dargestellt, nie als
// "0" oder leere Flaeche.

export function dash(): string {
  return '–'
}

export function fmtNum(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return dash()
  return value.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return dash()
  const pct = value * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(digits)}%`
}

export function fmtMoney(value: number | null | undefined, currency = ''): string {
  if (value === null || value === undefined || Number.isNaN(value)) return dash()
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 2 })}${currency ? ' ' + currency : ''}`
}

export function fmtCompact(value: number | null | undefined, currency = ''): string {
  if (value === null || value === undefined || Number.isNaN(value)) return dash()
  const abs = Math.abs(value)
  const suffix = currency ? ` ${currency}` : ''
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)} Bio.${suffix}`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)} Mrd.${suffix}`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} Mio.${suffix}`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)} Tsd.${suffix}`
  return `${value.toFixed(0)}${suffix}`
}

export function fmtYear(dateStr: string | null | undefined): string {
  if (!dateStr) return dash()
  return dateStr.slice(0, 4)
}
