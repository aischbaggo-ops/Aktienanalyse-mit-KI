// Einheitliche Formatierung (deutsches Zahlenformat)

export const eur = (x: number): string =>
  x.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })

export const eur2 = (x: number): string =>
  x.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export const num = (x: number, digits = 2): string =>
  x.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

export const pct = (x: number, digits = 1): string =>
  (x * 100).toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }) + ' %'
