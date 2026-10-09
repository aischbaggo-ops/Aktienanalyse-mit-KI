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

export function formatMarketCap(value: number | null | undefined, currency: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const cur = currency ?? 'USD'
  const abs = Math.abs(value)
  let short: string
  if (abs >= 1e12) short = `${(value / 1e12).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Bio.`
  else if (abs >= 1e9) short = `${(value / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mrd.`
  else if (abs >= 1e6) short = `${(value / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio.`
  else short = value.toLocaleString('de-DE')
  return `${short} ${cur}`
}

// Anzeigename der Datenquelle (stock_analyses.data_source) statt des
// internen Codes. fmp_free_limited = Lauf mit eingeschraenkten Daten
// (kurze Kurshistorie oder keine Analystenschaetzungen).
export function dataSourceLabel(dataSource: string | null | undefined): string {
  if (!dataSource) return '–'
  if (dataSource === 'fmp_full') return 'Financial Modeling Prep (FMP)'
  if (dataSource.startsWith('fmp')) return 'Financial Modeling Prep (FMP), eingeschränkte Daten'
  return dataSource
}

// Jahresrendite aus chart_data.returnBars: pct ist ein Anteil (0.209 = +20,9 %).
export function formatReturnPct(pct: number): string {
  const v = pct * 100
  return `${v >= 0 ? '+' : ''}${v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}
