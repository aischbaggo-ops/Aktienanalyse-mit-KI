import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { AdminLayout } from './components/AdminLayout'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { SetPasswordPage } from './pages/SetPasswordPage'
import { DashboardPage } from './pages/DashboardPage'
import { AnalysePage } from './pages/AnalysePage'
import { AdminPage } from './pages/AdminPage'
import { AdminChatPage } from './pages/AdminChatPage'
import { KontoPage } from './pages/KontoPage'
import OptionenPage from './features/optionen/OptionenPage'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/passwort-setzen" element={<SetPasswordPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/analyse/:ticker" element={<AnalysePage />} />
              <Route path="/konto" element={<KontoPage />} />
              <Route path="/optionen" element={<OptionenPage />} />
            </Route>
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin/aktivitaet" element={<AdminPage />} />
                <Route path="/admin/chat" element={<AdminChatPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
