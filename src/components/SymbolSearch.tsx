import { useEffect, useRef, useState } from 'react'
import { useDebounce } from '../hooks/useDebounce'
import { searchSymbols, SymbolSearchResult } from '../lib/webhooks'

interface SymbolSearchProps {
  onSelect: (result: SymbolSearchResult) => void
}

export function SymbolSearch({ onSelect }: SymbolSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SymbolSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debouncedQuery = useDebounce(query, 300)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 1) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    searchSymbols(debouncedQuery)
      .then(({ results, rateLimited }) => {
        if (cancelled) return
        if (results.length === 0 && rateLimited) {
          setError('Suche vorübergehend nicht verfügbar — bitte in Kürze erneut versuchen.')
          setOpen(true)
          return
        }
        setResults(results)
        setOpen(true)
      })
      .catch(() => {
        if (!cancelled) setError('Symbol-Suche fehlgeschlagen.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Ticker oder Firmenname suchen..."
        className="w-full rounded-lg border border-navy-200 bg-navy-50 px-4 py-2.5 text-sm text-navy-950 placeholder-memo-muted outline-none transition-colors focus:border-gold-500"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-memo-muted">
          Suche...
        </span>
      )}

      {open && (error || results.length > 0) && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-navy-200 bg-white shadow-xl">
          {error && <div className="px-4 py-2.5 text-sm text-ampel-red">{error}</div>}
          {!error &&
            results.map((r) => (
              <button
                key={r.symbol}
                onClick={() => {
                  onSelect(r)
                  setQuery(`${r.symbol} - ${r.name}`)
                  setOpen(false)
                }}
                className="block w-full px-4 py-2.5 text-left text-sm text-navy-800 transition-colors hover:bg-navy-50"
              >
                <span className="font-semibold text-gold-500">{r.symbol}</span>
                <span className="text-navy-700"> - {r.name}</span>
                {r.currency && <span className="text-memo-muted"> ({r.currency})</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
