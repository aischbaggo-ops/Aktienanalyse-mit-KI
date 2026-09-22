export interface TickerItem {
  ticker: string
  name?: string
}

// Checkbox-Liste zur Vorauswahl vor einem Batch-Lauf. Wird von der
// Freitext-Eingabe genutzt und ist so gehalten, dass die Index-Auswahl
// dieselbe Liste verwenden kann.
export function TickerSelectionList({
  items,
  selected,
  onChange,
  maxSelectable,
  disabled,
}: {
  items: TickerItem[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  maxSelectable?: number
  disabled?: boolean
}) {
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.ticker))
  const overLimit = maxSelectable != null && selected.size > maxSelectable

  function toggle(ticker: string) {
    const next = new Set(selected)
    if (next.has(ticker)) next.delete(ticker)
    else next.add(ticker)
    onChange(next)
  }

  function toggleAll() {
    onChange(allSelected ? new Set() : new Set(items.map((i) => i.ticker)))
  }

  return (
    <div className="rounded-lg border border-memo-line">
      <div className="flex items-center justify-between gap-3 border-b border-memo-line2 px-3 py-2 text-xs text-memo-muted">
        <span className={overLimit ? 'font-semibold text-ampel-red' : ''}>
          {selected.size} von {items.length} ausgewählt
          {maxSelectable != null && ` (max. ${maxSelectable})`}
        </span>
        <button
          type="button"
          onClick={toggleAll}
          disabled={disabled}
          className="text-memo-ink underline hover:text-memo-muted disabled:opacity-50"
        >
          {allSelected ? 'Alle abwählen' : 'Alle auswählen'}
        </button>
      </div>
      <ul className="grid max-h-64 grid-cols-1 gap-x-4 overflow-y-auto p-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.ticker}>
            <label className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-sm hover:bg-memo-paper">
              <input
                type="checkbox"
                checked={selected.has(item.ticker)}
                onChange={() => toggle(item.ticker)}
                disabled={disabled}
                className="h-4 w-4 accent-navy-700"
              />
              <span className="font-analyst text-memo-ink">{item.ticker}</span>
              {item.name && <span className="truncate text-xs text-memo-muted">{item.name}</span>}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
