import { useId, useState } from 'react'
import type { MonthlyPricePoint, RelativeStrengthPoint, ReturnBar, PrognosePfadPunkt } from '../../types/database'
import { MEMO_PLUS, MEMO_MINUS, MEMO_GRAU } from '../../lib/memoColors.js'

// Plus/Minus/Grau kommen aus lib/memoColors.js (einzige, Palette-Validator-
// gepruefte Quelle - siehe dortige Kommentare). PLUS_TEXT/MINUS_TEXT sind
// bewusst identisch mit PLUS/MINUS, keine getrennte Text-Variante mehr noetig.
const COLOR_PLUS = MEMO_PLUS
const COLOR_PLUS_TEXT = MEMO_PLUS
const COLOR_MINUS = MEMO_MINUS
const COLOR_MINUS_TEXT = MEMO_MINUS
const COLOR_GRAU = MEMO_GRAU
const COLOR_INK = '#1a1a1a'
const COLOR_LINE = '#dddddd'
const COLOR_MUTED = '#999999'

// Neutrale Kategorie-Farben fuer Mehrfach-Linien-Charts, die KEINE
// positiv/negativ-Bewertung transportieren (z.B. Bruttogewinn/EBIT/EBITDA/
// Nettogewinn oder Margen-Arten) - bewusst getrennt von COLOR_PLUS_TEXT/
// COLOR_MINUS_TEXT, die im Projekt durchgaengig "positiv"/"negativ"
// bedeuten (Quick-Check, K.O.-Badges). Dunkel->hell gestaffelt passend zur
// Groessenhierarchie der jeweiligen Kennzahlen.
const CATEGORY_LINE_COLORS = [COLOR_INK, '#41545f', '#6d818c', '#9caab2']

// Linienstile je Serie (durchgezogen/gestrichelt/gepunktet/Strich-Punkt) -
// macht jede Linie auch ohne Farbwahrnehmung eindeutig, zusaetzlich zur Farbe.
const LINE_DASH_PATTERNS = ['', '7 4', '1.5 3.5', '9 3 2 3']

function EmptyNote({ text }: { text: string }) {
  return <p className="py-8 text-center text-xs text-memo-muted">{text}</p>
}

// Waehlt eine begrenzte, gleichmaessig verteilte Auswahl an X-Achsen-Ticks -
// haelt die Beschriftung auch bei 10-20 Datenpunkten lesbar, statt jeden
// einzelnen Punkt zu beschriften.
function pickTickIndices(count: number, maxLabels: number): number[] {
  if (count <= 0) return []
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i)
  const step = Math.ceil((count - 1) / (maxLabels - 1))
  const idx: number[] = []
  for (let i = 0; i < count; i += step) idx.push(i)
  if (idx[idx.length - 1] !== count - 1) idx.push(count - 1)
  return idx
}

/**
 * Kursverlauf, logarithmische Skala, gesamte Monats-Historie.
 * `indexData` (optional): S&P-500-Monatsschlusskurse ueber denselben Zeitraum,
 * wird auf den Startwert der Aktie normiert (skaliert), damit beide Linien
 * auf derselben Preisskala direkt vergleichbar sind - kein eigener Massstab.
 */
export function LogPriceChart({
  data,
  indexData,
  height = 220,
}: {
  data: MonthlyPricePoint[]
  indexData?: MonthlyPricePoint[]
  height?: number
}) {
  const gid = useId()
  if (!data || data.length < 2) return <EmptyNote text="Keine ausreichende Kurshistorie verfügbar." />

  const width = 800
  const marginLeft = 52
  const marginBottom = 22
  const marginTop = 10
  const plotW = width - marginLeft - 8
  const plotH = height - marginTop - marginBottom

  let indexNormalized: (number | null)[] | null = null
  if (indexData && indexData.length > 0) {
    const indexByMonth = new Map(indexData.map((d) => [d.date.slice(0, 7), d.close]))
    const baseIndexClose = indexByMonth.get(data[0].date.slice(0, 7))
    if (baseIndexClose) {
      const scale = data[0].close / baseIndexClose
      indexNormalized = data.map((d) => {
        const idxClose = indexByMonth.get(d.date.slice(0, 7))
        return idxClose != null ? idxClose * scale : null
      })
    }
  }

  const logs = data.map((d) => Math.log(d.close))
  const indexLogVals = (indexNormalized ?? []).filter((v): v is number => v != null).map((v) => Math.log(v))
  const minLog = Math.min(...logs, ...indexLogVals)
  const maxLog = Math.max(...logs, ...indexLogVals)
  const span = maxLog - minLog || 1

  const x = (i: number) => marginLeft + (i / (data.length - 1)) * plotW
  const y = (logVal: number) => marginTop + (1 - (logVal - minLog) / span) * plotH

  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(Math.log(d.close)).toFixed(1)}`).join(' ')

  const indexPathSegments: string[] = []
  if (indexNormalized) {
    let current: string[] = []
    indexNormalized.forEach((v, i) => {
      if (v != null) {
        current.push(`${current.length === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(Math.log(v)).toFixed(1)}`)
      } else if (current.length) {
        indexPathSegments.push(current.join(' '))
        current = []
      }
    })
    if (current.length) indexPathSegments.push(current.join(' '))
  }

  // 4 Referenzlinien inkl. Min/Max
  const ticks = [0, 1, 2, 3].map((t) => minLog + (span * t) / 3)
  const yearTicks = [0, Math.floor((data.length - 1) / 2), data.length - 1]

  return (
    <div>
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
        {indexPathSegments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={COLOR_MUTED} strokeWidth={1} opacity={0.85} clipPath={`url(#${gid}-clip)`} />
        ))}
        <path d={pathD} fill="none" stroke={COLOR_INK} strokeWidth={1.75} clipPath={`url(#${gid}-clip)`} />
      </svg>
      {indexNormalized && (
        <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-memo-muted">
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: COLOR_INK }} />
            Kurs
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: COLOR_MUTED }} />
            S&amp;P 500 (auf Startkurs normiert)
          </span>
        </div>
      )}
    </div>
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
  referenceLine,
}: {
  years: string[]
  values: (number | null)[]
  signed?: boolean
  height?: number
  formatValue?: (v: number) => string
  referenceLine?: { value: number; label: string }
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
  const maxAbs = Math.max(1e-9, referenceLine?.value ?? 0, ...validValues.map((v) => Math.abs(v)))
  const barGap = 5
  const barW = plotW / values.length - barGap
  const availHUnsigned = height - marginBottom - plotTopY
  const referenceY = referenceLine ? height - marginBottom - (referenceLine.value / maxAbs) * availHUnsigned : null

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {signed && <line x1={marginLeft} x2={width - 8} y1={zeroY} y2={zeroY} stroke={COLOR_LINE} strokeWidth={1} />}
      {referenceLine && referenceY != null && (
        <g>
          <title>{referenceLine.label}</title>
          <line
            x1={marginLeft}
            x2={width - 8}
            y1={referenceY}
            y2={referenceY}
            stroke={COLOR_MUTED}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text x={width - 8} y={referenceY - 3} textAnchor="end" fontSize={7} fill={COLOR_MUTED}>
            {referenceLine.label}
          </text>
        </g>
      )}
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
              {years[i] && years[i].length > 2 ? years[i].slice(2) : years[i]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

type LineSeries = { label: string; values: (number | null)[] }
type EndLabel = { i: number; label: string; value: number; x: number; y: number }

function lastValidIndex(values: (number | null)[]): number {
  for (let i = values.length - 1; i >= 0; i--) if (typeof values[i] === 'number') return i
  return -1
}

/**
 * Generischer Mehrfach-Linien-Chart fuer Zeitreihen (1-4 Serien) - Vorbild
 * fuer Farbe/Linienfuehrung ist der Kursverlauf-Chart (LogPriceChart), nur
 * linear statt log und mit bis zu 4 Serien statt zwei. Jede Serie bekommt
 * neben der Farbe (CATEGORY_LINE_COLORS) ein eigenes stroke-dasharray
 * (LINE_DASH_PATTERNS), damit sie auch ohne Farbwahrnehmung unterscheidbar
 * ist, sowie eine Direktbeschriftung am rechten Linienende (bei zu eng
 * beieinanderliegenden Werten vertikal versetzt). Bei mehr als einer Serie
 * ist die Legende darunter klickbar (Serie ein-/ausblenden, ausgeblendete
 * Eintraege auf 40% Deckkraft). Die X-Achsen-Beschriftung waehlt automatisch
 * weniger Ticks bei vielen Datenpunkten (siehe pickTickIndices) - bleibt
 * damit auch bei 10-20 Jahren Historie lesbar.
 */
export function MultiLineChart({
  years,
  series,
  height = 110,
  width = 320,
  marginLeft = 8,
  marginRight = 70,
  showYAxis = false,
  showNameInEndLabel = false,
  formatValue,
}: {
  years: string[]
  series: LineSeries[]
  height?: number
  width?: number
  marginLeft?: number
  marginRight?: number
  showYAxis?: boolean
  showNameInEndLabel?: boolean
  formatValue?: (v: number) => string
}) {
  const [hidden, setHidden] = useState<Set<number>>(() => new Set())

  const anyData = series.some((s) => s.values.some((v) => typeof v === 'number'))
  if (!anyData) return <EmptyNote text="Keine Daten verfügbar." />

  const marginBottom = 16
  const marginTop = 6
  const plotW = width - marginLeft - marginRight
  const plotH = height - marginTop - marginBottom

  const visibleSeries = series.filter((_, i) => !hidden.has(i))
  const scaleSource = visibleSeries.length > 0 ? visibleSeries : series
  const scaleVals = scaleSource.flatMap((s) => s.values).filter((v): v is number => typeof v === 'number')
  const minV = Math.min(0, ...scaleVals)
  const maxV = Math.max(...scaleVals)
  const span = maxV - minV || 1

  const x = (i: number) => marginLeft + (years.length > 1 ? (i / (years.length - 1)) * plotW : plotW / 2)
  const y = (v: number) => marginTop + (1 - (v - minV) / span) * plotH

  const yTicks = showYAxis ? [0, 1, 2, 3].map((t) => minV + (span * t) / 3) : []
  const xTickIdx = pickTickIndices(years.length, showYAxis ? 8 : 5)
  const fontSize = showYAxis ? 10 : 8
  const lineWidth = showYAxis ? 1.75 : 1.5

  const endLabels: EndLabel[] = series
    .map((s, i) => {
      if (hidden.has(i)) return null
      const li = lastValidIndex(s.values)
      if (li < 0) return null
      const v = s.values[li] as number
      return { i, label: s.label, value: v, x: x(li), y: y(v) }
    })
    .filter((e): e is EndLabel => e !== null)
    .sort((a, b) => a.y - b.y)
  const minGap = fontSize + 2
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].y - endLabels[i - 1].y < minGap) {
      endLabels[i].y = endLabels[i - 1].y + minGap
    }
  }

  function toggle(i: number) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={marginLeft} x2={width - marginRight} y1={y(t)} y2={y(t)} stroke={COLOR_LINE} strokeWidth={1} />
            <text x={marginLeft - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill={COLOR_MUTED}>
              {formatValue ? formatValue(t) : t.toFixed(0)}
            </text>
          </g>
        ))}
        {xTickIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 4}
            textAnchor={i === 0 ? 'start' : i === years.length - 1 ? 'end' : 'middle'}
            fontSize={fontSize}
            fill={COLOR_MUTED}
          >
            {showYAxis ? years[i] : years[i]?.slice(2)}
          </text>
        ))}
        {series.map((s, si) => {
          if (hidden.has(si)) return null
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
          const color = CATEGORY_LINE_COLORS[si % CATEGORY_LINE_COLORS.length]
          const dash = LINE_DASH_PATTERNS[si % LINE_DASH_PATTERNS.length]
          return segments.map((d, di) => (
            <path
              key={`${si}-${di}`}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={lineWidth}
              strokeDasharray={dash || undefined}
            />
          ))
        })}
        {endLabels.map((e) => (
          <text key={e.i} x={e.x + 4} y={e.y + 3} fontSize={fontSize} fill={CATEGORY_LINE_COLORS[e.i % CATEGORY_LINE_COLORS.length]}>
            {showNameInEndLabel ? `${e.label} ${formatValue ? formatValue(e.value) : e.value}` : formatValue ? formatValue(e.value) : e.value}
          </text>
        ))}
      </svg>
      {series.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-memo-muted">
          {series.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className="flex items-center transition-opacity"
              style={{ opacity: hidden.has(i) ? 0.4 : 1 }}
            >
              <span
                className="mr-1 inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: CATEGORY_LINE_COLORS[i % CATEGORY_LINE_COLORS.length] }}
              />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
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

const COLOR_HISTORY = '#7a7a7a'

// Wandelt ein Monats-Datum ("YYYY-MM-DD") in einen fraktionalen Jahreswert
// um (z.B. "2024-07-15" -> 2024.5) - gemeinsame X-Achsen-Skala fuer die
// monatlich aufgeloeste Historie und den nur jaehrlich aufgeloesten
// Prognose-Pfad, siehe CorridorChart().
function fracYear(dateStr: string): number {
  const [y, m] = dateStr.split('-').map(Number)
  return y + ((m ?? 1) - 1) / 12
}

/**
 * Erwartungskorridor: letzte 5 Jahre tatsaechlicher Kurshistorie (duenne
 * graue Linie) gehen nahtlos in den Baer/Basis/Bull-Prognose-Faecher
 * (ab dem aktuellen Jahr) ueber - eine durchgehende Y-Achse, kein
 * getrenntes Chart.
 *
 * Der Nahtpunkt (letzter Historien-Punkt = erster Prognose-Punkt) wird
 * bewusst auf den Prognose-Startwert (pfad[0], baer=basis=bull=
 * aktueller Kurs) gelegt statt auf den zuletzt bekannten historischen
 * Schlusskurs - beide Werte stammen aus getrennten Datenabrufen und
 * koennten leicht auseinanderlaufen, was am Uebergang wie ein Sprung
 * aussaehe. So ist die Nahtlosigkeit per Konstruktion garantiert.
 */
export function CorridorChart({
  pfad,
  historie,
  height = 240,
}: {
  pfad: PrognosePfadPunkt[]
  historie?: MonthlyPricePoint[]
  height?: number
}) {
  if (!pfad || pfad.length < 2) return <EmptyNote text="Kein Erwartungskorridor berechenbar (fehlende Analysten-Schätzungen)." />

  const width = 800
  const marginLeft = 56
  const marginBottom = 22
  const marginTop = 10
  const plotW = width - marginLeft - 8
  const plotH = height - marginTop - marginBottom

  const allForecastValues = pfad.flatMap((p) => [p.baer, p.basis, p.bull]).filter((v): v is number => typeof v === 'number')
  if (allForecastValues.length === 0) return <EmptyNote text="Kein Erwartungskorridor berechenbar (fehlende Analysten-Schätzungen)." />

  const seamYear = pfad[0].jahr
  const seamValue = pfad[0].basis ?? pfad[0].baer ?? pfad[0].bull ?? null

  const histFiltered = (historie ?? [])
    .filter((p) => typeof p.close === 'number' && Number(p.date.slice(0, 4)) >= seamYear - 5 && Number(p.date.slice(0, 4)) <= seamYear)
    .sort((a, b) => a.date.localeCompare(b.date))

  const histPoints = histFiltered.map((p) => ({ x: fracYear(p.date), v: p.close }))
  // Letzten Historien-Punkt auf den Prognose-Startwert "umbiegen" (siehe
  // Kommentar oben) - Position (x) bleibt der echte letzte Kurstermin,
  // nur der Wert (v) wird an den Nahtpunkt angeglichen.
  if (histPoints.length > 0 && seamValue != null) {
    histPoints[histPoints.length - 1] = { x: histPoints[histPoints.length - 1].x, v: seamValue }
  }
  const seamX = histPoints.length > 0 ? histPoints[histPoints.length - 1].x : seamYear

  const forecastPoints = pfad.map((p) => ({ ...p, x: seamX + (p.jahr - seamYear) }))

  const allValues = [...histPoints.map((p) => p.v), ...allForecastValues]
  const minV = Math.min(...allValues)
  const maxV = Math.max(...allValues)
  const span = maxV - minV || 1

  const xMin = histPoints.length > 0 ? histPoints[0].x : seamX
  const xMax = forecastPoints[forecastPoints.length - 1].x
  const xSpan = xMax - xMin || 1

  const xScale = (xv: number) => marginLeft + ((xv - xMin) / xSpan) * plotW
  const y = (v: number) => marginTop + (1 - (v - minV) / span) * plotH

  const histPath = histPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')

  function linePath(key: 'baer' | 'basis' | 'bull') {
    const pts = forecastPoints.map((p, i) => (typeof p[key] === 'number' ? `${i === 0 ? 'M' : 'L'} ${xScale(p.x).toFixed(1)} ${y(p[key] as number).toFixed(1)}` : null)).filter(Boolean)
    return pts.join(' ')
  }

  const bandTop = forecastPoints.map((p, i) => (typeof p.bull === 'number' ? `${i === 0 ? 'M' : 'L'} ${xScale(p.x).toFixed(1)} ${y(p.bull).toFixed(1)}` : '')).join(' ')
  const bandBottom = forecastPoints.slice().reverse().map((p, i) => {
    const idx = forecastPoints.length - 1 - i
    return typeof p.baer === 'number' ? `L ${xScale(forecastPoints[idx].x).toFixed(1)} ${y(p.baer).toFixed(1)}` : ''
  }).join(' ')
  const bandPath = `${bandTop} ${bandBottom} Z`

  const ticks = [0, 1, 2, 3].map((t) => minV + (span * t) / 3)

  // X-Achsen-Jahresbeschriftung: ein Label je Kalenderjahr aus der
  // Historie (am jeweils ersten verfuegbaren Monatspunkt des Jahres) plus
  // ein Label je Prognose-Jahr (wie zuvor) - das Nahtjahr wird nur einmal
  // beschriftet (durch den Prognose-Punkt, nicht zusaetzlich durch die
  // Historie).
  const histYearLabels: { x: number; label: string }[] = []
  const seenYears = new Set<number>()
  for (const p of histPoints) {
    const yr = Math.floor(p.x)
    if (yr === seamYear || seenYears.has(yr)) continue
    seenYears.add(yr)
    histYearLabels.push({ x: p.x, label: String(yr) })
  }
  const forecastYearLabels = forecastPoints.map((p) => ({ x: p.x, label: String(p.jahr) }))
  const yearLabels = [...histYearLabels, ...forecastYearLabels]

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
      {histPoints.length > 1 && <path d={histPath} fill="none" stroke={COLOR_HISTORY} strokeWidth={1.25} />}
      <path d={linePath('bull')} fill="none" stroke={COLOR_PLUS} strokeWidth={1.75} />
      <path d={linePath('basis')} fill="none" stroke={COLOR_INK} strokeWidth={1.75} />
      <path d={linePath('baer')} fill="none" stroke={COLOR_MINUS} strokeWidth={1.75} />
      {histPoints.length > 1 && (
        <>
          <line x1={xScale(seamX)} x2={xScale(seamX)} y1={marginTop} y2={marginTop + plotH} stroke={COLOR_MUTED} strokeWidth={1} strokeDasharray="2 3" />
          <text x={xScale(seamX)} y={marginTop + 9} textAnchor="middle" fontSize={9} fill={COLOR_MUTED}>
            heute
          </text>
        </>
      )}
      {yearLabels.map((l, i) => (
        <text key={i} x={xScale(l.x)} y={height - 4} textAnchor={i === 0 ? 'start' : i === yearLabels.length - 1 ? 'end' : 'middle'} fontSize={10} fill={COLOR_MUTED}>
          {l.label}
        </text>
      ))}
    </svg>
  )
}

