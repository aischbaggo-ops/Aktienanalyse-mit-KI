// Zentrale, einzige Quelle fuer die drei semantischen Memo-Farben
// (Plus/Minus/Grau). Bewusst eine reine .js-Datei (nicht .ts): wird sowohl
// von tailwind.config.js importiert (laeuft unter Node-ESM ohne
// TypeScript-Loader) als auch von Charts.tsx/QualitaetTab.tsx (rohe
// Hex-Werte fuer inline SVG-/Style-Props, wo Tailwind-Utility-Klassen nicht
// greifen). Einmal hier aendern, ueberall wirksam - vorher gab es dieselben
// Hex-Werte zweimal von Hand synchron zu halten (tailwind.config.js +
// Charts.tsx), plus vereinzelt hartkodierte Literale (QualitaetTab.tsx).
//
// Validiert mit dem dataviz-Skill-Palette-Validator
// (scripts/validate_palette.js) gegen den Papier-Hintergrund #f4f2ee:
// - alle drei Paare Delta E >= 15 (normal vision: 20.3-22.1, Vorgabe war ±15)
// - Kontrast >= 3:1 (Chart-Marke) und >= 4.5:1 (WCAG-Textkontrast) gegen Papier
// - Chroma-Floor bestanden (die alten Werte lagen alle darunter, lasen sich
//   als "eigentlich grau")
// CVD-Trennung (Protan/Deutan) liegt bei 6.9 - im "6-8"-Warnband, das laut
// Validator nur MIT Sekundaer-Codierung zulaessig ist. Die im Projekt
// bereits vorhandene Sekundaer-Codierung (Haekchen/Kreuz-Marker, Pfeil-
// Symbole, unterschiedliche Strichmuster in den Fundamental-Charts,
// Textlabels ueberall) erfuellt diese Bedingung bereits.
//
// Die alten Werte waren: Plus #7f9482, Minus #b9776c, Grau #9a978f
// (Delta E nur ~9, Chroma-Floor gerissen, Kontrast-Warnung bei Grau).
// PLUS_TEXT/MINUS_TEXT (frueher eigene, dunklere Variante fuer Text) sind
// jetzt identisch mit PLUS/MINUS - die neuen Werte sind bereits dunkel/
// gesaettigt genug fuer beide Rollen (Chart-Marke UND lesbarer Text/Badge).
export const MEMO_PLUS = '#357a38'
export const MEMO_MINUS = '#c2431c'
export const MEMO_GRAU = '#785a9c'
