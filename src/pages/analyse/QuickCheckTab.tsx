import type { StockAnalysis, QuickCheckItem } from '../../types/database'
import { fmtMoney, fmtCompact, fmtPct } from '../../lib/memoFormat'
import { LogPriceChart, ReturnBarsChart, RelativeStrengthChart } from '../../components/memo/Charts'
import { InfoTooltip } from '../../components/InfoTooltip'
import type { GlossaryTerm } from '../../lib/glossary'

function QuickCheckTile({
  label,
  term,
  item,
  value,
}: {
  label: string
  term: GlossaryTerm
  item: QuickCheckItem | undefined
  value: string
}) {
  const pass = item?.pass ?? null
  const marker = pass === null ? '–' : pass ? '✓' : '✕'
  const colorClass = pass === null ? 'text-memo-grau' : pass ? 'text-memo-plusText' : 'text-memo-minusText'
  return (
    <div className="rounded-sm border border-memo-line px-4 py-3">
      <p className="mb-1 text-xs uppercase tracking-wide text-memo-muted">
        {label}
        <InfoTooltip term={term} />
      </p>
      <p className={`text-sm font-medium ${colorClass}`}>
        <span className="mr-1.5">{marker}</span>
        {value}
      </p>
    </div>
  )
}

export function QuickCheckTab({ analysis }: { analysis: StockAnalysis }) {
  const qc = analysis.chart_data?.quickCheck
  const priceMonthly = analysis.chart_data?.priceMonthly?.stock ?? []
  const indexMonthly = analysis.chart_data?.priceMonthly?.index ?? []
  const returnBars = analysis.chart_data?.returnBars ?? []
  const relStrength = analysis.chart_data?.relativeStrength ?? []
  const currency = analysis.currency ?? ''

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickCheckTile
          label="Kein Penny-Stock"
          term="pennyStock"
          item={qc?.kein_penny_stock}
          value={fmtMoney(qc?.kein_penny_stock?.wert, currency)}
        />
        <QuickCheckTile
          label="Liquidität"
          term="liquiditaet"
          item={qc?.liquiditaet}
          value={qc?.liquiditaet?.wert != null ? `${fmtCompact(qc.liquiditaet.wert)} Stk./Tag` : '–'}
        />
        <QuickCheckTile
          label="Marktkap.-Klasse"
          term="marktkapKlasse"
          item={qc?.marktkap_klasse}
          value={qc?.marktkap_klasse?.klasse ?? '–'}
        />
        <QuickCheckTile
          label="Aufwärtstrend"
          term="aufwaertstrend"
          item={qc?.aufwaertstrend}
          value={fmtPct(qc?.aufwaertstrend?.wert)}
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-memo-muted">
          Kursverlauf (log. Skala<InfoTooltip term="logSkala" />, monatlich)
        </h3>
        <LogPriceChart data={priceMonthly} indexData={indexMonthly} />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-memo-muted">
          Kursgewinn- und Drawdown-Phasen<InfoTooltip term="drawdown" /> (jährlich)
        </h3>
        <ReturnBarsChart data={returnBars} />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-memo-muted">
          Relative Stärke<InfoTooltip term="relativeStaerke" /> vs. S&amp;P 500 (indexiert = 100 am Beginn der Historie)
        </h3>
        <RelativeStrengthChart data={relStrength} />
      </div>
    </div>
  )
}
