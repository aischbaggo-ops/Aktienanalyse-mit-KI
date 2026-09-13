import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function AdminLayout() {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-memo-paper text-memo-ink">
      <header className="flex items-center justify-between border-b border-memo-line px-6 py-5 sm:px-10">
        <h1 className="font-analyst text-xl text-memo-ink">Aktivität</h1>
        <nav className="flex items-center gap-6 text-sm">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive ? 'border-b-2 border-memo-ink pb-1 text-memo-ink' : 'text-memo-muted hover:text-memo-ink'
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/aktivitaet"
            className={({ isActive }) =>
              isActive ? 'border-b-2 border-memo-ink pb-1 text-memo-ink' : 'text-memo-muted hover:text-memo-ink'
            }
          >
            Admin
          </NavLink>
          <button onClick={() => signOut()} className="text-xs text-memo-muted hover:text-memo-ink">
            Abmelden
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
        <Outlet />
      </main>
    </div>
  )
}
