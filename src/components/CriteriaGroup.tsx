import type { CriterionEntry } from '../types/database'
import { ampelColor } from '../lib/score'

interface CriteriaGroupProps {
  criteria: CriterionEntry[]
}

export function CriteriaGroup({ criteria }: CriteriaGroupProps) {
  const safeCriteria = Array.isArray(criteria) ? criteria : []
  const groups = safeCriteria.filter(Boolean).reduce<Record<string, CriterionEntry[]>>((acc, c) => {
    const key = c.dimension || 'Sonstiges'
    acc[key] = acc[key] ? [...acc[key], c] : [c]
    return acc
  }, {})

  const dimensionOrder = ['Fundamental', 'Qualitaet', 'Qualität', 'Trend']
  const orderedKeys = Object.keys(groups).sort((a, b) => {
    const ia = dimensionOrder.indexOf(a)
    const ib = dimensionOrder.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {orderedKeys.map((dimension) => (
        <div key={dimension} className="rounded-xl border border-navy-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gold-500">{dimension}</h3>
          <ul className="space-y-3">
            {groups[dimension].map((c, idx) => (
              <li key={`${c.name}-${idx}`} className="flex gap-2.5">
                <span
                  className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: ampelColor(c.ampel) }}
                />
                <div>
                  <p className="text-sm font-medium text-navy-900">{c.name}</p>
                  {c.begruendung && (
                    <p className="mt-0.5 text-xs leading-relaxed text-navy-500">
                      {c.begruendung}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
