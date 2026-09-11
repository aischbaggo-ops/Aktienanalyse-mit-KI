import { scoreBgClass } from '../lib/score'

interface ScoreBadgeProps {
  score: number | null
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  return (
    <span
      className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-navy-950 ${scoreBgClass(
        score
      )}`}
    >
      {score ?? '–'}
    </span>
  )
}
