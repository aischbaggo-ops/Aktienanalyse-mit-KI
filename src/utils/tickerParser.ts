// Extrahiert Ticker aus frei eingefuegtem Text (Markdown-Tabellen, nummerierte
// Listen, komma-/zeilengetrennte Ticker). Rangnummern und Firmennamen werden
// ignoriert.
//
// Gross-/Kleinschreibung ist egal ("nvda", "Nvda", "NVDA" -> NVDA), ABER nur
// dort, wo pro Fragment genau EIN Kandidat infrage kommt: ein Ticker allein
// auf einer Zeile, ein Komma-Segment, eine Tabellenzelle. Bei MEHREREN
// Woertern auf derselben Zeile (z.B. "1. NVDA Nvidia Corp") bleibt die
// Pruefung bewusst GROSSSCHREIBUNGS-sensitiv - das ist die einzige
// verlaessliche Unterscheidung zwischen einer reinen Ticker-Zeile
// ("AAPL MSFT GOOG") und Fliesstext/Firmennamen, siehe parsePlainLine.
// Ohne diese Einschraenkung wuerden kurze Woerter wie "nur", "Apple" oder
// "Inc" faelschlich als Ticker durchgehen (mit echtem Test belegt).
//
// Bekannte, bewusst in Kauf genommene Grenzen:
// - Ein kleingeschriebener Ticker MITTEN in einer mehrwoertigen Zeile wird
//   dadurch (noch) nicht erkannt (z.B. "1. nvda Nvidia" bleibt leer).
// - Kurze Firmennamen/Woerter (<=5 Zeichen), die als einziges Wort auf einer
//   Zeile oder als einzelne Tabellenzelle stehen, koennen als Ticker
//   durchrutschen. Der Nutzer sieht das in der Vorschau-Liste und kann den
//   Eintrag abwaehlen.

// 1-5 Zeichen, optional Suffix nach Punkt/Bindestrich (BRK.B, BF-B, SAP.DE).
// Mindestens ein Buchstabe, damit reine Rangnummern nie als Ticker gelten.
const TICKER_RE = /^(?=.*[A-Z])[A-Z0-9]{1,5}(?:[.-][A-Z0-9]{1,4})?$/

// Spaltenueberschriften/Platzhalter, die in Grossschreibung wie Ticker aussehen
// (deutsch und englisch, je nach Quelle der eingefuegten Tabelle).
const IGNORED_WORDS = new Set(['TICKER', 'SYMBOL', 'RANK', 'RANG', 'NAME', 'COMPANY', 'WEIGHT', 'NR', 'NO', 'N/A'])

const EDGE_PUNCTUATION = /^[\s*_`'"()[\]{}<>:;,.]+|[\s*_`'"()[\]{}<>:;,.]+$/g

function cleanToken(raw: string): string {
  return raw.replace(EDGE_PUNCTUATION, '')
}

// Case-sensitiv - fuer Kontexte mit mehreren konkurrierenden Woertern
// (mehrwoertige Zeilen), wo Grossschreibung das einzige verlaessliche
// Unterscheidungsmerkmal zwischen Ticker und Firmenname/Fliesstext ist.
function isTickerShape(token: string): boolean {
  return TICKER_RE.test(token) && !IGNORED_WORDS.has(token)
}

// Wie isTickerShape, aber unabhaengig von Gross-/Kleinschreibung. Nur dort
// verwenden, wo es pro Fragment hoechstens einen Kandidaten gibt (bare
// Ticker allein auf einer Zeile, Komma-Segment, Tabellenzelle) - siehe
// Kommentar am Dateianfang.
function isTicker(token: string): boolean {
  const upper = token.toUpperCase()
  return TICKER_RE.test(upper) && !IGNORED_WORDS.has(upper)
}

// "GOOGL / GOOG" -> "GOOGL": bei Varianten zaehlt der erste Ticker.
function dropSlashVariants(text: string): string {
  return text.replace(/\s*\/\s*\S+/g, '')
}

function parseTableRow(line: string): string[] {
  for (const cell of line.split('|')) {
    if (IGNORED_WORDS.has(cell.trim().toUpperCase())) continue
    const token = cleanToken(dropSlashVariants(cell))
    if (isTicker(token)) return [token.toUpperCase()]
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
    if (token) result.push(token.toUpperCase())
  }
  return result
}

function parsePlainLine(line: string): string[] {
  const tokens = dropSlashVariants(line)
    .split(/\s+/)
    .map(cleanToken)
    .filter((t) => t !== '' && !/^\d+$/.test(t)) // Rangnummern

  // Einzelnes Wort auf der Zeile ("nvda" allein) ist eindeutig - hier darf
  // die Schreibweise keine Rolle spielen (Hauptfall aus dem Bugreport).
  if (tokens.length === 1) {
    return isTicker(tokens[0]) ? [tokens[0].toUpperCase()] : []
  }

  // Mehrere Woerter: case-sensitiv pruefen, siehe Kommentar am Dateianfang.
  const tickers = tokens.filter(isTickerShape)
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
