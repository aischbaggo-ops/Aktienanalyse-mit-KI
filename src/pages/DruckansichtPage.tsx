import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { koWithoutNewsHint } from '../lib/dataFlags'
import { PRINT_SECTIONS, printFooterLines } from '../lib/printView'
import { getIndexWeighting, type IndexWeighting } from '../lib/webhooks'
import { AnalysisHeader, WarningsBox } from '../components/analysis/AnalysisHeader'
import type { StockAnalysis } from '../types/database'
import { QuickCheckTab } from './analyse/QuickCheckTab'
import { QualitaetTab } from './analyse/QualitaetTab'
import { FundamentalTab } from './analyse/FundamentalTab'
import { KiEinschaetzungTab } from './analyse/KiEinschaetzungTab'

// Druckansicht einer Analyse (Stufe 1): dieselben Komponenten wie die
// Analyseseite, alle vier Bereiche untereinander, gedruckt bzw. als PDF
// gespeichert ueber den Druckdialog des Browsers. Voller Umfang fuer den
// Eigengebrauch (inkl. FMP-Reihen, Logo, Marktkapitalisierung); Weitergabe an
// Dritte erst nach der FMP-Lizenzantwort (Nachtrag 8).
export function PrintableAnalysis({
  analysis,
  indexWeightings,
  printedAt,
}: {
  analysis: StockAnalysis
  indexWeightings: IndexWeighting[]
  printedAt: Date
}) {
  const newsHint = koWithoutNewsHint(analysis)
  return (
    <article className="druck space-y-6">
      <AnalysisHeader analysis={analysis} indexWeightings={indexWeightings} printMode />
      {newsHint && <p className="border-l-2 border-memo-line pl-3 text-xs text-memo-muted">{newsHint}</p>}
      <WarningsBox warnings={analysis.warnings} />

      {PRINT_SECTIONS.map((s, i) => (
        <section key={s.key} className={i > 0 ? 'druck-neue-seite' : undefined}>
          <h2 className="mb-3 border-b border-memo-line2 pb-1 text-base font-semibold text-navy-950">{s.title}</h2>
          {s.key === 'quickcheck' && <QuickCheckTab analysis={analysis} />}
          {s.key === 'qualitaet' && <QualitaetTab analysis={analysis} />}
          {s.key === 'fundamental' && <FundamentalTab analysis={analysis} />}
          {s.key === 'ki' && <KiEinschaetzungTab analysis={analysis} />}
        </section>
      ))}

      <footer className="druck-zusammenhalten space-y-0.5 border-t border-memo-line2 pt-3 text-[11px] text-memo-muted">
        {printFooterLines(analysis, printedAt).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </footer>
    </article>
  )
}

export function DruckansichtPage() {
  const { ticker } = useParams<{ ticker: string }>()
  const { session } = useAuth()
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [indexWeightings, setIndexWeightings] = useState<IndexWeighting[]>([])
  const [printedAt] = useState(() => new Date())

  useEffect(() => {
    if (!ticker) return
    let cancelled = false
    supabase
      .from('stock_analyses')
      .select('*')
      .eq('ticker', ticker)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setAnalysis(data)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ticker])

  useEffect(() => {
    if (!ticker || !session?.access_token) return
    let cancelled = false
    getIndexWeighting(ticker, session.access_token)
      .then((w) => {
        if (!cancelled) setIndexWeightings(w)
      })
      .catch(() => {
        // rein informativ - ohne Gewichtung weiterdrucken
      })
    return () => {
      cancelled = true
    }
  }, [ticker, session?.access_token])

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to={`/analyse/${encodeURIComponent(ticker ?? '')}`} className="text-xs text-memo-muted underline hover:text-memo-ink">
          Zurück zur Analyse
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-memo-muted">
            Tipp: im Druckdialog „Kopf- und Fußzeilen“ ausschalten und „Hintergrundgrafiken“ einschalten.
          </span>
          <button
            onClick={() => window.print()}
            disabled={!analysis || analysis.status !== 'done'}
            className="rounded-md bg-memo-ink px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Drucken / Als PDF speichern
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-memo-muted">Lade Analyse...</p>
      ) : !analysis ? (
        <p className="text-sm text-memo-muted">Keine Analyse für {ticker} gefunden.</p>
      ) : analysis.status !== 'done' ? (
        <p className="text-sm text-memo-muted">Für {ticker} liegt keine fertige Analyse vor.</p>
      ) : (
        <PrintableAnalysis analysis={analysis} indexWeightings={indexWeightings} printedAt={printedAt} />
      )}
    </div>
  )
}
