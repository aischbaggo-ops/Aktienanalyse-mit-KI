import { scoreColor } from '../lib/score'

interface ScoreGaugeProps {
  score: number | null
  label?: string
}

export function ScoreGauge({ score, label = 'Gesamt-Score' }: ScoreGaugeProps) {
  const value = score ?? 0
  const color = scoreColor(score)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - value / 100)

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-2">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#dbe8e0" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={score === null ? circumference : offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-navy-950">{score ?? '–'}</span>
          <span className="text-[10px] text-navy-500">/ 100</span>
        </div>
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-navy-500">{label}</span>
    </div>
  )
}
