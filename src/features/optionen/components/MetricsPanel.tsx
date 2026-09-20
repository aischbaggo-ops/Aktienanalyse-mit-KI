import type { StrategyMetrics } from '../types'
import { eur, num, pct } from '../lib/format'

interface Props {
  metrics: StrategyMetrics
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  const color = tone === 'pos' ? 'text-profit' : tone === 'neg' ? 'text-loss' : 'text-slate-900'
  return (
    <div className="flex items-baseline justify-between border-b border-slate-100 py-1.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  )
}

function Greek({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-slate-900">{num(value, 2)}</span>
      </div>
      <div className="mt-0.5 text-[10px] leading-tight text-slate-400">{hint}</div>
    </div>
  )
}

export default function MetricsPanel({ metrics }: Props) {
  const { netPremium, maxProfit, maxLoss, breakEvens, greeks, probabilityOfProfit } = metrics
  const inf = '∞'

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Kennzahlen
        </h3>
        <Row
          label="Netto-Prämie"
          value={eur(netPremium)}
          tone={netPremium >= 0 ? 'pos' : 'neg'}
        />
        <Row
          label="Max. Gewinn"
          value={maxProfit === null ? inf : eur(maxProfit)}
          tone="pos"
        />
        <Row
          label="Max. Verlust"
          value={maxLoss === null ? `-${inf}` : eur(maxLoss)}
          tone="neg"
        />
        <Row
          label="Break-even"
          value={breakEvens.length ? breakEvens.map((b) => num(b, 2)).join(' / ') : '—'}
        />
        <Row label="Gewinnwahrscheinlichkeit" value={pct(probabilityOfProfit)} />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Griechen (Gesamtposition)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Greek label="Delta" value={greeks.delta} hint="pro 1 Kurspunkt" />
          <Greek label="Gamma" value={greeks.gamma} hint="Δ des Delta" />
          <Greek label="Theta" value={greeks.theta} hint="pro Tag" />
          <Greek label="Vega" value={greeks.vega} hint="pro 1 % IV" />
          <Greek label="Rho" value={greeks.rho} hint="pro 1 % Zins" />
        </div>
      </div>
    </div>
  )
}
