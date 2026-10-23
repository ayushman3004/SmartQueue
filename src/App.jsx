import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import { useAuth } from './context/AuthContext'
import { useSocket } from './context/SocketContext'
import { getAllBusinesses } from './api/business.api'
import Navbar from './components/Navbar'
import BackButton from './components/BackButton'
import AIDesistant from './components/AIDesistant'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import LandingPageBackup from './pages/LandingPageBackup'
import ComingSoonPage from './pages/ComingSoonPage'
import CustomerDashboardPage from './pages/CustomerDashboardPage'
import HistoryPage from './pages/HistoryPage'
import QueuePage from './pages/QueuePage'
import BookingPage from './pages/BookingPage'
import BusinessDashboard from './pages/BusinessDashboard'
import AuthCallback from './pages/AuthCallback'
import AdminDashboard from './pages/AdminDashboard'
import ProfilePage from './pages/ProfilePage'
import BusinessPortalPage from './pages/BusinessPortalPage'
import BusinessOnboardingPage from './pages/BusinessOnboardingPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TermsPage from './pages/TermsPage'
import HelpSupportPage from './pages/HelpSupportPage'
import SubscriptionPage from './pages/SubscriptionPage'
import Footer from './components/Footer'
import AmbientBackground from './components/AmbientBackground'
import NotFoundPage from './pages/NotFoundPage'

const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen page-wrapper">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-neutral-500 text-sm font-medium tracking-wide">Initializing Environment...</p>
    </div>
  </div>
)

const QueueRedirect = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    getAllBusinesses({ includeAll: false })
      .then((res) => {
        const bizList = res.data?.data?.businesses || []
        if (bizList.length > 0) {
          const myIdStr = user?._id?.toString()
          const activeBiz = bizList.find((b) =>
            (b.activeQueue || []).some((u) => (u.userId?._id || u.userId)?.toString() === myIdStr)
          )
          navigate(`/queue/${(activeBiz || bizList[0])._id}`, { replace: true })
        } else {
          navigate('/customers', { replace: true })
        }
      })
      .catch(() => navigate('/customers', { replace: true }))
  }, [user, navigate])
  return <LoadingScreen />
}

const BookingRedirect = () => {
  const navigate = useNavigate()
  useEffect(() => {
    getAllBusinesses({ includeAll: false })
      .then((res) => {
        const bizList = res.data?.data?.businesses || []
        if (bizList.length > 0) {
          navigate(`/booking/${bizList[0]._id}`, { replace: true })
        } else {
          navigate('/customers', { replace: true })
        }
      })
      .catch(() => navigate('/customers', { replace: true }))
  }, [navigate])
  return <LoadingScreen />
}

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-center glass p-10 max-w-md">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
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
  const { user, loading: authLoading } = useAuth()
  const { socket, joinUser } = useSocket()
  const location = useLocation()
  const isOnboarding = location.pathname.startsWith('/business/onboarding')

  // Join user's private socket room for wallet:update and notifications
  useEffect(() => {
    if (user?._id) {
      joinUser(user._id)
    }
  }, [user?._id, joinUser])
  
  useEffect(() => {
    if (!socket) return
    const handleNear = (data) => {
      toast(data.message, {
        style: {
          borderRadius: '16px', background: '#111', color: '#fff', border: '1px solid #7B61FF', padding: '16px', fontSize: '14px', fontWeight: 'bold'
        },
        duration: 5000,
      })
      if (Notification.permission === 'granted') {
        new Notification("serveQ", { body: data.message })
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

  const isCustomerDashboard =
    location.pathname === '/customers' ||
    location.pathname === '/history' ||
    location.pathname.startsWith('/queue') ||
    location.pathname.startsWith('/booking') ||
    location.pathname === '/business' ||
    location.pathname === '/admin' ||
    location.pathname === '/support' ||
    location.pathname === '/help' ||
    location.pathname === '/profile' ||
    location.pathname === '/subscription' ||
    location.pathname.startsWith('/business')

  const isLoginPage =
    location.pathname === '/login' ||
    location.pathname === '/auth/callback'

  const isComingSoonPage =
    location.pathname === '/coming-soon' ||
    (!user && location.pathname === '/')

  if (authLoading) {
    return <LoadingScreen />
  }

  const bgVariant = isComingSoonPage
    ? null
    : isLoginPage
    ? 'auth'
    : isCustomerDashboard
    ? 'glow'
    : 'default'

  const bgClass = isComingSoonPage
    ? ''
    : isLoginPage
    ? 'auth-background'
    : isCustomerDashboard
    ? 'app-background-glow'
    : 'app-background'

  return (
    <div className={`page-wrapper ${bgClass}`}>
      {!isComingSoonPage && <AmbientBackground variant={bgVariant} />}
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#09090b',
            border: '1px solid #f4f4f5',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600'
          },
        }}
      />
      {user && !isOnboarding && !isCustomerDashboard && <Navbar />}
      {user && !isOnboarding && !isCustomerDashboard && (
        <>
          <BackButton />
        </>
      )}
      {user && !isOnboarding && !isComingSoonPage && <AIDesistant />}
      <main className={user && !isOnboarding && !isCustomerDashboard ? "main-content flex-1 flex flex-col min-h-[calc(100vh-140px)]" : "flex-1 flex flex-col min-h-[calc(100vh-140px)]"}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/"
            element={
              !user ? (
                <LandingPage />
              ) : user.role === 'owner' ? (
                <Navigate to="/business" replace />
              ) : (
                <Navigate to="/customers" replace />
              )
            }
          />
          <Route path="/coming-soon" element={<ComingSoonPage />} />
          <Route path="/home" element={<LandingPageBackup />} />
          <Route path="/preview-landing" element={<LandingPageBackup />} />
          <Route
            path="/customers"
            element={
              <ProtectedRoute allowedRoles={['customer', 'admin']}>
                <CustomerDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/customer" element={<Navigate to="/customers" replace />} />
          <Route
            path="/history"
            element={
              <ProtectedRoute allowedRoles={['customer', 'admin']}>
                <HistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/queue"
            element={
              <ProtectedRoute allowedRoles={['customer', 'admin']}>
                <QueuePage />
              </ProtectedRoute>
            }
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
            path="/booking"
            element={
              <ProtectedRoute allowedRoles={['customer', 'admin']}>
                <BookingPage />
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
            path="/business"
            element={<BusinessPortalPage />}
          />
          <Route
            path="/business/onboarding"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <BusinessOnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/business/onboarding/:businessId"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <BusinessOnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/business/:businessId"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <BusinessDashboard />
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
            path="/subscription"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <SubscriptionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wallet"
            element={<Navigate to="/profile" replace />}
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
            element={<AdminDashboard />}
          />
          <Route path="/support" element={<HelpSupportPage />} />
          <Route path="/help" element={<Navigate to="/support" replace />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {!isLoginPage && !isComingSoonPage && <Footer />}
    </div>
  )
}
