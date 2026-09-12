import type { StockAnalysis, QuickCheckItem } from '../../types/database'
import { fmtMoney, fmtCompact, fmtPct } from '../../lib/memoFormat'
import { LogPriceChart, ReturnBarsChart, RelativeStrengthChart } from '../../components/memo/Charts'

function QuickCheckTile({
  label,
  item,
  value,
}: {
  label: string
  item: QuickCheckItem | undefined
  value: string
}) {
  const pass = item?.pass ?? null
  const marker = pass === null ? '–' : pass ? '✓' : '✕'
  const colorClass = pass === null ? 'text-memo-grau' : pass ? 'text-memo-plusText' : 'text-memo-minusText'
  return (
    <div className="rounded-sm border border-memo-line px-4 py-3">
      <p className="mb-1 text-xs uppercase tracking-wide text-memo-muted">{label}</p>
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
  const returnBars = analysis.chart_data?.returnBars ?? []
  const relStrength = analysis.chart_data?.relativeStrength ?? []
  const currency = analysis.currency ?? ''

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickCheckTile
          label="Kein Penny-Stock"
          item={qc?.kein_penny_stock}
          value={fmtMoney(qc?.kein_penny_stock?.wert, currency)}
        />
        <QuickCheckTile
          label="Liquidität"
          item={qc?.liquiditaet}
          value={qc?.liquiditaet?.wert != null ? `${fmtCompact(qc.liquiditaet.wert)} Stk./Tag` : '–'}
        />
        <QuickCheckTile
          label="Marktkap.-Klasse"
          item={qc?.marktkap_klasse}
          value={qc?.marktkap_klasse?.klasse ?? '–'}
        />
        <QuickCheckTile
          label="Aufwärtstrend"
          item={qc?.aufwaertstrend}
          value={fmtPct(qc?.aufwaertstrend?.wert)}
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-memo-muted">
          Kursverlauf (log. Skala, monatlich)
        </h3>
        <LogPriceChart data={priceMonthly} />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-memo-muted">
          Kursgewinn- und Drawdown-Phasen (jährlich)
        </h3>
        <ReturnBarsChart data={returnBars} />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-memo-muted">
          Relative Stärke vs. S&amp;P 500 (indexiert = 100 am Beginn der Historie)
        </h3>
        <RelativeStrengthChart data={relStrength} />
      </div>
    </div>
  )
}
