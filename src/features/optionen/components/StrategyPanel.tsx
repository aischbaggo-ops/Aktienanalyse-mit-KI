import type { Leg, MarketParams } from '../types'
import { TEMPLATES } from '../data/templates'

interface Props {
  legs: Leg[]
  market: MarketParams
  onLegsChange: (legs: Leg[]) => void
  onMarketChange: (m: MarketParams) => void
  onApplyTemplate: (templateId: string) => void
}

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

const inputCls =
  'w-full rounded border border-slate-300 px-2 py-1 text-sm tabular-nums focus:border-sky-500 focus:outline-none'

export default function StrategyPanel({
  legs,
  market,
  onLegsChange,
  onMarketChange,
  onApplyTemplate,
}: Props) {
  const updateLeg = (id: string, patch: Partial<Leg>) =>
    onLegsChange(legs.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const removeLeg = (id: string) => onLegsChange(legs.filter((l) => l.id !== id))

  const addLeg = () =>
    onLegsChange([
      ...legs,
      {
        id: uid(),
        kind: 'option',
        optionType: 'call',
        direction: 'long',
        strike: Math.round(market.spot),
        daysToExpiry: 45,
        quantity: 1,
        premium: 0,
      },
    ])

  const setMarket = (patch: Partial<MarketParams>) =>
    onMarketChange({ ...market, ...patch })

  return (
    <div className="space-y-4">
      {/* Vorlagen */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Vorlage
        </label>
        <select
          className={inputCls}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onApplyTemplate(e.target.value)
            e.target.value = ''
          }}
        >
          <option value="" disabled>
            Strategie wählen…
          </option>
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} — {t.expectation}
            </option>
          ))}
        </select>
      </div>

      {/* Marktparameter */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Marktparameter
        </label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-[10px] text-slate-400">Spot</span>
            <input
              type="number"
              className={inputCls}
              value={market.spot}
              onChange={(e) => setMarket({ spot: Number(e.target.value) })}
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-400">IV %</span>
            <input
              type="number"
              className={inputCls}
              value={Math.round(market.iv * 1000) / 10}
              onChange={(e) => setMarket({ iv: Number(e.target.value) / 100 })}
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-400">Zins %</span>
            <input
              type="number"
              className={inputCls}
              value={Math.round(market.rate * 1000) / 10}
              onChange={(e) => setMarket({ rate: Number(e.target.value) / 100 })}
            />
          </div>
        </div>
      </div>

      {/* Legs */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Legs ({legs.length})
          </label>
          <button
            onClick={addLeg}
            className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-700"
          >
            + Leg
          </button>
        </div>

        <div className="space-y-2">
          {legs.map((leg) => (
            <div key={leg.id} className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="mb-2 flex items-center gap-1">
                <button
                  onClick={() =>
                    updateLeg(leg.id, {
                      direction: leg.direction === 'long' ? 'short' : 'long',
                    })
                  }
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    leg.direction === 'long'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {leg.direction === 'long' ? 'Long' : 'Short'}
                </button>

                {leg.kind === 'option' ? (
                  <button
                    onClick={() =>
                      updateLeg(leg.id, {
                        optionType: leg.optionType === 'call' ? 'put' : 'call',
                      })
                    }
                    className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700"
                  >
                    {leg.optionType === 'call' ? 'Call' : 'Put'}
                  </button>
                ) : (
                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    Aktie
                  </span>
                )}

                <button
                  onClick={() => removeLeg(leg.id)}
                  className="ml-auto text-xs text-slate-400 hover:text-red-600"
                  aria-label="Leg entfernen"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {leg.kind === 'option' && (
                  <label className="text-[10px] text-slate-400">
                    Strike
                    <input
                      type="number"
                      className={inputCls}
                      value={leg.strike}
                      onChange={(e) => updateLeg(leg.id, { strike: Number(e.target.value) })}
                    />
                  </label>
                )}
                {leg.kind === 'option' && (
                  <label className="text-[10px] text-slate-400">
                    Tage
                    <input
                      type="number"
                      className={inputCls}
                      value={leg.daysToExpiry}
                      onChange={(e) =>
                        updateLeg(leg.id, { daysToExpiry: Number(e.target.value) })
                      }
                    />
                  </label>
                )}
                <label className="text-[10px] text-slate-400">
                  Anzahl
                  <input
                    type="number"
                    className={inputCls}
                    value={leg.quantity}
                    onChange={(e) => updateLeg(leg.id, { quantity: Number(e.target.value) })}
                  />
                </label>
                <label className="text-[10px] text-slate-400">
                  {leg.kind === 'option' ? 'Prämie' : 'Kurs'}
                  <input
                    type="number"
                    step="0.01"
                    className={inputCls}
                    value={leg.premium}
                    onChange={(e) => updateLeg(leg.id, { premium: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          ))}
          {legs.length === 0 && (
            <p className="rounded border border-dashed border-slate-300 p-3 text-center text-xs text-slate-400">
              Noch keine Legs — Vorlage wählen oder „+ Leg" klicken.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
