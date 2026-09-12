import { Fragment, useId } from 'react'
import type { MonthlyPricePoint, RelativeStrengthPoint, ReturnBar, PrognosePfadPunkt } from '../../types/database'

const COLOR_PLUS = '#7f9482'
const COLOR_PLUS_TEXT = '#4a7a58'
const COLOR_MINUS = '#b9776c'
const COLOR_MINUS_TEXT = '#a9564c'
const COLOR_GRAU = '#9a978f'
const COLOR_INK = '#1a1a1a'
const COLOR_LINE = '#dddddd'
const COLOR_MUTED = '#999999'

function EmptyNote({ text }: { text: string }) {
  return <p className="py-8 text-center text-xs text-memo-muted">{text}</p>
}

/** Kursverlauf, logarithmische Skala, gesamte Monats-Historie. */
export function LogPriceChart({ data, height = 220 }: { data: MonthlyPricePoint[]; height?: number }) {
  const gid = useId()
  if (!data || data.length < 2) return <EmptyNote text="Keine ausreichende Kurshistorie verfügbar." />

  const width = 800
  const marginLeft = 52
  const marginBottom = 22
  const marginTop = 10
  const plotW = width - marginLeft - 8
  const plotH = height - marginTop - marginBottom

  const logs = data.map((d) => Math.log(d.close))
  const minLog = Math.min(...logs)
  const maxLog = Math.max(...logs)
  const span = maxLog - minLog || 1

  const x = (i: number) => marginLeft + (i / (data.length - 1)) * plotW
  const y = (logVal: number) => marginTop + (1 - (logVal - minLog) / span) * plotH

  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(Math.log(d.close)).toFixed(1)}`).join(' ')

  // 4 Referenzlinien inkl. Min/Max
  const ticks = [0, 1, 2, 3].map((t) => minLog + (span * t) / 3)
  const yearTicks = [0, Math.floor((data.length - 1) / 2), data.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <clipPath id={`${gid}-clip`}>
          <rect x={marginLeft} y={marginTop} width={plotW} height={plotH} />
        </clipPath>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={marginLeft} x2={width - 8} y1={y(t)} y2={y(t)} stroke={COLOR_LINE} strokeWidth={1} />
          <text x={marginLeft - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill={COLOR_MUTED}>
            {Math.exp(t).toFixed(0)}
          </text>
        </g>
      ))}
      {yearTicks.map((i, idx) => (
        <text key={idx} x={x(i)} y={height - 4} textAnchor={idx === 0 ? 'start' : idx === yearTicks.length - 1 ? 'end' : 'middle'} fontSize={10} fill={COLOR_MUTED}>
          {data[i].date.slice(0, 7)}
        </text>
      ))}
      <path d={pathD} fill="none" stroke={COLOR_INK} strokeWidth={1.75} clipPath={`url(#${gid}-clip)`} />
    </svg>
  )
}

/** Symmetrische Gewinn-/Drawdown-Balken um eine Nulllinie. */
export function ReturnBarsChart({ data, height = 160 }: { data: ReturnBar[]; height?: number }) {
  if (!data || data.length === 0) return <EmptyNote text="Keine Zeitfenster verfügbar." />

  const width = 800
  const marginLeft = 40
  const marginRight = 8
  const marginBottom = 18
  const plotW = width - marginLeft - marginRight
  const zeroY = (height - marginBottom) / 2
  const maxAbs = Math.max(0.05, ...data.map((d) => Math.abs(d.pct)))
  const barGap = 4
  const barW = plotW / data.length - barGap

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <line x1={marginLeft} x2={width - marginRight} y1={zeroY} y2={zeroY} stroke={COLOR_MUTED} strokeWidth={1} />
      <text x={marginLeft - 6} y={zeroY + 3} textAnchor="end" fontSize={10} fill={COLOR_MUTED}>0%</text>
      {data.map((d, i) => {
        const x = marginLeft + i * (barW + barGap)
        const barH = (Math.abs(d.pct) / maxAbs) * (zeroY - 6)
        const isPlus = d.pct >= 0
        const barY = isPlus ? zeroY - barH : zeroY
        return (
          <g key={i}>
            <title>{`${d.period}: ${(d.pct * 100).toFixed(1)}%`}</title>
            <rect x={x} y={barY} width={Math.max(2, barW)} height={Math.max(1, barH)} fill={isPlus ? COLOR_PLUS : COLOR_MINUS} rx={1} />
            <text x={x + barW / 2} y={height - 4} textAnchor="middle" fontSize={9} fill={COLOR_MUTED}>
              {d.period}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Fortlaufende relative Staerke Aktie/Index (indexiert auf 100 am Start). */
export function RelativeStrengthChart({ data, height = 160 }: { data: RelativeStrengthPoint[]; height?: number }) {
  if (!data || data.length < 2) return <EmptyNote text="Keine relative Stärke berechenbar." />

  const width = 800
  const marginLeft = 44
  const marginBottom = 18
  const marginTop = 8
  const plotW = width - marginLeft - 8
  const plotH = height - marginTop - marginBottom

  const values = data.map((d) => d.value)
  const minV = Math.min(100, ...values)
  const maxV = Math.max(100, ...values)
  const span = maxV - minV || 1
  const x = (i: number) => marginLeft + (i / (data.length - 1)) * plotW
  const y = (v: number) => marginTop + (1 - (v - minV) / span) * plotH

  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <line x1={marginLeft} x2={width - 8} y1={y(100)} y2={y(100)} stroke={COLOR_MUTED} strokeWidth={1} strokeDasharray="3,3" />
      <text x={marginLeft - 6} y={y(100) + 3} textAnchor="end" fontSize={10} fill={COLOR_MUTED}>100</text>
      <path d={pathD} fill="none" stroke={COLOR_INK} strokeWidth={1.75} />
      <text x={width - 8} y={marginTop + 8} textAnchor="end" fontSize={9} fill={COLOR_MUTED}>
        vs. S&amp;P 500
      </text>
    </svg>
  )
}

/** Kleines/grosses Zeitreihen-Balkendiagramm fuer die Fundamental-Kennzahlen. */
export function SeriesBarChart({
  years,
  values,
  signed = false,
  height = 110,
  formatValue,
}: {
  years: string[]
  values: (number | null)[]
  signed?: boolean
  height?: number
  formatValue?: (v: number) => string
}) {
  const validIdx = values.map((v, i) => (typeof v === 'number' ? i : -1)).filter((i) => i >= 0)
  if (validIdx.length === 0) return <EmptyNote text="Keine Daten verfügbar." />

  const width = 320
  const marginLeft = 8
  const marginBottom = 16
  const marginTop = 6
  const plotW = width - marginLeft - 8
  const zeroY = signed ? (height - marginBottom - marginTop) / 2 + marginTop : height - marginBottom
  const plotTopY = marginTop

  const validValues = validIdx.map((i) => values[i] as number)
  const maxAbs = Math.max(1e-9, ...validValues.map((v) => Math.abs(v)))
  const barGap = 5
  const barW = plotW / values.length - barGap

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {signed && <line x1={marginLeft} x2={width - 8} y1={zeroY} y2={zeroY} stroke={COLOR_LINE} strokeWidth={1} />}
      {values.map((v, i) => {
        const x = marginLeft + i * (barW + barGap)
        if (typeof v !== 'number') {
          return (
            <text key={i} x={x + barW / 2} y={height - 4} textAnchor="middle" fontSize={8} fill={COLOR_GRAU}>
              –
            </text>
          )
        }
        const isPlus = v >= 0
        const availH = signed ? Math.max(zeroY - plotTopY, height - marginBottom - zeroY) : height - marginBottom - plotTopY
        const barH = (Math.abs(v) / maxAbs) * availH
        const barY = signed ? (isPlus ? zeroY - barH : zeroY) : height - marginBottom - barH
        const color = signed ? (isPlus ? COLOR_PLUS : COLOR_MINUS) : COLOR_INK
        return (
          <g key={i}>
            <title>{`${years[i]}: ${formatValue ? formatValue(v) : v}`}</title>
            <rect x={x} y={barY} width={Math.max(2, barW)} height={Math.max(1, barH)} fill={color} rx={1} opacity={0.85} />
            <text x={x + barW / 2} y={height - 4} textAnchor="middle" fontSize={8} fill={COLOR_MUTED}>
              {years[i]?.slice(2)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** 3-Segment-Wahrscheinlichkeitsbalken Baer/Basis/Bull. */
export function ProbabilityBar({ baer, basis, bull }: { baer: number; basis: number; bull: number }) {
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-sm border border-memo-line">
        <div style={{ width: `${baer * 100}%`, backgroundColor: COLOR_MINUS }} title={`Bär: ${(baer * 100).toFixed(0)}%`} />
        <div style={{ width: `${basis * 100}%`, backgroundColor: COLOR_GRAU }} title={`Basis: ${(basis * 100).toFixed(0)}%`} />
        <div style={{ width: `${bull * 100}%`, backgroundColor: COLOR_PLUS }} title={`Bull: ${(bull * 100).toFixed(0)}%`} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-memo-muted">
        <span style={{ color: COLOR_MINUS_TEXT }}>Bär {(baer * 100).toFixed(0)}%</span>
        <span>Basis {(basis * 100).toFixed(0)}%</span>
        <span style={{ color: COLOR_PLUS_TEXT }}>Bull {(bull * 100).toFixed(0)}%</span>
      </div>
    </div>
  )
}

/** Erwartungskorridor: Baer/Basis/Bull-Kurspfade mit Wahrscheinlichkeitsflaeche. */
export function CorridorChart({ pfad, height = 240 }: { pfad: PrognosePfadPunkt[]; height?: number }) {
  if (!pfad || pfad.length < 2) return <EmptyNote text="Kein Erwartungskorridor berechenbar (fehlende Analysten-Schätzungen)." />

  const width = 800
  const marginLeft = 56
  const marginBottom = 22
  const marginTop = 10
  const plotW = width - marginLeft - 8
  const plotH = height - marginTop - marginBottom

  const allValues = pfad.flatMap((p) => [p.baer, p.basis, p.bull]).filter((v): v is number => typeof v === 'number')
  if (allValues.length === 0) return <EmptyNote text="Kein Erwartungskorridor berechenbar (fehlende Analysten-Schätzungen)." />

  const minV = Math.min(...allValues)
  const maxV = Math.max(...allValues)
  const span = maxV - minV || 1
  const x = (i: number) => marginLeft + (i / (pfad.length - 1)) * plotW
  const y = (v: number) => marginTop + (1 - (v - minV) / span) * plotH

  function linePath(key: 'baer' | 'basis' | 'bull') {
    const pts = pfad.map((p, i) => (typeof p[key] === 'number' ? `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p[key] as number).toFixed(1)}` : null)).filter(Boolean)
    return pts.join(' ')
  }

  const bandTop = pfad.map((p, i) => (typeof p.bull === 'number' ? `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.bull).toFixed(1)}` : '')).join(' ')
  const bandBottom = pfad.slice().reverse().map((p, i) => {
    const idx = pfad.length - 1 - i
    return typeof p.baer === 'number' ? `L ${x(idx).toFixed(1)} ${y(p.baer).toFixed(1)}` : ''
  }).join(' ')
  const bandPath = `${bandTop} ${bandBottom} Z`

  const ticks = [0, 1, 2, 3].map((t) => minV + (span * t) / 3)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={marginLeft} x2={width - 8} y1={y(t)} y2={y(t)} stroke={COLOR_LINE} strokeWidth={1} />
          <text x={marginLeft - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill={COLOR_MUTED}>
            {t.toFixed(0)}
          </text>
        </g>
      ))}
      <path d={bandPath} fill={COLOR_GRAU} opacity={0.12} stroke="none" />
      <path d={linePath('bull')} fill="none" stroke={COLOR_PLUS} strokeWidth={1.75} />
      <path d={linePath('basis')} fill="none" stroke={COLOR_INK} strokeWidth={1.75} />
      <path d={linePath('baer')} fill="none" stroke={COLOR_MINUS} strokeWidth={1.75} />
      {pfad.map((p, i) => (
        <text key={i} x={x(i)} y={height - 4} textAnchor={i === 0 ? 'start' : i === pfad.length - 1 ? 'end' : 'middle'} fontSize={10} fill={COLOR_MUTED}>
          {p.jahr}
        </text>
      ))}
    </svg>
  )
}

const MULTI_LINE_COLORS = [COLOR_INK, COLOR_PLUS_TEXT, COLOR_MINUS_TEXT]

/** Zwei gruppierte Balkenserien pro Jahr (z.B. operativer Cashflow + FCF). */
export function SeriesDualBarChart({
  years,
  seriesA,
  seriesB,
  labelA,
  labelB,
  height = 110,
}: {
  years: string[]
  seriesA: (number | null)[]
  seriesB: (number | null)[]
  labelA: string
  labelB: string
  height?: number
}) {
  const allVals = [...seriesA, ...seriesB].filter((v): v is number => typeof v === 'number')
  if (allVals.length === 0) return <EmptyNote text="Keine Daten verfügbar." />

  const width = 320
  const marginLeft = 8
  const marginBottom = 16
  const marginTop = 6
  const plotW = width - marginLeft - 8
  const zeroY = (height - marginBottom - marginTop) / 2 + marginTop
  const maxAbs = Math.max(1e-9, ...allVals.map((v) => Math.abs(v)))
  const groupGap = 6
  const groupW = plotW / years.length - groupGap
  const barW = (groupW - 2) / 2

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <line x1={marginLeft} x2={width - 8} y1={zeroY} y2={zeroY} stroke={COLOR_LINE} strokeWidth={1} />
        {years.map((yr, i) => {
          const gx = marginLeft + i * (groupW + groupGap)
          const a = seriesA[i]
          const b = seriesB[i]
          const availH = Math.max(zeroY - marginTop, height - marginBottom - zeroY)
          return (
            <Fragment key={i}>
              {typeof a === 'number' && (
                <rect
                  x={gx}
                  y={a >= 0 ? zeroY - (Math.abs(a) / maxAbs) * availH : zeroY}
                  width={Math.max(2, barW)}
                  height={Math.max(1, (Math.abs(a) / maxAbs) * availH)}
                  fill={COLOR_INK}
                  opacity={0.75}
                >
                  <title>{`${yr} ${labelA}: ${a}`}</title>
                </rect>
              )}
              {typeof b === 'number' && (
                <rect
                  x={gx + barW + 2}
                  y={b >= 0 ? zeroY - (Math.abs(b) / maxAbs) * availH : zeroY}
                  width={Math.max(2, barW)}
                  height={Math.max(1, (Math.abs(b) / maxAbs) * availH)}
                  fill={b >= 0 ? COLOR_PLUS : COLOR_MINUS}
                >
                  <title>{`${yr} ${labelB}: ${b}`}</title>
                </rect>
              )}
              <text x={gx + groupW / 2} y={height - 4} textAnchor="middle" fontSize={8} fill={COLOR_MUTED}>
                {yr.slice(2)}
              </text>
            </Fragment>
          )
        })}
      </svg>
      <div className="mt-1 flex gap-3 text-[10px] text-memo-muted">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: COLOR_INK, opacity: 0.75 }} />{labelA}</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: COLOR_PLUS }} />{labelB}</span>
      </div>
    </div>
  )
}

/** Mehrere Linienserien uebereinander (z.B. Brutto-/Operativ-/Nettomarge). */
export function SeriesMultiLineChart({
  years,
  series,
  height = 110,
  isPercent = true,
}: {
  years: string[]
  series: { label: string; values: (number | null)[] }[]
  height?: number
  isPercent?: boolean
}) {
  const allVals = series.flatMap((s) => s.values).filter((v): v is number => typeof v === 'number')
  if (allVals.length === 0) return <EmptyNote text="Keine Daten verfügbar." />

  const width = 320
  const marginLeft = 8
  const marginBottom = 16
  const marginTop = 6
  const plotW = width - marginLeft - 8
  const plotH = height - marginTop - marginBottom
  const minV = Math.min(0, ...allVals)
  const maxV = Math.max(...allVals)
  const span = maxV - minV || 1
  const x = (i: number) => marginLeft + (years.length > 1 ? (i / (years.length - 1)) * plotW : plotW / 2)
  const y = (v: number) => marginTop + (1 - (v - minV) / span) * plotH

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {series.map((s, si) => {
          const segments: string[] = []
          let current: string[] = []
          s.values.forEach((v, i) => {
            if (typeof v === 'number') {
              current.push(`${current.length === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
            } else if (current.length) {
              segments.push(current.join(' '))
              current = []
            }
          })
          if (current.length) segments.push(current.join(' '))
          return segments.map((d, di) => (
            <path key={`${si}-${di}`} d={d} fill="none" stroke={MULTI_LINE_COLORS[si % MULTI_LINE_COLORS.length]} strokeWidth={1.5} />
          ))
        })}
        {years.map((yr, i) => (
          <text key={i} x={x(i)} y={height - 4} textAnchor="middle" fontSize={8} fill={COLOR_MUTED}>
            {yr.slice(2)}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-memo-muted">
        {series.map((s, i) => (
          <span key={i}>
            <span
              className="mr-1 inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: MULTI_LINE_COLORS[i % MULTI_LINE_COLORS.length] }}
            />
            {s.label}
          </span>
        ))}
      </div>
      {isPercent && <span className="sr-only">Werte in Prozent</span>}
    </div>
  )
}
