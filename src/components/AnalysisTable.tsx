import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  applyTableView,
  assessmentText,
  ASSESSMENTS,
  DEFAULT_SORT,
  formatDate,
  formatPrice,
  hasKo,
  newsBlocked,
  nextSort,
  parseMinScore,
  type AnalysisTableRow,
  type Assessment,
  type SortKey,
  type SortState,
} from '../lib/analysisTable'
import { formatMarketCap } from '../lib/memoFormat'
import { scoreBandFill, scoreBandHex, scoreLabelColorClass } from '../lib/score'
import { deselectShown, headerState, selectShown, toggleSelection } from '../lib/selection'

// Gemeinsame Analyse-Tabelle: Watchlist (Ansicht "Tabelle"), "Letzte
// Analysen" und spaeter "Alle Analysen". Suche, Filter, Sortierung per
// Spaltenkopf, veraenderbare Spaltenbreiten, feste Kopfzeile. Die Auswahl
// (Checkboxen) liegt beim Aufrufer, weil sie je Einsatz etwas anderes
// bedeutet (Watchlist: Batch, "Letzte Analysen": zur Watchlist).

interface Column {
  id: string
  label: string
  title?: string
  sortKey?: SortKey
  width: number
  align?: 'right' | 'center'
}

const COLUMNS: Column[] = [
  { id: 'select', label: '', width: 36, align: 'center' },
  { id: 'ticker', label: 'Ticker', sortKey: 'ticker', width: 96 },
  { id: 'name', label: 'Name', sortKey: 'name', width: 200 },
  { id: 'sector', label: 'Sektor / Branche', sortKey: 'sector', width: 180 },
  { id: 'market_cap', label: 'Marktkap.', title: 'Marktkapitalisierung (FMP, nur Anzeige)', sortKey: 'market_cap', width: 110, align: 'right' },
  { id: 'price', label: 'Kurs', title: 'Kurs zum Analysezeitpunkt (FMP, nur Anzeige)', sortKey: 'price', width: 100, align: 'right' },
  { id: 'analysed_at', label: 'Analyse vom', sortKey: 'analysed_at', width: 100 },
  { id: 'score_total', label: 'Score', title: 'Gesamtscore', sortKey: 'score_total', width: 70, align: 'center' },
  { id: 'assessment', label: 'Einschätzung', width: 130 },
  { id: 'score_fundamental', label: 'Fund.', title: 'Fundamental', sortKey: 'score_fundamental', width: 64, align: 'center' },
  { id: 'score_qualitaet', label: 'Qual.', title: 'Qualität', sortKey: 'score_qualitaet', width: 64, align: 'center' },
  { id: 'score_krise', label: 'Krise', title: 'Krisenstabilität', sortKey: 'score_krise', width: 64, align: 'center' },
  { id: 'score_trend', label: 'Trend', title: 'Trend', sortKey: 'score_trend', width: 64, align: 'center' },
  { id: 'hints', label: 'Hinweise', width: 96 },
  { id: 'open', label: 'Analyse', width: 96 },
]

const DEFAULT_WIDTHS: Record<string, number> = Object.fromEntries(COLUMNS.map((c) => [c.id, c.width]))
const MIN_WIDTH = 36

function readWidths(storageKey: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${storageKey}.widths`)
    return raw ? { ...DEFAULT_WIDTHS, ...JSON.parse(raw) } : DEFAULT_WIDTHS
  } catch {
    return DEFAULT_WIDTHS
  }
}

function readTruncate(storageKey: string): boolean {
  try {
    return localStorage.getItem(`${storageKey}.truncate`) !== 'false'
  } catch {
    return true
  }
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Nur Komfort (Spaltenbreiten, Umbruch) - ohne Speicher gelten die Standards.
  }
}

// Farbige Plakette nach den Score-Baendern aus lib/score.ts
// (>= 70 gruen, 40-69 gelb, < 40 rot, ohne Wert grau "–").
export function ScoreBadge({ score, title }: { score: number | null; title?: string }) {
  return (
    <span
      title={title}
      className="inline-block min-w-[2.25rem] rounded-full border px-1.5 py-0.5 text-center text-xs font-semibold"
      style={{ color: scoreBandHex(score), borderColor: scoreBandHex(score), background: scoreBandFill(score) }}
    >
      {score == null ? '–' : Math.round(score)}
    </span>
  )
}

export function AnalysisTable({
  rows,
  storageKey,
  selected,
  onSelectionChange,
  maxSelection,
  selectionDisabled,
  isRowLocked,
  rowTag,
  onOpenTicker,
  onDownloadPdf,
  downloadingTicker,
  highlightedTicker,
  actions,
}: {
  rows: AnalysisTableRow[]
  // Schluessel fuer gespeicherte Spaltenbreiten/Umbruch je Einsatzort.
  storageKey: string
  selected: Set<string>
  onSelectionChange: (next: Set<string>) => void
  // Obergrenze der Auswahl (Watchlist: MAX_BATCH_SIZE fuer den Batch).
  maxSelection?: number
  selectionDisabled?: boolean
  // Zeile nicht auswaehlbar (z.B. schon auf der Watchlist).
  isRowLocked?: (ticker: string) => boolean
  // Kleiner Hinweis hinter dem Namen (z.B. "auf Watchlist").
  rowTag?: (ticker: string) => string | null
  onOpenTicker: (ticker: string) => void
  onDownloadPdf?: (ticker: string) => void
  downloadingTicker?: string | null
  highlightedTicker?: string | null
  // Zusaetzliche Knoepfe rechts in der Werkzeugleiste.
  actions?: ReactNode
}) {
  const [search, setSearch] = useState('')
  const [assessment, setAssessment] = useState<Assessment | ''>('')
  const [minScoreInput, setMinScoreInput] = useState('')
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [truncate, setTruncate] = useState(() => readTruncate(storageKey))
  const [widths, setWidths] = useState<Record<string, number>>(() => readWidths(storageKey))
  const drag = useRef<{ id: string; startX: number; startWidth: number } | null>(null)
  const [cappedNote, setCappedNote] = useState(false)

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = drag.current
      if (!d) return
      const w = Math.max(MIN_WIDTH, d.startWidth + e.clientX - d.startX)
      setWidths((prev) => ({ ...prev, [d.id]: w }))
    }
    function onUp() {
      if (!drag.current) return
      drag.current = null
      setWidths((prev) => {
        store(`${storageKey}.widths`, JSON.stringify(prev))
        return prev
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [storageKey])

  // Nur neu filtern/sortieren, wenn sich Daten oder Filter aendern - nicht
  // bei jedem Haken (INP bei ~250 Zeilen).
  const shown = useMemo(
    () => applyTableView(rows, { search, assessment, minScore: parseMinScore(minScoreInput) }, sort),
    [rows, search, assessment, minScoreInput, sort],
  )
  const selectable = shown.filter((r) => !isRowLocked?.(r.ticker)).map((r) => r.ticker)
  const header = headerState(selected, selectable)
  const max = maxSelection ?? Infinity

  // Stabile Callbacks fuer die memoisierten Zeilen: aktuelle Werte ueber
  // Refs, damit ein Haken nur die betroffene Zeile neu zeichnet.
  const latest = useRef({ selected, max, onSelectionChange, onOpenTicker, onDownloadPdf })
  useEffect(() => {
    latest.current = { selected, max, onSelectionChange, onOpenTicker, onDownloadPdf }
  })
  const handleToggle = useCallback((ticker: string) => {
    const l = latest.current
    const result = toggleSelection(l.selected, ticker, l.max)
    setCappedNote(result.capped)
    l.onSelectionChange(result.next)
  }, [])
  const handleOpen = useCallback((ticker: string) => latest.current.onOpenTicker(ticker), [])
  const handlePdf = useCallback((ticker: string) => latest.current.onDownloadPdf?.(ticker), [])

  function apply(result: { next: Set<string>; capped: boolean }) {
    setCappedNote(result.capped)
    onSelectionChange(result.next)
  }

  function toggleHeader() {
    if (header === 'all') {
      setCappedNote(false)
      onSelectionChange(deselectShown(selected, selectable))
    } else {
      apply(selectShown(selected, selectable, max))
    }
  }
  const tableWidth = COLUMNS.reduce((s, c) => s + (widths[c.id] ?? c.width), 0)
  const filtersActive = search !== '' || assessment !== '' || minScoreInput !== ''
  const cellText = truncate ? 'truncate whitespace-nowrap' : 'whitespace-normal break-words'

  function resetWidths() {
    setWidths(DEFAULT_WIDTHS)
    store(`${storageKey}.widths`, null)
  }

  function toggleTruncate(value: boolean) {
    setTruncate(value)
    store(`${storageKey}.truncate`, String(value))
  }

  function resetFilters() {
    setSearch('')
    setAssessment('')
    setMinScoreInput('')
    setSort(DEFAULT_SORT)
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-memo-muted">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche: Ticker, Firma, Sektor"
          aria-label="Suche"
          className="w-56 rounded-md border border-memo-line px-2 py-1 text-memo-ink"
        />
        <select
          value={assessment}
          onChange={(e) => setAssessment(e.target.value as Assessment | '')}
          aria-label="Einschätzung"
          className="rounded-md border border-memo-line bg-white px-2 py-1 text-memo-ink"
        >
          <option value="">Alle Einschätzungen</option>
          {ASSESSMENTS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5">
          Score ab
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={minScoreInput}
            onChange={(e) => setMinScoreInput(e.target.value)}
            placeholder="–"
            className="w-16 rounded-md border border-memo-line px-2 py-1 text-memo-ink"
          />
        </label>
        <button
          onClick={resetFilters}
          disabled={!filtersActive && sort.key === DEFAULT_SORT.key && sort.dir === DEFAULT_SORT.dir}
          className="underline hover:text-memo-ink disabled:no-underline disabled:opacity-50"
        >
          Filter zurücksetzen
        </button>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={truncate} onChange={(e) => toggleTruncate(e.target.checked)} />
          Text abschneiden statt umbrechen
        </label>
        <button onClick={resetWidths} className="underline hover:text-memo-ink">
          Spaltenbreiten zurücksetzen
        </button>
        <span className="ml-auto whitespace-nowrap">
          {shown.length} von {rows.length} angezeigt
        </span>
      </div>

      <div className="mb-1 flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-xs text-memo-muted">
          {selected.size} ausgewählt{maxSelection ? ` (max. ${maxSelection})` : ''}
          {cappedNote && maxSelection && (
            <span className="ml-2 text-memo-minusText">Höchstens {maxSelection} pro Batch-Lauf, Rest nicht ausgewählt.</span>
          )}
        </span>
        <button
          onClick={() => apply(selectShown(selected, selectable, max))}
          disabled={selectionDisabled || selectable.length === 0 || header === 'all'}
          className="rounded-md border border-memo-line px-3 py-1 text-xs font-medium text-memo-muted transition-colors hover:border-memo-ink hover:text-memo-ink disabled:opacity-50"
        >
          Alle angezeigten auswählen
        </button>
        <button
          onClick={() => {
            setCappedNote(false)
            onSelectionChange(new Set())
          }}
          disabled={selectionDisabled || selected.size === 0}
          className="rounded-md border border-memo-line px-3 py-1 text-xs font-medium text-memo-muted transition-colors hover:border-memo-ink hover:text-memo-ink disabled:opacity-50"
        >
          Auswahl aufheben
        </button>
        {actions}
      </div>

      <div className="max-h-[28rem] overflow-auto rounded-lg border border-memo-line">
        <table className="table-fixed border-collapse text-sm" style={{ width: tableWidth, minWidth: '100%' }}>
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.id} style={{ width: widths[c.id] ?? c.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const active = c.sortKey && sort.key === c.sortKey
                return (
                  <th
                    key={c.id}
                    scope="col"
                    title={c.title}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`relative sticky top-0 z-10 select-none border-b border-memo-line bg-white px-2 py-1.5 text-xs font-semibold text-memo-muted ${
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {c.id === 'select' ? (
                      <input
                        type="checkbox"
                        checked={header === 'all'}
                        ref={(el) => {
                          if (el) el.indeterminate = header === 'some'
                        }}
                        disabled={selectionDisabled || selectable.length === 0}
                        onChange={toggleHeader}
                        aria-label="Alle angezeigten aus- oder abwählen"
                        className="h-4 w-4 accent-navy-700"
                      />
                    ) : c.sortKey ? (
                      <button
                        onClick={() => setSort((s) => nextSort(s, c.sortKey!))}
                        className={`truncate hover:text-memo-ink ${active ? 'text-memo-ink' : ''}`}
                      >
                        {c.label}
                        {active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                      </button>
                    ) : (
                      c.label
                    )}
                    {c.id !== 'select' && (
                      <span
                        role="separator"
                        aria-label={`Breite ${c.label || c.id} ändern`}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          drag.current = { id: c.id, startX: e.clientX, startWidth: widths[c.id] ?? c.width }
                        }}
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-memo-line"
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-memo-line2">
            {shown.map((r) => {
              const locked = isRowLocked?.(r.ticker) ?? false
              return (
                <TableRow
                  key={r.ticker}
                  r={r}
                  checked={!locked && selected.has(r.ticker)}
                  locked={locked}
                  tag={rowTag?.(r.ticker) ?? null}
                  highlighted={highlightedTicker === r.ticker}
                  disabled={!!selectionDisabled}
                  downloading={downloadingTicker === r.ticker}
                  showPdf={!!onDownloadPdf}
                  cellText={cellText}
                  onToggle={handleToggle}
                  onOpen={handleOpen}
                  onPdf={handlePdf}
                />
              )
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className="p-3 text-sm text-memo-muted">Keine Analyse passt zu den Filtern.</p>}
      </div>
    </div>
  )
}

// Eine Tabellenzeile. memo: zeichnet nur neu, wenn sich ihre eigenen Werte
// aendern (Haken, Hervorhebung, Download), nicht bei jedem Klick anderswo.
const TableRow = memo(function TableRow({
  r,
  checked,
  locked,
  tag,
  highlighted,
  disabled,
  downloading,
  showPdf,
  cellText,
  onToggle,
  onOpen,
  onPdf,
}: {
  r: AnalysisTableRow
  checked: boolean
  locked: boolean
  tag: string | null
  highlighted: boolean
  disabled: boolean
  downloading: boolean
  showPdf: boolean
  cellText: string
  onToggle: (ticker: string) => void
  onOpen: (ticker: string) => void
  onPdf: (ticker: string) => void
}) {
  const marketCap = formatMarketCap(r.market_cap, r.currency)
  const assessment = assessmentText(r)
  return (
    <tr className={`hover:bg-memo-paper ${highlighted ? 'bg-memo-paper' : ''}`}>
      <td className="px-2 py-1.5 text-center">
        {highlighted ? (
          <span
            aria-label="Analyse läuft"
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-memo-line border-t-memo-ink"
          />
        ) : (
          <input
            type="checkbox"
            checked={checked}
            disabled={locked || disabled}
            onChange={() => onToggle(r.ticker)}
            aria-label={locked ? `${r.ticker} (gesperrt)` : `${r.ticker} auswählen`}
            title={locked ? (tag ?? 'gesperrt') : undefined}
            className="h-4 w-4 accent-navy-700"
          />
        )}
      </td>
      <td className="px-2 py-1.5">
        <button onClick={() => onOpen(r.ticker)} className="flex max-w-full items-center gap-2 hover:underline">
          {r.logo_url ? (
            <img
              src={r.logo_url}
              alt=""
              className="h-5 w-5 flex-shrink-0 rounded-sm border border-memo-line2 bg-white object-contain"
            />
          ) : (
            <span className="h-5 w-5 flex-shrink-0" />
          )}
          <span className="truncate font-analyst text-memo-ink">{r.ticker}</span>
        </button>
      </td>
      <td className="px-2 py-1.5">
        <button onClick={() => onOpen(r.ticker)} className={`block max-w-full text-left hover:underline ${cellText}`}>
          {r.name ?? r.ticker}
        </button>
        {tag && <span className="text-[11px] text-memo-muted">{tag}</span>}
      </td>
      <td className={`px-2 py-1.5 text-xs text-memo-muted ${cellText}`} title={[r.sector, r.industry].filter(Boolean).join(' · ')}>
        {r.sector ?? '–'}
        {r.industry && <span className="text-memo-muted"> · {r.industry}</span>}
      </td>
      <td className={`px-2 py-1.5 text-right text-xs ${cellText}`}>{marketCap ?? '–'}</td>
      <td className={`px-2 py-1.5 text-right text-xs ${cellText}`}>{formatPrice(r.price, r.currency)}</td>
      <td className="px-2 py-1.5 text-xs text-memo-muted">
        {formatDate(r.analysed_at)}
        {r.last_run_status === 'error' && r.status === 'done' && (
          <span title="Letzte Aktualisierung fehlgeschlagen, angezeigt wird die ältere Analyse" className="ml-1 text-ampel-yellow">
            !
          </span>
        )}
      </td>
      <td className="px-2 py-1.5 text-center">
        <ScoreBadge score={r.score_total} title="Gesamtscore" />
      </td>
      <td
        className={`px-2 py-1.5 text-xs font-semibold ${scoreLabelColorClass(r.score_total)} ${cellText}`}
        title={assessment.title}
      >
        {assessment.text}
      </td>
      <td className="px-2 py-1.5 text-center">
        <ScoreBadge score={r.score_fundamental} title="Fundamental" />
      </td>
      <td className="px-2 py-1.5 text-center">
        <ScoreBadge score={r.score_qualitaet} title="Qualität" />
      </td>
      <td className="px-2 py-1.5 text-center">
        <ScoreBadge score={r.score_krise} title="Krisenstabilität" />
      </td>
      <td className="px-2 py-1.5 text-center">
        <ScoreBadge score={r.score_trend} title="Trend" />
      </td>
      <td className="px-2 py-1.5">
        <span className="flex flex-wrap gap-1">
          {hasKo(r) && (
            <span
              title={`K.O.-Kriterium rot${r.ko_count ? ` (${r.ko_count})` : ''}${r.no_go_hart ? ', harter Ausschluss' : ''}`}
              className="rounded-sm border border-memo-minus px-1 text-[10px] font-semibold text-memo-minusText"
            >
              K.O.
            </span>
          )}
          {newsBlocked(r) && (
            <span
              title="News gesperrt: K.O.-Kriterien ohne aktuelle News bewertet"
              className="rounded-sm border border-memo-line px-1 text-[10px] font-semibold text-memo-muted line-through"
            >
              News
            </span>
          )}
        </span>
      </td>
      <td className="px-2 py-1.5">
        <span className="flex items-center gap-2">
          <button onClick={() => onOpen(r.ticker)} className="text-xs font-medium text-memo-ink underline hover:opacity-70">
            Öffnen
          </button>
          {showPdf && r.score_total != null && (
            <button
              onClick={() => onPdf(r.ticker)}
              disabled={downloading}
              title={`PDF für ${r.ticker} herunterladen`}
              aria-label={`PDF für ${r.ticker} herunterladen`}
              className="flex h-6 w-6 items-center justify-center rounded-md text-memo-muted hover:bg-memo-line2 hover:text-memo-ink disabled:opacity-50"
            >
              {downloading ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-memo-line border-t-memo-ink" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                >
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
              )}
            </button>
          )}
        </span>
      </td>
    </tr>
  )
})
