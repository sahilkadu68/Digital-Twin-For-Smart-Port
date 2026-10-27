import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import LoginPage from '@/pages/Login'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/layouts/AppShell'
import DashboardPage from '@/pages/Dashboard'
import ContainerYardPage from '@/pages/ContainerYard'
import AnalyticsPage from '@/pages/Analytics'
import PortMapPage from '@/pages/PortMap'
import ReportsPage from '@/pages/Reports'

function ProtectedWorkspace() {
  const { user, ready } = useAuthStore()
  const location = useLocation()
  if (!ready) return <p role="status" className="p-6 text-sm">Checking session…</p>
  return user ? <AppShell /> : <Navigate to="/login" state={{ from: location.pathname }} replace />
}

export default function App() {
  const check = useAuthStore(s => s.check)
  useEffect(() => { void check() }, [check])
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedWorkspace />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="container-yard" element={<ContainerYardPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="port-map" element={<PortMapPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
