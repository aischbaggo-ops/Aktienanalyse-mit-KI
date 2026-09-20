import { useMemo, useState } from 'react'
import type { Leg, MarketParams } from './types'
import { TEMPLATES } from './data/templates'
import { computeMetrics } from './engine/payoff'
import StrategyPanel from './components/StrategyPanel'
import PayoffChart from './components/PayoffChart'
import MetricsPanel from './components/MetricsPanel'
import Sliders from './components/Sliders'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'

const INITIAL_SPOT = 100

const initialMarket: MarketParams = {
  spot: INITIAL_SPOT,
  iv: 0.3,
  rate: 0.04,
  contractSize: 100,
}

const initialLegs: Leg[] =
  TEMPLATES.find((t) => t.id === 'bull-call-spread')!.build(INITIAL_SPOT)

export default function OptionenPage() {
  const { loading, unlocked } = useFeatureAccess('optionen')

  const [market, setMarket] = useState<MarketParams>(initialMarket)
  const [legs, setLegs] = useState<Leg[]>(initialLegs)
  const [elapsedDays, setElapsedDays] = useState(0)
  const [simIv, setSimIv] = useState(initialMarket.iv)

  const maxDays = useMemo(() => {
    const d = legs.filter((l) => l.kind === 'option').map((l) => l.daysToExpiry)
    return d.length ? Math.max(...d) : 45
  }, [legs])

  const strikes = legs.filter((l) => l.kind === 'option').map((l) => l.strike)
  const spotMin = Math.max(1, Math.min(market.spot, ...strikes) * 0.6)
  const spotMax = Math.max(market.spot, ...strikes, 1) * 1.4

  const metrics = useMemo(() => computeMetrics(legs, market), [legs, market])

  const sim = { elapsedDays: Math.min(elapsedDays, maxDays), iv: simIv, rate: market.rate }

  const applyTemplate = (templateId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId)
    if (!tpl) return
    setLegs(tpl.build(market.spot))
    setElapsedDays(0)
    setSimIv(market.iv)
  }

  const resetSim = () => {
    setElapsedDays(0)
    setSimIv(market.iv)
  }

  if (loading) {
    return <div className="p-8 text-sm text-slate-400">Lädt…</div>
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h1 className="mb-2 text-lg font-bold text-slate-900">
          Optionen-Strategie-App
        </h1>
        <p className="text-sm text-slate-500">
          Dieser Baustein ist für dein Konto noch nicht freigeschaltet.
          Bitte wende dich an einen Admin.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Optionen-Strategie-App</h1>
            <p className="text-xs text-slate-400">
              Strategien planen, berechnen und durchspielen
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 lg:grid-cols-[320px_1fr_300px]">
        {/* Links: Strategie */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <StrategyPanel
            legs={legs}
            market={market}
            onLegsChange={setLegs}
            onMarketChange={setMarket}
            onApplyTemplate={applyTemplate}
          />
        </section>

        {/* Mitte: Payoff + Slider */}
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Gewinn-/Verlust-Profil</h2>
            <PayoffChart
              legs={legs}
              market={market}
              sim={sim}
              breakEvens={metrics.breakEvens}
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <Sliders
              spot={market.spot}
              spotMin={spotMin}
              spotMax={spotMax}
              elapsedDays={sim.elapsedDays}
              maxDays={maxDays}
              simIv={simIv}
              onSpot={(v) => setMarket({ ...market, spot: v })}
              onElapsed={setElapsedDays}
              onIv={setSimIv}
              onReset={resetSim}
            />
          </div>
        </section>

        {/* Rechts: Kennzahlen */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <MetricsPanel metrics={metrics} />
        </section>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-2 text-center text-xs text-slate-400">
        Bewertung nach Black-Scholes (europäische Optionen). Ohne Gewähr, keine
        Anlageberatung.
      </footer>
    </div>
  )
}
