import type { CriterionEntry, StockAnalysis } from '../../types/database'
import { MEMO_PLUS, MEMO_MINUS, MEMO_GRAU } from '../../lib/memoColors.js'

const KO_NAMES = ['Keine Skandale', 'Keine schweren Vorwuerfe gegen Unternehmen', 'Keine schweren Vorwuerfe gegen Management']

function ampelDotColor(ampel: string): string {
  switch (ampel) {
    case 'gruen':
      return MEMO_PLUS
    case 'gelb':
      return '#eab308'
    case 'rot':
      return MEMO_MINUS
    default:
      return MEMO_GRAU
  }
}

function haertegradKategorie(c: CriterionEntry): string {
  if (c.haertegrad && typeof c.haertegrad === 'string') return c.haertegrad as string
  if (c.optional) return 'Bonus'
  if (typeof c.name === 'string' && c.name.includes(' ODER ')) return 'Entweder-oder'
  return 'Normal'
}

function SwotBlock({ title, items }: { title: string; items: string[] | undefined }) {
  return (
    <div className="border border-memo-line p-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-memo-muted">{title}</h4>
      {items && items.length > 0 ? (
        <ul className="space-y-1 text-sm leading-relaxed text-memo-ink">
          {items.map((item, idx) => (
            <li key={idx}>· {item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-memo-grau">–</p>
      )}
    </div>
  )
}

export function QualitaetTab({ analysis }: { analysis: StockAnalysis }) {
  const qualitaetKriterien = (analysis.criteria ?? []).filter((c) => c.dimension === 'Qualitaet')
  const swot = analysis.chart_data?.swot
  const noGoHart = analysis.chart_data?.no_go_hart === true

  const koKriterien = qualitaetKriterien.filter((c) => KO_NAMES.includes(c.name))
  const koVerletzt = koKriterien.filter((c) => c.ampel === 'rot')

  const haertegradCounts = new Map<string, number>()
  for (const c of qualitaetKriterien) {
    const key = haertegradKategorie(c)
    haertegradCounts.set(key, (haertegradCounts.get(key) ?? 0) + 1)
  }
  const haertegradOrder = ['Streng', 'Normal', 'Soft', 'Entweder-oder', 'Bonus']
  const haertegradKeys = [...haertegradCounts.keys()].sort(
    (a, b) => haertegradOrder.indexOf(a) - haertegradOrder.indexOf(b),
  )

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-memo-muted">SWOT</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SwotBlock title="Stärken" items={swot?.staerken} />
          <SwotBlock title="Schwächen" items={swot?.schwaechen} />
          <SwotBlock title="Chancen" items={swot?.chancen} />
          <SwotBlock title="Risiken" items={swot?.risiken} />
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-memo-muted">Härtegrad</h3>
          <div className="flex flex-wrap gap-2">
            {haertegradKeys.map((key) => (
              <span
                key={key}
                className="rounded-full border border-memo-line px-3 py-1 text-xs text-memo-ink"
              >
                {key} <span className="text-memo-muted">· {haertegradCounts.get(key)}</span>
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-memo-muted">K.O.-Kriterien</h3>
          {koVerletzt.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {koVerletzt.map((c) => (
                <span
                  key={c.name}
                  className="rounded-full border px-3 py-1 text-xs font-medium"
                  style={{ borderColor: MEMO_MINUS, color: MEMO_MINUS }}
                >
                  K.O. verletzt: {c.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="rounded-full border border-memo-line px-3 py-1 text-xs text-memo-muted">
              Keine verletzt
            </span>
          )}
          {noGoHart && koVerletzt.length === 0 && (
            <p className="mt-1 text-xs text-memo-minusText">Hinweis: no_go_hart-Flag gesetzt, aber kein K.O.-Kriterium rot.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-memo-muted">Kriterien im Einzelnen</h3>
        <ul className="space-y-3">
          {qualitaetKriterien.map((c, idx) => (
            <li key={idx} className="flex gap-2.5 border-b border-memo-line2 pb-3 last:border-none">
              <span
                className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                style={{ backgroundColor: ampelDotColor(c.ampel) }}
              />
              <div>
                <p className="text-sm font-medium text-memo-ink">{c.name}</p>
                {c.begruendung && <p className="mt-0.5 text-xs leading-relaxed text-memo-muted">{c.begruendung}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
