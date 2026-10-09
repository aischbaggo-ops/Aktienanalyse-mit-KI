import { DEFAULT_RECENT_SORT, parseMinScore, RECENT_SORTS, type RecentSort } from '../lib/recentList'

// Sortierung, Filter "Score ab", Zuruecksetzen und Zaehler - gemeinsam fuer
// "Letzte Analysen" und die Watchlist-Liste.
export function ListControls({
  sort,
  onSortChange,
  minScoreInput,
  onMinScoreInputChange,
  shown,
  total,
  dateSortLabel,
}: {
  sort: RecentSort
  onSortChange: (sort: RecentSort) => void
  minScoreInput: string
  onMinScoreInputChange: (value: string) => void
  shown: number
  total: number
  // Beschriftung der Datums-Sortierung, z.B. "Analysedatum (neueste zuerst)".
  dateSortLabel?: string
}) {
  const isDefault = sort === DEFAULT_RECENT_SORT && minScoreInput === ''
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-memo-muted">
      <label className="flex items-center gap-1.5">
        Sortierung
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as RecentSort)}
          className="rounded-md border border-memo-line bg-white px-2 py-1 text-memo-ink"
        >
          {RECENT_SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value === 'newest' && dateSortLabel ? dateSortLabel : o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        Score ab
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={minScoreInput}
          onChange={(e) => onMinScoreInputChange(e.target.value)}
          placeholder="–"
          className="w-16 rounded-md border border-memo-line px-2 py-1 text-memo-ink"
        />
      </label>
      <button
        onClick={() => {
          onSortChange(DEFAULT_RECENT_SORT)
          onMinScoreInputChange('')
        }}
        disabled={isDefault}
        className="text-memo-muted underline hover:text-memo-ink disabled:no-underline disabled:opacity-50"
      >
        Zurücksetzen
      </button>
      <span className="ml-auto">
        {shown} von {total} angezeigt
      </span>
    </div>
  )
}

export function emptyFilterText(minScoreInput: string): string {
  return `Keine Analyse mit Score ab ${parseMinScore(minScoreInput)}.`
}
