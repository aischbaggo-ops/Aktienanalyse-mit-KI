import type { FairValueData, StockAnalysis } from '../../types/database'
import { fmtCompact, fmtMoney, fmtPct, dash } from '../../lib/memoFormat'
import { SeriesBarChart, MultiLineChart } from '../../components/memo/Charts'
import { InfoTooltip } from '../../components/InfoTooltip'
import type { GlossaryTerm } from '../../lib/glossary'

function hasRealData(values: (number | null)[]): boolean {
  return values.some((v) => v != null && v !== 0)
}

function ValuationCell({
  label,
  term,
  metric,
  currency,
}: {
  label: string
  term: GlossaryTerm
  metric?: { value: number | null; label: string }
  currency: string
}) {
  return (
    <div className="border border-memo-line px-4 py-3">
      <p className="mb-1 text-xs uppercase tracking-wide text-memo-muted">
        {label}
        <InfoTooltip term={term} />
      </p>
      <p className="font-analyst text-lg text-memo-ink">
        {metric?.value != null ? `${metric.value.toFixed(1)}×` : dash()}
      </p>
      <p className="text-xs text-memo-muted">{metric?.label ?? 'keine Bewertung möglich'}</p>
      <span className="sr-only">{currency}</span>
    </div>
  )
}

/**
 * Fair Value nach Legrand-Methodik (Abschnitt 8): Ø-historisches KGV/KCV
 * (5 Jahre) + DCF, je 50%, ±5%-Toleranzband. Hauptaussage = Fair Value +
 * Abweichung vom Kurs, darunter eine kleine Kontext-Zeile mit den
 * zugrundeliegenden Ø-Multiples/DCF zur Nachvollziehbarkeit.
 */
function FairValueCard({ fairValue, currency }: { fairValue?: FairValueData; currency: string }) {
  if (!fairValue || fairValue.value == null) {
    return (
      <div className="border border-memo-line px-4 py-3 sm:col-span-2">
        <p className="mb-1 text-xs uppercase tracking-wide text-memo-muted">
          Fair Value<InfoTooltip term="fairValue" /> (Ø-KGV<InfoTooltip term="kgv" />/KCV<InfoTooltip term="kcv" /> + DCF<InfoTooltip term="dcf" />)
        </p>
        <p className="font-analyst text-lg text-memo-ink">{dash()}</p>
        <p className="text-xs text-memo-muted">{fairValue?.label ?? 'keine Bewertung möglich'}</p>
      </div>
    )
  }

  const k = fairValue.kontext
  const kontextParts = [
    k.avg_kgv != null ? `Ø-KGV ${k.avg_kgv.toFixed(1)}×` : null,
    k.avg_kcv != null ? `Ø-KCV ${k.avg_kcv.toFixed(1)}×` : null,
    k.dcf != null ? `DCF ${fmtMoney(k.dcf, currency)}` : null,
  ]
    .filter((p): p is string => p !== null)
    .join(' · ')

  return (
    <div className="border border-memo-line px-4 py-3 sm:col-span-2">
      <p className="mb-1 text-xs uppercase tracking-wide text-memo-muted">
        Fair Value<InfoTooltip term="fairValue" /> (Ø-KGV<InfoTooltip term="kgv" />/KCV<InfoTooltip term="kcv" /> + DCF<InfoTooltip term="dcf" />)
      </p>
      <p className="font-analyst text-lg text-memo-ink">
        {fmtMoney(fairValue.value, currency)}
        <span className="ml-2 text-sm font-normal text-memo-muted">{fairValue.label}</span>
      </p>
      <p className="text-xs text-memo-muted">
        {fairValue.abweichung_pct != null && `Kurs ${fmtPct(fairValue.abweichung_pct)} vs. Fair Value`}
        {kontextParts && ` · ${kontextParts}`}
        {k.jahre ? ` (Basis: ${k.jahre} Jahre Historie)` : ''}
      </p>
    </div>
  )
}

export function FundamentalTab({ analysis }: { analysis: StockAnalysis }) {
  const fs = analysis.chart_data?.fundamentalSeries
  const valuation = analysis.bewertung?.valuation
  const currency = analysis.currency ?? ''

  if (!fs) {
    return <p className="py-8 text-center text-sm text-memo-grau">Keine Fundamentaldaten verfügbar.</p>
  }

  const showGoodwill = hasRealData(fs.goodwill)

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-memo-muted">
          Bruttogewinn<InfoTooltip term="bruttogewinn" /> / EBIT<InfoTooltip term="ebit" /> / EBITDA
          <InfoTooltip term="ebitda" /> / Nettogewinn<InfoTooltip term="nettogewinn" />
        </h3>
        <MultiLineChart
          years={fs.years}
          height={240}
          width={800}
          marginLeft={64}
          marginRight={150}
          showYAxis
          showNameInEndLabel
          formatValue={(v) => fmtCompact(v, currency)}
          series={[
            { label: 'Bruttogewinn', values: fs.grossProfit },
            { label: 'EBIT', values: fs.ebit },
            { label: 'EBITDA', values: fs.ebitda },
            { label: 'Nettogewinn', values: fs.netIncome },
          ]}
        />
      </div>

      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-memo-muted">Bewertungskennzahlen</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FairValueCard fairValue={valuation?.fair_value} currency={currency} />
          <ValuationCell label="EV/Umsatz" term="evUmsatz" metric={valuation?.ev_umsatz} currency={currency} />
        </div>
        {valuation?.verfuegbar === false && (
          <p className="mt-2 text-xs text-memo-grau">{valuation.hinweis}</p>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-memo-muted">Details</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="mb-1.5 text-xs text-memo-muted">
              Cashflow (operativ + FCF<InfoTooltip term="fcf" />)
            </p>
            <MultiLineChart
              years={fs.years}
              marginRight={64}
              formatValue={(v) => fmtCompact(v, currency)}
              series={[
                { label: 'operativ', values: fs.operatingCashFlow },
                { label: 'FCF', values: fs.freeCashFlow },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-memo-muted">
              Margen<InfoTooltip term="marge" /> (Brutto/Operativ/Netto)
            </p>
            <MultiLineChart
              years={fs.years}
              marginRight={36}
              formatValue={(v) => `${(v * 100).toFixed(1)}%`}
              series={[
                { label: 'Brutto', values: fs.grossMargin },
                { label: 'Operativ', values: fs.operatingMargin },
                { label: 'Netto', values: fs.netMargin },
              ]}
            />
          </div>
          {showGoodwill && (
            <div>
              <p className="mb-1.5 text-xs text-memo-muted">
                Goodwill
                <InfoTooltip term="goodwill" />
              </p>
              <SeriesBarChart years={fs.years} values={fs.goodwill} formatValue={(v) => fmtCompact(v, currency)} />
            </div>
          )}
          <div>
            <p className="mb-1.5 text-xs text-memo-muted">Aktienanzahl</p>
            <MultiLineChart
              years={fs.years}
              marginRight={64}
              formatValue={(v) => fmtCompact(v)}
              series={[{ label: 'Aktienanzahl', values: fs.sharesOut }]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-memo-muted">Schulden (brutto)</p>
            <MultiLineChart
              years={fs.years}
              marginRight={64}
              formatValue={(v) => fmtCompact(v, currency)}
              series={[{ label: 'Schulden', values: fs.totalDebt }]}
            />
          </div>
          {fs.isDividendPayer && (
            <div>
              <p className="mb-1.5 text-xs text-memo-muted">Dividenden</p>
              <SeriesBarChart years={fs.years} values={fs.dividendsPaid} formatValue={(v) => fmtCompact(v, currency)} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
