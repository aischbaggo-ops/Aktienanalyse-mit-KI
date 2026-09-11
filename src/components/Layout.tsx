import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Layout() {
  const { user, isAdmin, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-navy-50 text-navy-950">
      <header className="border-b border-navy-800 bg-navy-700">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 flex-shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-gold-500 px-3.5 text-xs font-bold text-black">
              AI Schbaggo
            </span>
            <span className="text-base font-semibold tracking-tight text-white">
              Aktienanalyse mit KI
            </span>
          </div>

          <nav className="flex items-center gap-1 text-sm">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 font-medium transition-colors ${
                  isActive
                    ? 'bg-navy-600 text-gold-400'
                    : 'text-slate-300 hover:bg-navy-600 hover:text-white'
                }`
              }
            >
              Dashboard
            </NavLink>
            {isAdmin && (
              <NavLink
                to="/admin/aktivitaet"
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 font-medium transition-colors ${
                    isActive
                      ? 'bg-navy-600 text-gold-400'
                      : 'text-slate-300 hover:bg-navy-600 hover:text-white'
                  }`
                }
              >
                Admin
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-300 sm:inline">{user?.email}</span>
            <button
              onClick={() => signOut()}
              className="rounded-md border border-navy-500 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-gold-500 hover:text-gold-400"
            >
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
