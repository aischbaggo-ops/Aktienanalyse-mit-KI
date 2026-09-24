import { useEffect, useRef, useState } from 'react'
import { GLOSSARY, type GlossaryTerm } from '../lib/glossary'

/**
 * Kleines (i)-Icon neben Fachbegriffen/Abkuerzungen, oeffnet bei Hover
 * (Desktop) oder Tap (Mobile) eine kurze Erklaerung aus dem zentralen
 * Glossar (src/lib/glossary.ts). Schliesst bei Klick ausserhalb oder Escape.
 */
export function InfoTooltip({ term }: { term: GlossaryTerm }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const entry = GLOSSARY[term]
  // Nur auf echten Hover-Geraeten (Desktop-Maus) per mouseenter oeffnen -
  // auf Touch-Geraeten emulieren manche Browser bei einem Tap zusaetzlich
  // ein mouseenter VOR dem click, was den Klick-Toggle sonst sofort wieder
  // schliessen wuerde (oeffnen+schliessen im selben Tap). Auf Touch bleibt
  // dadurch ausschliesslich der Klick-Toggle unten aktiv.
  const supportsHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!entry) return null

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex normal-case tracking-normal"
      onMouseEnter={supportsHover ? () => setOpen(true) : undefined}
      onMouseLeave={supportsHover ? () => setOpen(false) : undefined}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-label={`Erklärung: ${entry.label}`}
        aria-expanded={open}
        className="ml-1 inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border border-memo-muted text-[9px] font-semibold leading-none text-memo-muted hover:border-memo-ink hover:text-memo-ink"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1.5 w-48 rounded-sm border border-memo-line bg-white p-2.5 text-left text-xs font-normal leading-relaxed text-memo-ink shadow-lg sm:w-56"
        >
          <strong className="font-semibold">{entry.label}</strong>
          <span className="mt-0.5 block text-memo-muted">{entry.erklaerung}</span>
        </span>
      )}
    </span>
  )
}
