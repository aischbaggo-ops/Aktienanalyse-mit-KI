export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return '#64748b'
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#eab308'
  return '#ef4444'
}

export function scoreTextClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-slate-500'
  if (score >= 70) return 'text-ampel-green'
  if (score >= 40) return 'text-ampel-yellow'
  return 'text-ampel-red'
}

export function scoreBgClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'bg-slate-200'
  if (score >= 70) return 'bg-ampel-green'
  if (score >= 40) return 'bg-ampel-yellow'
  return 'bg-ampel-red'
}

export function ampelColor(ampel: string | null | undefined): string {
  switch (ampel) {
    case 'gruen':
      return '#22c55e'
    case 'gelb':
      return '#eab308'
    case 'rot':
      return '#ef4444'
    case 'grau':
      return '#9CA3AF'
    default:
      return '#64748b'
  }
}

export function ampelRgb(ampel: string | null | undefined): [number, number, number] {
  switch (ampel) {
    case 'gruen':
      return [34, 197, 94]
    case 'gelb':
      return [234, 179, 8]
    case 'rot':
      return [239, 68, 68]
    case 'grau':
      return [156, 163, 175]
    default:
      return [100, 116, 139]
  }
}
