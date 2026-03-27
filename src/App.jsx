import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useSocket } from './context/SocketContext'
import Navbar from './components/Navbar'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import QueuePage from './pages/QueuePage'
import BookingPage from './pages/BookingPage'
import BusinessDashboard from './pages/BusinessDashboard'
import AuthCallback from './pages/AuthCallback'

const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen page-wrapper">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-2 border-[var(--cyan)] border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-[var(--text-secondary)] text-sm font-medium tracking-wide">Loading...</p>
    </div>
  </div>
)

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-center glass p-10 max-w-md">
          <p className="text-5xl mb-4">🚫</p>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Access Denied
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            You are not allowed to perform this action.
            {user.role === 'user'
              ? ' This page is for business owners only.'
              : ' This page is for customers only.'}
          </p>
          <a href="/" className="btn-primary inline-block">← Back to Dashboard</a>
        </div>
      </div>
    )
  }
  return children
}

export default function App() {
  const { socket } = useSocket()
  
  useEffect(() => {
    if (!socket) return
    const handleNear = (data) => {
      // Use browser notification or alert for now
      if (Notification.permission === 'granted') {
        new Notification("SmartQueue", { body: data.message })
      } else {
        alert("🔔 " + data.message)
      }
    }
    socket.on('notification:near', handleNear)
    return () => socket.off('notification:near', handleNear)
  }, [socket])

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission()
    }
  }, [])

  return (
    <div className="page-wrapper">
      <Navbar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/queue/:businessId"
          element={
            <ProtectedRoute allowedRoles={['user']}>
              <QueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking/:businessId"
          element={
            <ProtectedRoute allowedRoles={['user']}>
              <BookingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/business/:businessId/manage"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <BusinessDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
