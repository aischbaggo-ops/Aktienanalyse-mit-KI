/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Jägermeister-Rebrand: Token-Namen "navy"/"gold" beibehalten (werden an
        // vielen Stellen referenziert), aber auf Herbal Green / Culture Orange
        // umgestellt, damit die Farbaenderung zentral hier passiert.
        // Zweite Iteration (PPT-Layout): "navy" deckt jetzt eine komplette
        // Helligkeits-Skala von hellem Seiten-Hintergrund (50) bis dunklem
        // Text/Header-Akzent (950) ab, statt nur dunkler Toene.
        navy: {
          50: '#eaf1ec', // Seiten-Hintergrund (PPT-Inhaltsfolien-Gruen)
          100: '#dbe8e0', // leichte Flaechen-Abstufung / Hover auf Weiss
          200: '#c3dbcd', // Kartenrand / Trenner auf hellem Grund
          400: '#38a87d',
          500: '#297a5b',
          600: '#1f5c44',
          700: '#154734', // Herbal Green (Markenfarbe) — Kopfzeile/Header-Akzent
          800: '#13392b',
          900: '#0e2a1f',
          950: '#16241c', // dunkler Ink-Text auf hellem Grund (PPT-Textfarbe)
        },
        gold: {
          // Akzentfarbe (vorher Gold/Amber)
          400: '#e38a59',
          500: '#dc6b2f', // Culture Orange (Markenfarbe)
          600: '#ae501e',
        },
        ampel: {
          // Funktionale Ampelfarben fuer Kriterien-Bewertung — bewusst NICHT
          // Teil des Marken-Farbschemas, bleiben unveraendert.
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
        },
        // Etappe 1 — Design "Analysten-Memo": eigenes, bewusst gedaempftes
        // Farbschema NUR fuer die Analyse-Detailseite (Quick-Check/Qualitaet/
        // Fundamental/KI-Einschaetzung-Tabs), unabhaengig vom Navy/Gold-Schema
        // des restlichen Frontends.
        memo: {
          paper: '#f4f2ee',
          ink: '#1a1a1a',
          line: '#cccccc',
          line2: '#dddddd',
          muted: '#999999',
          muted2: '#888888',
          plus: '#7f9482',
          plusText: '#4a7a58',
          minus: '#b9776c',
          minusText: '#a9564c',
          grau: '#9a978f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        analyst: ['"Iowan Old Style"', 'Georgia', '"Times New Roman"', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,36,28,0.06), 0 1px 0 rgba(22,36,28,0.03)',
      },
    },
  },
  plugins: [],
}
