import type { GlossaryTerm } from '../../lib/glossary'
import type { StockAnalysis, WarningEntry } from '../../types/database'
import type { IndexWeighting } from '../../lib/webhooks'
import { scoreLabel, scoreLabelColorClass, scoreBandHex, scoreBandFill } from '../../lib/score'
import { formatMarketCap } from '../../lib/memoFormat'
import { InfoTooltip } from '../InfoTooltip'

// Kopfbereich einer Analyse (Logo, Name, Score, Kennzahlenzeile,
// Firmenbeschreibung, Radar) - gemeinsam fuer Analyseseite und Druckansicht.
// printMode: Beschreibung immer vollstaendig, ohne "mehr anzeigen".
export function AnalysisHeader({
  analysis,
  indexWeightings,
  descExpanded = false,
  onToggleDesc,
  printMode = false,
}: {
  analysis: StockAnalysis
  indexWeightings: IndexWeighting[]
  descExpanded?: boolean
  onToggleDesc?: () => void
  printMode?: boolean
}) {
  const score = analysis.score_total
  const meta = analysis.chart_data?.profileMeta
  const marketCapText = formatMarketCap(meta?.marketCap, analysis.currency)
  const hasMetaRow = Boolean(marketCapText || meta?.industry || meta?.exchange || indexWeightings.length > 0)

  return (
  <div className="space-y-4 border-b border-memo-line2 pb-5">
    <div className="flex flex-wrap items-center gap-10">
      <div className="flex-1" style={{ minWidth: 280, flexGrow: 1.1 }}>
        <div className="flex items-start gap-3">
          {meta?.image && (
            <img
              src={meta.image}
              alt=""
              className="h-11 w-11 rounded-md border border-memo-line2 bg-white object-contain"
            />
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-memo-muted">
              {analysis.ticker}
              {analysis.sector ? ` · ${analysis.sector}` : ''}
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-analyst text-3xl text-memo-ink">
                {analysis.company_name ?? analysis.ticker}
              </h1>
              <span className="flex items-baseline gap-1.5">
                <span className="font-analyst text-2xl text-memo-ink">
                  {score != null ? score.toFixed(0) : '–'}
                </span>
                <span className={`text-xs font-semibold ${scoreLabelColorClass(score)}`}>
                  {scoreLabel(score)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {hasMetaRow && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-14 text-xs text-memo-muted">
            {marketCapText && (
              <span>
                Marktkap. <strong className="font-semibold text-memo-ink">{marketCapText}</strong>
                <InfoTooltip term="marktkap" />
              </span>
            )}
            {marketCapText && (meta?.industry || meta?.exchange) && <span>·</span>}
            {meta?.industry && (
              <span>
                Segment <strong className="font-semibold text-memo-ink">{meta.industry}</strong>
              </span>
            )}
            {meta?.industry && meta?.exchange && <span>·</span>}
            {meta?.exchange && (
              <span>
                Börse <strong className="font-semibold text-memo-ink">{meta.exchange}</strong>
              </span>
            )}
            {(marketCapText || meta?.industry || meta?.exchange) && indexWeightings.length > 0 && (
              <span>·</span>
            )}
            {indexWeightings.map((w, i) => (
              <span key={w.indexId}>
                {i > 0 && <span className="mr-2">·</span>}
                {w.label}{' '}
                <strong className="font-semibold text-memo-ink">
                  {w.weightPct.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
                </strong>{' '}
                Gewichtung
                {i === 0 && <InfoTooltip term="indexGewichtung" />}
              </span>
            ))}
          </div>
        )}

        {meta?.description && (
          <div className="mt-2 pl-14">
            <p className={`text-xs leading-relaxed text-memo-muted ${descExpanded || printMode ? '' : 'line-clamp-3'}`}>
              {meta.description}
            </p>
            {!printMode && meta.description.length > 220 && (
              <button
                type="button"
                onClick={onToggleDesc}
                className="mt-1 text-xs font-medium text-memo-ink underline hover:opacity-70"
              >
                {descExpanded ? 'weniger anzeigen' : 'mehr anzeigen'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center gap-8" style={{ minWidth: 280 }}>
        <AnalyseRadarChart analysis={analysis} />
      </div>
    </div>
  </div>
  )
}

// Warnungen einer Analyse (Text oder { text }-Objekte).
export function WarningsBox({ warnings }: { warnings: StockAnalysis['warnings'] }) {
  const list = normalizeWarnings(warnings)
  if (list.length === 0) return null
  return (
    <div className="rounded-sm border border-memo-line p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-memo-muted">Warnungen</p>
      <ul className="space-y-1 text-sm text-memo-ink">
        {list.map((w, idx) => (
          <li key={idx}>⚠ {w}</li>
        ))}
      </ul>
    </div>
  )
}

function normalizeWarnings(warnings: StockAnalysis['warnings']): string[] {
  if (!Array.isArray(warnings)) return []
  return warnings
    .map((w) => (typeof w === 'string' ? w : (w as WarningEntry | null)?.text))
    .filter((w): w is string => Boolean(w))
}

const RADAR_DIMENSIONS = [
  { key: 'score_qualitaet', label: 'Qualität', term: 'qualitaet' },
  { key: 'score_fundamental', label: 'Fundamental', term: 'fundamental' },
  { key: 'score_krise', label: 'Krise', term: 'krise' },
  { key: 'score_trend', label: 'Trend', term: 'trend' },
] as const satisfies { key: keyof StockAnalysis; label: string; term: GlossaryTerm }[]

function polarPoint(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

export function AnalyseRadarChart({ analysis }: { analysis: StockAnalysis }) {
  const cx = 95
  const cy = 95
  const rOuter = 78
  const angles = RADAR_DIMENSIONS.map((_, i) => -90 + i * 90)
  const values = RADAR_DIMENSIONS.map((d) => analysis[d.key] as number | null)

  const gridPoints = angles.map((a) => polarPoint(cx, cy, rOuter, a).join(',')).join(' ')
  const dataPoints = angles
    .map((a, i) => {
      const v = values[i]
      const r = v !== null && v !== undefined ? (Math.max(0, Math.min(100, v)) / 100) * rOuter : 0
      return polarPoint(cx, cy, r, a).join(',')
    })
    .join(' ')
  const bandHex = scoreBandHex(analysis.score_total)
  const bandFill = scoreBandFill(analysis.score_total)

  return (
    <div className="flex flex-wrap items-center gap-8">
      <svg width="190" height="190" viewBox="0 0 190 190" className="shrink-0">
        <polygon points={gridPoints} fill="none" stroke="#ddd" strokeWidth="1" />
        <polygon points={dataPoints} fill={bandFill} stroke={bandHex} strokeWidth="1.5" />
      </svg>
      <div className="space-y-2 text-sm text-memo-ink">
        {RADAR_DIMENSIONS.map((d, i) => {
          const v = values[i]
          return (
            <div key={d.key} className="flex items-center gap-2.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: scoreBandHex(v) }} />
              <span>
                {d.label} {v !== null && v !== undefined ? v.toFixed(0) : '–'}
                <InfoTooltip term={d.term} />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
