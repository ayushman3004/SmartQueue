import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import { useAuth } from './context/AuthContext'
import { useSocket } from './context/SocketContext'
import Navbar from './components/Navbar'
import BackButton from './components/BackButton'
import AIDesistant from './components/AIDesistant'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import QueuePage from './pages/QueuePage'
import BookingPage from './pages/BookingPage'
import BusinessDashboard from './pages/BusinessDashboard'
import AuthCallback from './pages/AuthCallback'
import WalletPage from './pages/WalletPage'
import AdminDashboard from './pages/AdminDashboard'
import ProfilePage from './pages/ProfilePage'

const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen page-wrapper">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-neutral-500 text-sm font-medium tracking-wide">Initializing Environment...</p>
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
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-sm mb-6 text-neutral-400">
            You are not allowed to perform this action.
            {user.role === 'customer' ? ' This page is for business owners only.' : ' This page is for customers only.'}
          </p>
          <a href="/" className="btn-primary">← Back to Dashboard</a>
        </div>
      </div>
    )
  }
  return children
}

export default function App() {
  const { user } = useAuth()
  const { socket } = useSocket()
  
  useEffect(() => {
    if (!socket) return
    const handleNear = (data) => {
      toast(data.message, {
        icon: '🔔',
        style: {
          borderRadius: '16px', background: '#111', color: '#fff', border: '1px solid #7B61FF', padding: '16px', fontSize: '14px', fontWeight: 'bold'
        },
        duration: 5000,
      })
      if (Notification.permission === 'granted') {
        new Notification("SmartQueue", { body: data.message })
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
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'glass-bright',
          style: {
            background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px'
          },
        }}
      />
      <Navbar />
      <BackButton />
      <AIDesistant />
      <main className="main-content">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/"
            element={user ? (
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            ) : <LandingPage />}
          />
          <Route
            path="/queue/:businessId"
            element={
              <ProtectedRoute allowedRoles={['customer', 'admin']}>
                <QueuePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/booking/:businessId"
            element={
              <ProtectedRoute allowedRoles={['customer', 'admin']}>
                <BookingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/business/:businessId/manage"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <BusinessDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wallet"
            element={
              <ProtectedRoute>
                <WalletPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
