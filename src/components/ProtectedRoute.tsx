import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ChooseUsername } from './ChooseUsername'

export function ProtectedRoute() {
  const { session, loading, adminLoading, username } = useAuth()

  if (loading || (session && adminLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-memo-paper text-memo-muted">
        Lade...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Bestandskonten ohne Nutzername muessen erst einen waehlen.
  if (username === null) {
    return <ChooseUsername />
  }

  return <Outlet />
}

export function AdminRoute() {
  const { isAdmin, loading, adminLoading } = useAuth()

  if (loading || adminLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-memo-paper text-memo-muted">
        Lade...
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
