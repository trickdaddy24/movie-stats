import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { auth } = useAuth()

  if (!auth.token) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
