import type { KrisenFenster } from '../types/database'

interface CrisisChartProps {
  data: KrisenFenster[]
}

export function CrisisChart({ data }: CrisisChartProps) {
  if (!Array.isArray(data) || data.length === 0) {
    return <p className="text-sm text-navy-500">Keine Krisendaten verfügbar.</p>
  }

  const maxDrawdown = Math.max(
    1,
    ...data
      .flatMap((d) => [d.ddStock, d.ddIndex])
      .filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v))
      .map((v) => Math.abs(v))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-navy-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-gold-500" /> Aktie
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-navy-400" /> S&amp;P 500
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        {data.map((fenster, idx) => (
          <div key={idx} className="flex flex-col items-center gap-2">
            <div className="flex h-32 w-full items-end justify-center gap-1.5">
              <Bar value={fenster.ddStock} max={maxDrawdown} colorClass="bg-gold-500" />
              <Bar value={fenster.ddIndex} max={maxDrawdown} colorClass="bg-navy-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-navy-800">{fenster.name}</p>
              {fenster.zeitraum && (
                <p className="text-[10px] text-navy-500">{fenster.zeitraum}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Bar({
  value,
  max,
  colorClass,
}: {
  value: number | null | undefined
  max: number
  colorClass: string
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <div className="flex h-full w-6 flex-col items-center justify-end">
        <span className="mb-1 text-[9px] leading-tight text-navy-400">keine Daten</span>
        <div className="h-0.5 w-full rounded-t bg-navy-200" />
      </div>
    )
  }

  const maxBarPx = 96
  const heightPx = Math.max(2, (Math.abs(value) / max) * maxBarPx)
  const pct = Math.abs(value) * 100
  return (
    <div className="flex h-full w-6 flex-col items-center justify-end">
      <span className="mb-1 text-[10px] font-semibold text-navy-800">-{pct.toFixed(1)}%</span>
      <div className={`w-full rounded-t ${colorClass}`} style={{ height: `${heightPx}px` }} />
    </div>
  )
}
