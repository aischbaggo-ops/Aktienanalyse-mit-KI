import { useState } from 'react'
import type { StockAnalysis } from '../../types/database'
import { fmtCompact, dash } from '../../lib/memoFormat'
import { SeriesBarChart, SeriesDualBarChart, SeriesMultiLineChart } from '../../components/memo/Charts'

type HeroMetric = 'grossProfit' | 'ebit' | 'ebitda' | 'netIncome'

const HERO_TABS: { key: HeroMetric; label: string }[] = [
  { key: 'grossProfit', label: 'Bruttogewinn' },
  { key: 'ebit', label: 'EBIT' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'netIncome', label: 'Nettogewinn' },
]

function ValuationCell({ label, metric, currency }: { label: string; metric?: { value: number | null; label: string }; currency: string }) {
  return (
    <div className="border border-memo-line px-4 py-3">
      <p className="mb-1 text-xs uppercase tracking-wide text-memo-muted">{label}</p>
      <p className="font-analyst text-lg text-memo-ink">
        {metric?.value != null ? `${metric.value.toFixed(1)}×` : dash()}
      </p>
      <p className="text-xs text-memo-muted">{metric?.label ?? 'keine Bewertung möglich'}</p>
      <span className="sr-only">{currency}</span>
    </div>
  )
}

export function FundamentalTab({ analysis }: { analysis: StockAnalysis }) {
  const [heroMetric, setHeroMetric] = useState<HeroMetric>('netIncome')
  const fs = analysis.chart_data?.fundamentalSeries
  const valuation = analysis.bewertung?.valuation
  const currency = analysis.currency ?? ''

  if (!fs) {
    return <p className="py-8 text-center text-sm text-memo-grau">Keine Fundamentaldaten verfügbar.</p>
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-3 flex gap-4 border-b border-memo-line2 text-sm">
          {HERO_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setHeroMetric(t.key)}
              className={`-mb-px border-b-2 pb-2 transition-colors ${
                heroMetric === t.key
                  ? 'border-memo-ink text-memo-ink'
                  : 'border-transparent text-memo-muted hover:text-memo-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <SeriesBarChart
          years={fs.years}
          values={fs[heroMetric]}
          signed
          height={220}
          formatValue={(v) => fmtCompact(v, currency)}
        />
      </div>

      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-memo-muted">Bewertungskennzahlen</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ValuationCell label="KGV" metric={valuation?.kgv} currency={currency} />
          <ValuationCell label="KCV" metric={valuation?.kcv} currency={currency} />
          <ValuationCell label="EV/Umsatz" metric={valuation?.ev_umsatz} currency={currency} />
        </div>
        {valuation?.verfuegbar === false && (
          <p className="mt-2 text-xs text-memo-grau">{valuation.hinweis}</p>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-memo-muted">Details</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="mb-1.5 text-xs text-memo-muted">Cashflow (operativ + FCF)</p>
            <SeriesDualBarChart
              years={fs.years}
              seriesA={fs.operatingCashFlow}
              seriesB={fs.freeCashFlow}
              labelA="operativ"
              labelB="FCF"
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-memo-muted">Margen (Brutto/Operativ/Netto)</p>
            <SeriesMultiLineChart
              years={fs.years}
              series={[
                { label: 'Brutto', values: fs.grossMargin },
                { label: 'Operativ', values: fs.operatingMargin },
                { label: 'Netto', values: fs.netMargin },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-memo-muted">Goodwill</p>
            <SeriesBarChart years={fs.years} values={fs.goodwill} formatValue={(v) => fmtCompact(v, currency)} />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-memo-muted">Aktienanzahl</p>
            <SeriesBarChart years={fs.years} values={fs.sharesOut} formatValue={(v) => fmtCompact(v)} />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-memo-muted">Schulden (brutto)</p>
            <SeriesBarChart years={fs.years} values={fs.totalDebt} formatValue={(v) => fmtCompact(v, currency)} />
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
