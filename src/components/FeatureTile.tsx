import { Link } from 'react-router-dom'

interface Props {
  title: string
  description: string
  to: string
  loading: boolean
  unlocked: boolean
}

// Kachel fuer einen freischaltbaren Baustein. Gesperrt: bleibt sichtbar, hat
// aber keinen Link (kein <a>, nur ein <div>) - die eigentliche Zugriffs-
// pruefung passiert zusaetzlich in der Zielseite selbst.
export function FeatureTile({ title, description, to, loading, unlocked }: Props) {
  const boxClass = 'block rounded-lg border bg-white p-4 shadow-card'

  if (loading) {
    return (
      <div className={`${boxClass} border-memo-line`}>
        <p className="font-analyst text-base text-memo-ink">{title}</p>
        <p className="mt-1 text-xs text-memo-muted">Lade...</p>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className={`${boxClass} border-memo-line opacity-70`} aria-disabled="true">
        <p className="font-analyst text-base text-memo-ink">
          <span aria-hidden="true">🔒 </span>
          {title}
        </p>
        <p className="mt-1 text-xs text-memo-muted">Baustein noch nicht freigeschaltet.</p>
      </div>
    )
  }

  return (
    <Link to={to} className={`${boxClass} border-memo-plus transition-colors hover:border-memo-ink`}>
      <p className="font-analyst text-base text-memo-ink">{title}</p>
      <p className="mt-1 text-xs text-memo-muted">{description}</p>
    </Link>
  )
}
