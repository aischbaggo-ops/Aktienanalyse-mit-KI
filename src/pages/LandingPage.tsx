import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const DIMENSIONS = [
  {
    num: '01',
    title: 'Quick-Check',
    text: 'Vorfilter und Kursverlauf auf einen Blick — bevor die Detailarbeit beginnt.',
  },
  {
    num: '02',
    title: 'Qualität',
    text: 'Geschäftsmodell, Management und Öffentlichkeit — mit SWOT und K.O.-Kriterien.',
  },
  {
    num: '03',
    title: 'Fundamental',
    text: 'Gewinne, Cashflow, Bewertung — Fair Value statt fixer Kennzahlen-Schwellen.',
  },
  {
    num: '04',
    title: 'KI-Einschätzung',
    text: 'Ein 5-Jahres-Szenario mit Bär, Basis und Bull — offen als Annahme gekennzeichnet.',
  },
]

const STEPS = [
  'Ticker oder Firmenname eingeben.',
  'Das System zieht öffentliche Finanzdaten und lässt Claude eine strukturierte Bewertung erstellen.',
  'Bei auffälligen Score-Sprüngen läuft automatisch ein zweiter Kontrolllauf mit einem stärkeren Modell.',
  'Ergebnis: vier Reiter mit Zahlen, Einordnung und offen benannten Unsicherheiten — keine Kaufempfehlung.',
]

export function LandingPage() {
  const { session, loading } = useAuth()

  if (loading) return null
  if (session) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-memo-paper text-memo-ink">
      {/* Hero */}
      <div className="border-b border-memo-line px-6 py-24 text-center sm:px-16">
        <p className="mb-4 text-xs uppercase tracking-wide text-memo-muted">Aktienanalyse mit KI</p>
        <h1 className="mx-auto max-w-2xl font-analyst text-3xl leading-snug sm:text-4xl">
          Aktienbewertung, die ehrlich sagt, wenn sie es nicht weiß.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-memo-muted">
          Ein automatisiertes Analyse-Werkzeug, das Aktien entlang vier Dimensionen bewertet — Geschäftsqualität,
          Fundamentaldaten, Krisenstabilität und langfristiger Trend. Fehlende Daten werden als solche
          ausgewiesen, nicht als Mittelmaß verschleiert.
        </p>
        <Link
          to="/login"
          className="mt-8 inline-block rounded-sm bg-memo-ink px-7 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Zum Login
        </Link>
      </div>

      {/* Vier Dimensionen */}
      <div className="grid grid-cols-1 divide-y divide-memo-line border-b border-memo-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {DIMENSIONS.map((d) => (
          <div key={d.num} className="px-7 py-8">
            <p className="mb-2.5 text-xs text-memo-muted">{d.num}</p>
            <h3 className="mb-2 font-analyst text-lg text-memo-ink">{d.title}</h3>
            <p className="text-sm leading-relaxed text-memo-muted">{d.text}</p>
          </div>
        ))}
      </div>

      {/* Wie es funktioniert */}
      <div className="border-b border-memo-line px-6 py-14 sm:px-16">
        <h2 className="mb-6 font-analyst text-xl text-memo-ink">Wie es funktioniert</h2>
        <ol className="max-w-2xl space-y-3 text-sm leading-relaxed text-memo-ink">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-memo-muted">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Disclaimer-Footer */}
      <div className="px-6 py-7 text-center text-xs text-memo-muted sm:px-16">
        Automatisierte Analyse auf Basis öffentlicher Daten. Keine Anlageberatung.
      </div>
    </div>
  )
}
