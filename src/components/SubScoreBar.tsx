import { scoreBgClass, scoreTextClass } from '../lib/score'

interface SubScoreBarProps {
  label: string
  value: number | null
}

export function SubScoreBar({ label, value }: SubScoreBarProps) {
  const pct = value ?? 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-navy-800">{label}</span>
        <span className={`font-semibold ${scoreTextClass(value)}`}>{value ?? '–'}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-navy-100">
        <div
          className={`h-full rounded-full ${scoreBgClass(value)} transition-all duration-500`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  )
}
