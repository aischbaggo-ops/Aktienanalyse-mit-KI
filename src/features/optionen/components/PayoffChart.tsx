import {
  Area,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Leg, MarketParams } from '../types'
import { payoffAtExpiry, valueBeforeExpiry, type SimState } from '../engine/payoff'
import { eur, num } from '../lib/format'

interface Point {
  price: number
  expiry: number
  now: number
}

interface Props {
  legs: Leg[]
  market: MarketParams
  sim: SimState
  breakEvens: number[]
}

export default function PayoffChart({ legs, market, sim, breakEvens }: Props) {
  const strikes = legs.filter((l) => l.kind === 'option').map((l) => l.strike)
  const lo = Math.max(0, Math.min(market.spot, ...strikes, market.spot) * 0.6)
  const hi = Math.max(market.spot, ...strikes, 1) * 1.3
  const steps = 120
  const data: Point[] = []
  for (let i = 0; i <= steps; i++) {
    const price = lo + ((hi - lo) * i) / steps
    data.push({
      price,
      expiry: payoffAtExpiry(price, legs, market.contractSize),
      now: valueBeforeExpiry(price, legs, sim, market.contractSize),
    })
  }

  const spotPayoff = payoffAtExpiry(market.spot, legs, market.contractSize)

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="posFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="price"
            type="number"
            domain={[lo, hi]}
            tickFormatter={(v) => num(v, 0)}
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
          />
          <YAxis
            tickFormatter={(v) => num(v, 0)}
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
            width={56}
          />
          <Tooltip
            formatter={(value: number, name) => [
              eur(value),
              name === 'expiry' ? 'bei Verfall' : 'aktuell',
            ]}
            labelFormatter={(v) => `Kurs: ${num(Number(v), 2)}`}
          />
          <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
          <ReferenceLine
            x={market.spot}
            stroke="#0ea5e9"
            strokeDasharray="4 3"
            label={{ value: 'Spot', position: 'top', fontSize: 11, fill: '#0ea5e9' }}
          />
          <Area
            type="monotone"
            dataKey="expiry"
            stroke="none"
            fill="url(#posFill)"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="expiry"
            stroke="#0f172a"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="now"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
          {breakEvens.map((be) => (
            <ReferenceLine key={be} x={be} stroke="#dc2626" strokeDasharray="2 2" />
          ))}
          <ReferenceDot
            x={market.spot}
            y={spotPayoff}
            r={4}
            fill="#0ea5e9"
            stroke="#fff"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap gap-4 px-2 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-[2px] w-4 bg-slate-900" /> bei Verfall
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-[2px] w-4 bg-amber-500" /> aktuell (Simulation)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-[2px] w-4 bg-red-600" /> Break-even
        </span>
      </div>
    </div>
  )
}
