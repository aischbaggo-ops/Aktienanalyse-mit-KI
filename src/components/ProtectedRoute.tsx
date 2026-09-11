import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-navy-50 text-navy-600">
        Lade...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export function AdminRoute() {
  const { isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-navy-50 text-navy-600">
        Lade...
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
