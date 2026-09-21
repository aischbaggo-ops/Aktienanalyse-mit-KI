import { num, pct } from '../lib/format'

interface Props {
  spot: number
  spotMin: number
  spotMax: number
  elapsedDays: number
  maxDays: number
  simIv: number
  onSpot: (v: number) => void
  onElapsed: (v: number) => void
  onIv: (v: number) => void
  onReset: () => void
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-slate-900">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-600"
      />
    </div>
  )
}

export default function Sliders({
  spot,
  spotMin,
  spotMax,
  elapsedDays,
  maxDays,
  simIv,
  onSpot,
  onElapsed,
  onIv,
  onReset,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Was-wäre-wenn
        </h3>
        <button
          onClick={onReset}
          className="text-xs text-sky-600 hover:underline"
        >
          zurücksetzen
        </button>
      </div>
      <Slider
        label="Kurs (Spot)"
        value={spot}
        min={spotMin}
        max={spotMax}
        step={(spotMax - spotMin) / 200}
        display={num(spot, 2)}
        onChange={onSpot}
      />
      <Slider
        label="verstrichene Zeit"
        value={elapsedDays}
        min={0}
        max={maxDays}
        step={1}
        display={`${Math.round(elapsedDays)} / ${maxDays} Tage`}
        onChange={onElapsed}
      />
      <Slider
        label="implizite Volatilität"
        value={simIv}
        min={0.05}
        max={1}
        step={0.01}
        display={pct(simIv, 0)}
        onChange={onIv}
      />
    </div>
  )
}
