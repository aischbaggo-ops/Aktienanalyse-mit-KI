import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Layout() {
  const { user, isAdmin, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-memo-paper text-navy-950">
      <header className="border-b border-memo-line bg-memo-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-analyst text-lg text-memo-ink">Aktienanalyse mit KI</span>

          <nav className="flex items-center gap-6 text-sm">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive ? 'border-b-2 border-memo-ink pb-1 text-memo-ink' : 'text-memo-muted hover:text-memo-ink'
              }
            >
              Dashboard
            </NavLink>
            {isAdmin && (
              <NavLink
                to="/admin/aktivitaet"
                className={({ isActive }) =>
                  isActive ? 'border-b-2 border-memo-ink pb-1 text-memo-ink' : 'text-memo-muted hover:text-memo-ink'
                }
              >
                Admin
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-memo-muted sm:inline">{user?.email}</span>
            <NavLink
              to="/konto"
              className={({ isActive }) =>
                isActive ? 'text-xs text-memo-ink' : 'text-xs text-memo-muted hover:text-memo-ink'
              }
            >
              Konto
            </NavLink>
            <button onClick={() => signOut()} className="text-xs text-memo-muted hover:text-memo-ink">
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
