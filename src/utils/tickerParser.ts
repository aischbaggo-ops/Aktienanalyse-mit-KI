// Extrahiert Ticker aus frei eingefuegtem Text (Markdown-Tabellen, nummerierte
// Listen, komma-/zeilengetrennte Ticker). Rangnummern und Firmennamen werden
// ignoriert. Erwartet Ticker in GROSSBUCHSTABEN - Firmennamen in normaler
// Schreibweise ("Nvidia") fallen dadurch von selbst heraus.
//
// Bekannte Grenze: Firmennamen, die komplett in Grossbuchstaben und kurz sind
// ("NVDA CORP"), koennen als zweiter Ticker durchrutschen. Der Nutzer sieht
// das in der Vorschau-Liste und kann den Eintrag abwaehlen.

// 1-5 Zeichen, optional Suffix nach Punkt/Bindestrich (BRK.B, BF-B, SAP.DE).
// Mindestens ein Buchstabe, damit reine Rangnummern nie als Ticker gelten.
const TICKER_RE = /^(?=.*[A-Z])[A-Z0-9]{1,5}(?:[.-][A-Z0-9]{1,4})?$/

// Spaltenueberschriften/Platzhalter, die in Grossschreibung wie Ticker aussehen.
const IGNORED_WORDS = new Set(['TICKER', 'SYMBOL', 'RANK', 'NAME', 'COMPANY', 'WEIGHT', 'NR', 'NO', 'N/A'])

const EDGE_PUNCTUATION = /^[\s*_`'"()[\]{}<>:;,.]+|[\s*_`'"()[\]{}<>:;,.]+$/g

function cleanToken(raw: string): string {
  return raw.replace(EDGE_PUNCTUATION, '')
}

function isTicker(token: string): boolean {
  return TICKER_RE.test(token) && !IGNORED_WORDS.has(token)
}

// "GOOGL / GOOG" -> "GOOGL": bei Varianten zaehlt der erste Ticker.
function dropSlashVariants(text: string): string {
  return text.replace(/\s*\/\s*\S+/g, '')
}

function parseTableRow(line: string): string[] {
  for (const cell of line.split('|')) {
    if (IGNORED_WORDS.has(cell.trim().toUpperCase())) continue
    const token = cleanToken(dropSlashVariants(cell))
    if (isTicker(token)) return [token]
  }
  return []
}

function parseCommaList(line: string): string[] {
  const result: string[] = []
  for (const segment of line.split(/[,;]/)) {
    const token = dropSlashVariants(segment)
      .split(/\s+/)
      .map(cleanToken)
      .find(isTicker)
    if (token) result.push(token)
  }
  return result
}

function parsePlainLine(line: string): string[] {
  const tokens = dropSlashVariants(line)
    .split(/\s+/)
    .map(cleanToken)
    .filter((t) => t !== '' && !/^\d+$/.test(t)) // Rangnummern
  const tickers = tokens.filter(isTicker)
  // Reine Ticker-Zeile ("AAPL MSFT GOOG") -> alle; sonst steht Text dabei
  // ("1. NVDA Nvidia Corp") -> nur der erste Treffer.
  return tickers.length === tokens.length ? tickers : tickers.slice(0, 1)
}

export function parseTickers(input: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || /^[\s|:-]+$/.test(line)) continue // leer / Tabellen-Trennzeile

    const found = line.includes('|')
      ? parseTableRow(line)
      : /[,;]/.test(line)
        ? parseCommaList(line)
        : parsePlainLine(line)

    for (const ticker of found) {
      if (!seen.has(ticker)) {
        seen.add(ticker)
        result.push(ticker)
      }
    }
  }
  return result
}
