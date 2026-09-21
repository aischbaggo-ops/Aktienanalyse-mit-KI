import { describe, expect, it } from 'vitest'
import { parseTickers } from './tickerParser'

describe('parseTickers', () => {
  it('liest eine Markdown-Tabelle und ignoriert Rang, Name und Kopfzeile', () => {
    const input = [
      '| Rang | Ticker | Unternehmen |',
      '|------|--------|-------------|',
      '| 1 | NVDA | Nvidia |',
      '| 2 | MSFT | Microsoft |',
      '| 3 | AAPL | Apple |',
    ].join('\n')
    expect(parseTickers(input)).toEqual(['NVDA', 'MSFT', 'AAPL'])
  })

  it('ignoriert eine Kopfzeile in Grossbuchstaben', () => {
    const input = '| RANK | TICKER | NAME |\n|---|---|---|\n| 1 | NVDA | Nvidia |'
    expect(parseTickers(input)).toEqual(['NVDA'])
  })

  it('liest nummerierte Listen mit Firmennamen', () => {
    expect(parseTickers('1. NVDA Nvidia\n2) MSFT - Microsoft\n3 AAPL Apple Inc.')).toEqual(['NVDA', 'MSFT', 'AAPL'])
  })

  it('liest komma- und semikolongetrennte Ticker', () => {
    expect(parseTickers('AAPL, MSFT,GOOG; AMZN')).toEqual(['AAPL', 'MSFT', 'GOOG', 'AMZN'])
  })

  it('liest zeilengetrennte und leerzeichengetrennte Ticker', () => {
    expect(parseTickers('AAPL\nMSFT\n\nTSLA META')).toEqual(['AAPL', 'MSFT', 'TSLA', 'META'])
  })

  it('unterstuetzt Punkt und Bindestrich im Ticker', () => {
    expect(parseTickers('BRK.B, BF-B, SAP.DE')).toEqual(['BRK.B', 'BF-B', 'SAP.DE'])
  })

  it('nimmt bei Varianten den ersten Ticker', () => {
    expect(parseTickers('| 5 | GOOGL / GOOG | Alphabet |')).toEqual(['GOOGL'])
    expect(parseTickers('GOOGL / GOOG, META')).toEqual(['GOOGL', 'META'])
  })

  it('entfernt Markdown-Formatierung um den Ticker', () => {
    expect(parseTickers('| 1 | **NVDA** | Nvidia |\n| 2 | `MSFT` | Microsoft |')).toEqual(['NVDA', 'MSFT'])
  })

  it('ueberspringt Platzhalter wie N/A', () => {
    expect(parseTickers('| N/A | 7 | TSLA | Tesla |')).toEqual(['TSLA'])
  })

  it('dedupliziert unter Beibehaltung der Reihenfolge', () => {
    expect(parseTickers('MSFT, AAPL, MSFT\nAAPL')).toEqual(['MSFT', 'AAPL'])
  })

  it('liefert bei leerem oder tickerlosem Text eine leere Liste', () => {
    expect(parseTickers('')).toEqual([])
    expect(parseTickers('   \n\n')).toEqual([])
    expect(parseTickers('nur Fliesstext ohne Ticker 123')).toEqual([])
  })

  it('lehnt zu lange Grossbuchstaben-Woerter ab', () => {
    expect(parseTickers('NVIDIA, AAPL')).toEqual(['AAPL'])
  })
})
