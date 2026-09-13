import type { StockAnalysis } from '../../types/database'
import { fmtMoney, dash } from '../../lib/memoFormat'
import { CorridorChart, ProbabilityBar } from '../../components/memo/Charts'

function directionArrow(action: string): string {
  if (action === 'upgrade') return '↑'
  if (action === 'downgrade') return '↓'
  return '–'
}

export function KiEinschaetzungTab({ analysis }: { analysis: StockAnalysis }) {
  const prognose = analysis.prognose
  const dcf = analysis.bewertung?.dcf
  const swot = analysis.chart_data?.swot
  const analystConsensus = analysis.chart_data?.analystConsensus
  const bankRatings = analysis.chart_data?.bankRatings ?? []
  const currency = analysis.currency ?? ''

  const basisFairValue = prognose?.verfuegbar ? prognose.basis?.fair_value_heute ?? null : null
  const baerFairValue = prognose?.verfuegbar ? prognose.baer?.fair_value_heute ?? null : null
  const bullFairValue = prognose?.verfuegbar ? prognose.bull?.fair_value_heute ?? null : null

  const verfahren: { label: string; wert: string; sub?: string }[] = [
    {
      label: 'Eigenes Modell (Fair Value heute)',
      wert: basisFairValue != null ? fmtMoney(basisFairValue, currency) : dash(),
      sub:
        baerFairValue != null && bullFairValue != null
          ? `Bär ${fmtMoney(baerFairValue, currency)} – Bull ${fmtMoney(bullFairValue, currency)}`
          : undefined,
    },
    {
      label: 'Analysten-Kursziel (Konsens)',
      wert: analystConsensus != null ? fmtMoney(analystConsensus.target, currency) : dash(),
      sub: analystConsensus != null ? `Ø aus ${analystConsensus.count} Schätzungen, 12-Monats-Horizont` : undefined,
    },
    { label: 'Peer-Bewertung', wert: dash() },
    {
      label: 'DCF (heutiger Fair Value)',
      wert: dcf?.dcf != null ? fmtMoney(dcf.dcf, dcf['Stock Price'] != null ? currency : '') : dash(),
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-memo-muted">
          Erwartungskorridor (Bär / Basis / Bull)
        </h3>
        {prognose?.verfuegbar && prognose.pfad ? (
          <>
            <CorridorChart pfad={prognose.pfad} />
            {prognose.baer && prognose.basis && prognose.bull && (
              <div className="mt-4 max-w-sm">
                <ProbabilityBar
                  baer={prognose.baer.wahrscheinlichkeit}
                  basis={prognose.basis.wahrscheinlichkeit}
                  bull={prognose.bull.wahrscheinlichkeit}
                />
              </div>
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-memo-grau">
            {prognose?.hinweis ?? 'Kein Erwartungskorridor berechenbar (fehlende Analysten-Schätzungen).'}
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-memo-muted">Bewertungsverfahren im Vergleich</h3>
        <table className="w-full text-sm">
          <tbody>
            {verfahren.map((v) => (
              <tr key={v.label} className="border-b border-memo-line2 last:border-none">
                <td className="py-2 pr-4 text-memo-ink">{v.label}</td>
                <td className="py-2 text-right">
                  <span className="font-analyst text-memo-ink">{v.wert}</span>
                  {v.sub && <span className="block text-xs text-memo-muted">{v.sub}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {verfahren[2].wert === dash() && (
          <p className="mt-2 text-xs text-memo-grau">
            Peer-Bewertung ist noch nicht angebunden (fehlende Datenquelle).
          </p>
        )}
        <p className="mt-2 text-xs text-memo-grau">
          Die vier Verfahren beziehen sich auf unterschiedliche Zeithorizonte (siehe Beschriftung) und
          sind daher nicht direkt gegeneinander aufrechenbar.
        </p>
      </div>

      {bankRatings.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-memo-muted">
            Einschätzung führender Banken
          </h3>
          <ul className="divide-y divide-memo-line2">
            {bankRatings.map((r) => (
              <li key={r.company} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-memo-ink">{r.company}</span>
                <span className="text-right">
                  <span className="text-memo-ink">
                    <span className="mr-1.5 text-memo-muted">{directionArrow(r.action)}</span>
                    {r.grade}
                  </span>
                  {(r.action === 'upgrade' || r.action === 'downgrade') && r.previousGrade && (
                    <span className="block text-xs text-memo-muted">
                      {r.action === 'upgrade' ? 'hochgestuft von' : 'abgestuft von'} {r.previousGrade}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-memo-muted">Rückenwind</h3>
          {swot?.chancen && swot.chancen.length > 0 ? (
            <ul className="space-y-1 text-sm text-memo-ink">
              {swot.chancen.map((c, i) => (
                <li key={i}>· {c}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-memo-grau">–</p>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-memo-muted">Gegenwind</h3>
          {swot?.risiken && swot.risiken.length > 0 ? (
            <ul className="space-y-1 text-sm text-memo-ink">
              {swot.risiken.map((r, i) => (
                <li key={i}>· {r}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-memo-grau">–</p>
          )}
        </div>
      </div>

      <blockquote className="border-l-4 border-memo-ink py-1 pl-5">
        {!prognose?.verfuegbar && (
          <p className="mb-2 font-analyst text-sm italic text-memo-grau">
            Kein belastbarer Zielkurs berechenbar — fehlende Analysten-Schätzungen oder Fundamentaldaten.
          </p>
        )}
        <p className="font-analyst text-lg leading-snug text-memo-ink">
          {analysis.fazit ?? 'Kein Fazit verfügbar.'}
        </p>
      </blockquote>

      <p className="border-t border-memo-line2 pt-4 text-xs leading-relaxed text-memo-muted">
        Diese Einschätzung wird automatisiert durch ein KI-Modell erstellt, basiert auf öffentlich
        verfügbaren Daten und stellt keine Anlageberatung dar. Modellannahmen (u.a. Wahrscheinlichkeits-
        Gewichtung Bär/Basis/Bull, Bewertungsmultiplikatoren) sind eigene Setzungen, keine Garantie für
        zukünftige Kursentwicklung. Valuation-Kennzahlen (KGV/KCV/EV-Umsatz) verwenden pauschale,
        branchenunabhängige Schwellenwerte.
      </p>
    </div>
  )
}
