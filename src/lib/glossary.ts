// Zentrales Glossar fuer Fachbegriffe/Abkuerzungen in der Analyse-Ansicht
// (siehe InfoTooltip). Ein Eintrag pro Begriff, an einer Stelle gepflegt
// statt verstreut in den einzelnen Tabs. label = ausgeschriebener Name
// (kann von der im UI sichtbaren, evtl. abgekuerzten Beschriftung
// abweichen), erklaerung = 1-2 laienverstaendliche Saetze auf Deutsch.
export interface GlossaryEntry {
  label: string
  erklaerung: string
}

export const GLOSSARY = {
  // Radar-/Tab-Dimensionen (AnalysePage-Kopfbereich)
  qualitaet: {
    label: 'Qualität',
    erklaerung: 'Bewertet Geschäftsmodell, Wettbewerbsposition und Management anhand von 20 vorgegebenen Kriterien - unabhängig vom aktuellen Kurs.',
  },
  fundamental: {
    label: 'Fundamental',
    erklaerung: 'Bewertet die Finanzkennzahlen des Unternehmens (Umsatz, Gewinn, Cashflow, Verschuldung) anhand der letzten Geschäftsjahre.',
  },
  krise: {
    label: 'Krise',
    erklaerung: 'Misst anhand von Beta und vergangenen Markteinbrüchen, wie stark der Kurs in Krisenzeiten im Vergleich zum Gesamtmarkt schwankt.',
  },
  trend: {
    label: 'Trend',
    erklaerung: 'Misst die langfristige, zeitgewichtete Kursentwicklung im Vergleich zum Gesamtmarkt.',
  },

  // Quick-Check-Tab
  pennyStock: {
    label: 'Penny-Stock',
    erklaerung: 'Eine Aktie mit sehr niedrigem Kurs (hier: unter 5 $/€) - gilt oft als besonders spekulativ und schwankungsanfällig.',
  },
  liquiditaet: {
    label: 'Liquidität',
    erklaerung: 'Wie viele Aktien im Schnitt täglich gehandelt werden. Niedrige Liquidität erschwert den Kauf/Verkauf größerer Stückzahlen, ohne den Kurs zu bewegen.',
  },
  marktkapKlasse: {
    label: 'Marktkapitalisierungs-Klasse',
    erklaerung: 'Größenklasse nach Marktkapitalisierung (Kurs × Aktienanzahl), z. B. Large-Cap, Mid-Cap oder Small-Cap.',
  },
  aufwaertstrend: {
    label: 'Aufwärtstrend',
    erklaerung: 'Ob der Kurs über den betrachteten Zeitraum im Schnitt gestiegen ist.',
  },
  logSkala: {
    label: 'Logarithmische Skala',
    erklaerung: 'Gleiche prozentuale Kursänderungen werden gleich groß dargestellt, egal ob früher oder heute - macht lange Kurshistorien besser vergleichbar.',
  },
  drawdown: {
    label: 'Drawdown',
    erklaerung: 'Der prozentuale Kursrückgang von einem vorherigen Hoch bis zum tiefsten Punkt danach - ein Maß für erlittene Verluste.',
  },
  relativeStaerke: {
    label: 'Relative Stärke',
    erklaerung: 'Vergleicht die Kursentwicklung der Aktie mit einem Index (hier S&P 500), indexiert auf 100 am Beginn der Historie - über 100 heißt: besser gelaufen als der Index.',
  },

  // Qualitaet-Tab
  swot: {
    label: 'SWOT',
    erklaerung: 'Stärken, Schwächen, Chancen und Risiken (engl. Strengths, Weaknesses, Opportunities, Threats) - eine gängige Struktur zur Unternehmenseinschätzung.',
  },
  haertegrad: {
    label: 'Härtegrad',
    erklaerung: 'Wie stark ein Kriterium in die Bewertung eingeht: "Streng" wiegt stark, "Soft" nur leicht, "Bonus" wirkt nur positiv, nie negativ.',
  },
  koKriterien: {
    label: 'K.O.-Kriterien',
    erklaerung: 'Ausschlusskriterien: Ist eines davon verletzt (rot), gilt das als schwerwiegendes Warnsignal - unabhängig vom sonstigen Score.',
  },

  // Fundamental-Tab
  bruttogewinn: {
    label: 'Bruttogewinn',
    erklaerung: 'Umsatz abzüglich der Herstellungskosten - der Gewinn vor Vertriebs-, Verwaltungs-, Zins- und Steuerkosten.',
  },
  ebit: {
    label: 'EBIT (Earnings Before Interest and Taxes)',
    erklaerung: 'Gewinn vor Zinsen und Steuern - zeigt die operative Ertragskraft unabhängig von Finanzierung und Steuerlast.',
  },
  ebitda: {
    label: 'EBITDA (Earnings Before Interest, Taxes, Depreciation and Amortization)',
    erklaerung: 'EBIT zuzüglich Abschreibungen - blendet zusätzlich buchhalterische Wertminderungen aus, oft zum Vergleich kapitalintensiver Unternehmen genutzt.',
  },
  nettogewinn: {
    label: 'Nettogewinn',
    erklaerung: 'Der Gewinn, der nach Abzug aller Kosten, Zinsen und Steuern übrig bleibt - die "Bottom Line" der Gewinn- und Verlustrechnung.',
  },
  fairValue: {
    label: 'Fair Value',
    erklaerung: 'Der rechnerisch "angemessene" Wert der Aktie nach dem hier verwendeten Modell (Ø-KGV/KCV der letzten 5 Jahre + DCF) - keine Kursgarantie.',
  },
  kgv: {
    label: 'KGV (Kurs-Gewinn-Verhältnis)',
    erklaerung: 'Aktienkurs geteilt durch Gewinn je Aktie - je niedriger, desto günstiger ist die Aktie im Verhältnis zum aktuellen Gewinn bewertet.',
  },
  kcv: {
    label: 'KCV (Kurs-Cashflow-Verhältnis)',
    erklaerung: 'Aktienkurs geteilt durch operativen Cashflow je Aktie - ähnlich dem KGV, aber weniger anfällig für buchhalterische Gestaltungsspielräume.',
  },
  dcf: {
    label: 'DCF (Discounted Cashflow)',
    erklaerung: 'Bewertungsmethode, die zukünftig erwartete Cashflows auf den heutigen Wert abzinst, um einen fairen Unternehmenswert zu schätzen.',
  },
  evUmsatz: {
    label: 'EV/Umsatz',
    erklaerung: 'Enterprise Value (Marktkapitalisierung + Nettoschulden) geteilt durch den Jahresumsatz - eine von der Gewinnsituation unabhängige Bewertungskennzahl.',
  },
  fcf: {
    label: 'FCF (Free Cashflow)',
    erklaerung: 'Der frei verfügbare Cashflow nach Investitionen (operativer Cashflow minus Investitionsausgaben) - Geld, das für Dividenden, Rückkäufe oder Schuldenabbau zur Verfügung steht.',
  },
  marge: {
    label: 'Marge',
    erklaerung: 'Gewinn als Prozentsatz vom Umsatz. Brutto-, operative und Nettomarge unterscheiden sich darin, welche Kosten jeweils schon abgezogen sind.',
  },
  goodwill: {
    label: 'Goodwill',
    erklaerung: 'Der bei Firmenübernahmen über den bilanziellen Substanzwert hinaus gezahlte Betrag (z. B. für Marke, Kundenbeziehungen) - erscheint als Vermögenswert in der Bilanz.',
  },

  // KI-Einschaetzung-Tab
  erwartungskorridor: {
    label: 'Erwartungskorridor',
    erklaerung: 'Die Bandbreite möglicher Kursziele je nach Szenario (Bär/Basis/Bull) - eine eigene Modellannahme, keine Kursgarantie.',
  },
  baerBasisBull: {
    label: 'Bär / Basis / Bull',
    erklaerung: '"Bär" = pessimistisches, "Basis" = wahrscheinlichstes, "Bull" = optimistisches Szenario für die Kursentwicklung.',
  },
  analystenKonsens: {
    label: 'Analysten-Konsens',
    erklaerung: 'Der Durchschnitt der Kursziele professioneller Bankanalysten für diese Aktie, meist mit 12-Monats-Horizont.',
  },
  peerBewertung: {
    label: 'Peer-Bewertung',
    erklaerung: 'Vergleich der Bewertungskennzahlen mit ähnlichen Unternehmen derselben Branche - diese Datenquelle ist aktuell noch nicht angebunden.',
  },

  // Analyse-Kopfbereich (gemeinsam fuer alle Tabs)
  marktkap: {
    label: 'Marktkapitalisierung',
    erklaerung: 'Der Börsenwert des Unternehmens: Aktienkurs × Anzahl ausstehender Aktien.',
  },
  indexGewichtung: {
    label: 'Index-Gewichtung',
    erklaerung: 'Der prozentuale Anteil, den diese Aktie am Gesamtwert des jeweiligen Index hat - rein informativ, ohne Einfluss auf den Score.',
  },
} as const satisfies Record<string, GlossaryEntry>

export type GlossaryTerm = keyof typeof GLOSSARY
