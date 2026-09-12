import type { StockAnalysis } from '../../types/database'
import { fmtMoney, dash } from '../../lib/memoFormat'
import { CorridorChart, ProbabilityBar } from '../../components/memo/Charts'

export function KiEinschaetzungTab({ analysis }: { analysis: StockAnalysis }) {
  const prognose = analysis.prognose
  const dcf = analysis.bewertung?.dcf
  const swot = analysis.chart_data?.swot
  const currency = analysis.currency ?? ''

  const verfahren: { label: string; wert: string }[] = [
    {
      label: 'Eigenes Modell (Erwartungswert)',
      wert: prognose?.verfuegbar && prognose.erwartungswert != null ? fmtMoney(prognose.erwartungswert, currency) : dash(),
    },
    { label: 'Analysten-Kursziel', wert: dash() },
    { label: 'Peer-Bewertung', wert: dash() },
    {
      label: 'DCF',
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
                <td className="py-2 text-right font-analyst text-memo-ink">{v.wert}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(verfahren[1].wert === dash() || verfahren[2].wert === dash()) && (
          <p className="mt-2 text-xs text-memo-grau">
            Analysten-Kursziel und Peer-Bewertung sind noch nicht angebunden (fehlende Datenquelle).
          </p>
        )}
      </div>

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
