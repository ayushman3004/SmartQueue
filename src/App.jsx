import { useMobileViewport } from './hooks/useMobileViewport'
import DoctorPage, { DoctorLogin } from './pages/DoctorPage'
import OwnerCategoryBoundary from './components/OwnerCategoryBoundary'
import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, matchPath, useLocation } from 'react-router-dom'
import { PageNotificationStatus } from './modules/notification/NotificationStatus'
import { createNotificationFeedback, dismissFeedback, getFeedbackRevision, pageNotificationScope, queueNotificationScope } from './modules/notification/browser-feedback'
import { useAuth } from './context/AuthContext'
import { useSocket } from './context/SocketContext'
import Navbar from './components/Navbar'
import BackButton from './components/BackButton'
import AIDesistant from './components/AIDesistant'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import CustomerDashboardPage from './pages/CustomerDashboardPage'
import HistoryPage from './pages/HistoryPage'
import QueuePage from './pages/QueuePage'
import BookingPage from './pages/BookingPage'
import BusinessDashboard from './pages/BusinessDashboard'
import AuthCallback from './pages/AuthCallback'
import AdminDashboard from './pages/AdminDashboard'
import ProfilePage from './pages/ProfilePage'
import BusinessMarketingPage from './pages/BusinessMarketingPage'
import BusinessApplicationPage from './pages/BusinessApplicationPage'
import HubLoginPage, { HubHome, OwnerPasswordPage } from './pages/HubLoginPage'
import BusinessOnboardingPage from './pages/BusinessOnboardingPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TermsPage from './pages/TermsPage'
import AboutPage from './pages/AboutPage'
import HelpSupportPage from './pages/HelpSupportPage'
import SubscriptionPage from './pages/SubscriptionPage'
import Footer from './components/Footer'
import './styles/customer-workspace.css'
import './styles/business-workspace.css'
import AmbientBackground from './components/AmbientBackground'
import NotFoundPage from './pages/NotFoundPage'
import UnauthorizedPage from './pages/UnauthorizedPage'
import { AppLoadingSkeleton } from './components/Skeleton'
import PublicGuidePage from './pages/PublicGuidePage'
import { guidePages } from './seo/publicPages'

const LoadingScreen = () => <AppLoadingSkeleton />
const MIN_INITIAL_LOADING_MS = 5000

const AliasRedirect = ({ to }) => {
  const { search, hash } = useLocation()
  return <Navigate to={`${to}${search}${hash}`} replace />
}

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to={`${allowedRoles?.includes('doctor') ? '/doctor/login' : allowedRoles?.includes('owner') ? '/hub/login' : '/login'}?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/401" replace />
  }
  if (user.role === 'owner' && user.ownerAccess) {
    if (user.ownerAccess.status === 'INVITED') return <Navigate to="/hub/activate" replace />
    if (!['ACTIVE', 'PASSWORD_REQUIRED'].includes(user.ownerAccess.status)) return <Navigate to="/hub/login" replace />
    if (user.ownerAccess.mustChangePassword && now >= new Date(user.ownerAccess.passwordChangeDeadline).getTime() && location.pathname !== '/hub/change-password') return <Navigate to="/hub/change-password" replace />
  }
  if (user.role === 'owner' && (location.pathname === '/hub/dashboard' || location.pathname.startsWith('/business/'))) return <OwnerCategoryBoundary>{children}</OwnerCategoryBoundary>
  return children
}

export default function App() {
  useMobileViewport()
  const [initialLoading, setInitialLoading] = useState(true)
  const { user, loading: authLoading } = useAuth()
  const { socket, joinUser, connected } = useSocket()
  const location = useLocation()
  useEffect(() => {
    const timer = setTimeout(() => setInitialLoading(false), MIN_INITIAL_LOADING_MS)
    return () => clearTimeout(timer)
  }, [])
  // A new screen or dashboard tab starts at its content, rather than a stale footer offset.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname, location.search])
  useEffect(() => () => dismissFeedback(pageNotificationScope(location.pathname)), [location.pathname])
  const isHubPage = location.pathname.startsWith('/hub')
  const isOnboarding = location.pathname.startsWith('/business/onboarding')
  const isVenueDashboard = !isOnboarding && location.pathname !== '/business/apply' &&
    ['/business/:businessId', '/business/:businessId/manage'].some(path =>
      matchPath({ path, end: true }, location.pathname))
  const isCustomerWorkspace = Boolean(user && user.role !== 'owner' &&
    (/^\/(customers|history|queue|booking|profile|support|help)(\/|$)/).test(location.pathname))
  const isBusinessWorkspace = Boolean(user && ['owner', 'admin'].includes(user.role) && !isCustomerWorkspace &&
    (/^\/(hub|business|subscription|history|queue|booking|profile|support|help)(\/|$)/).test(location.pathname))
  const workspaceService = 'clinic'


  // Join user's private socket room for wallet:update and notifications
  useEffect(() => {
    if (user?._id && connected) {
      joinUser(user._id)
    }
  }, [user?._id, joinUser, connected])
  useEffect(() => {
    if (!socket || !user?._id) return
    const revision = getFeedbackRevision()
    const feedback = createNotificationFeedback(queueNotificationScope, revision)
    const showQueueActivity = notification => {
      if (revision !== getFeedbackRevision() || String(notification?.recipient) !== String(user._id)) return
      const approaching = notification.eventKey?.startsWith('queue:near:')
      if (!approaching && !notification.eventKey?.startsWith('turn:serving:')) return

      const href = /^\/queue\/[a-f\d]{24}$/i.test(notification.href) ? notification.href : ''
      feedback.info(notification.message, { href })
      if (approaching && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('ServeQ', { body: notification.message })
      }
    }
    socket.on('notification:created', showQueueActivity)
    return () => socket.off('notification:created', showQueueActivity)
  }, [socket, user?._id])



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



  const isKnownRoute = [
    '/', '/login', '/auth/callback', '/customers', '/customer', '/history',
    '/queue', '/queue/:businessId', '/booking', '/booking/:businessId',
    '/hub/login', '/hub/activate', '/hub/dashboard', '/hub/change-password', '/business/apply', '/admin/login', '/admin/dashboard', '/admin/applications',
    '/business', '/business/onboarding', '/business/onboarding/:businessId',
    '/business/:businessId', '/business/:businessId/manage', '/subscription',
    '/doctor/login', '/doctor/dashboard', '/wallet', '/profile', '/admin', '/support', '/help', '/privacy', '/terms', '/about',
    '/unauthorized', '/401', '/403', '/coming-soon', ...guidePages.map(page => page.path),
  ].some(pattern => matchPath({ path: pattern, end: true }, location.pathname))

  const isNotFoundPage = !isKnownRoute || location.pathname === '/404'
  const isUnauthorizedPage =
    location.pathname === '/unauthorized' ||
    location.pathname === '/401' ||
    location.pathname === '/403'
  const isAdminSignIn = location.pathname.startsWith('/admin') && user?.role !== 'admin'
  const isStandalonePage = isNotFoundPage || isUnauthorizedPage || isAdminSignIn || location.pathname.startsWith('/doctor/')
  const showFooter = !isLoginPage && !isStandalonePage && (
    location.pathname === '/customers' || location.pathname === '/hub/dashboard' ||
    isVenueDashboard || (!isHubPage && !isCustomerWorkspace)
  )
  const hasPublicPageHeader = ['/privacy', '/terms', '/about'].includes(location.pathname)
  const hasWorkspaceNotificationStatus = user && (isOnboarding || isVenueDashboard ||
    ['/customers', '/history', '/profile', '/hub/dashboard', '/admin', '/admin/login', '/admin/dashboard', '/admin/applications',
      '/queue', '/queue/:businessId', '/booking', '/booking/:businessId']
      .some(path => matchPath({ path, end: true }, location.pathname)))

  if (initialLoading || authLoading) {
    return <LoadingScreen />
  }

  const bgVariant = isLoginPage
    ? 'auth'
    : isCustomerDashboard
    ? 'glow'
    : 'default'

  const bgClass = isStandalonePage
    ? ''
    : isLoginPage
    ? 'auth-background'
    : isCustomerDashboard
    ? 'app-background-glow'
    : 'app-background'

  return (
    <div data-service={isCustomerWorkspace ? workspaceService : undefined} className={`page-wrapper ${user ? 'app-workspace' : ''} ${bgClass} ${isCustomerWorkspace ? 'customer-workspace' : ''} ${location.pathname === '/' ? 'landing-shell' : ''} ${isBusinessWorkspace ? 'business-page' : ''} ${location.pathname.startsWith('/admin') && user?.role === 'admin' ? 'admin-shell' : ''}`}>
      {!isStandalonePage && <AmbientBackground variant={bgVariant} />}
      {user && !isOnboarding && !isHubPage && !isCustomerDashboard && !isStandalonePage && !hasPublicPageHeader && <Navbar />}
      {user && !isOnboarding && !isHubPage && !isCustomerDashboard && !isStandalonePage && !hasPublicPageHeader && (
        <>
          <BackButton />
        </>
      )}
      {user && !isOnboarding && !isStandalonePage && <AIDesistant />}
      {user?.role === 'owner' && user.ownerAccess?.mustChangePassword && ['ACTIVE','PASSWORD_REQUIRED'].includes(user.ownerAccess.status) && <aside className="owner-password-banner" role="status">Change your temporary password by {new Date(user.ownerAccess.passwordChangeDeadline).toLocaleString()}. <a href="/hub/change-password">Change password</a></aside>}
      <main className={user && !isOnboarding && !isHubPage && !isCustomerDashboard && !isStandalonePage && !hasPublicPageHeader ? "main-content flex-1 flex flex-col min-h-[calc(100dvh-140px)]" : "flex-1 flex flex-col min-h-[calc(100dvh-140px)]"}>
        {!hasWorkspaceNotificationStatus && <PageNotificationStatus />}
        <Routes>
          {guidePages.map(page => <Route key={page.path} path={page.path} element={<PublicGuidePage page={page} />} />)}
          <Route path="/business/apply" element={<BusinessApplicationPage />} />
          <Route path="/doctor/login" element={<DoctorLogin />} />
          <Route path="/doctor/dashboard" element={<ProtectedRoute allowedRoles={['doctor', 'admin']}><DoctorPage /></ProtectedRoute>} />
          <Route path="/hub/login" element={<HubLoginPage />} />
          <Route path="/hub/activate" element={<HubLoginPage />} />
          <Route path="/hub/dashboard" element={<ProtectedRoute allowedRoles={['owner','admin']}><HubHome /></ProtectedRoute>} />
          <Route path="/hub/change-password" element={<ProtectedRoute allowedRoles={['owner']}><OwnerPasswordPage /></ProtectedRoute>} />
          <Route path="/admin/login" element={<AdminDashboard />} />
          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/applications" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard key="applications" /></ProtectedRoute>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/"
            element={
              !user ? (
                <LandingPage />
              ) : user.role === 'owner' ? (
                <Navigate to="/hub/dashboard" replace />
              ) : (
                <Navigate to="/customers" replace />
              )
            }
          />
          <Route path="/coming-soon" element={<AliasRedirect to="/" />} />
          <Route
            path="/customers"
            element={
              <ProtectedRoute allowedRoles={['customer', 'admin']}>
                <CustomerDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/customer" element={<AliasRedirect to="/customers" />} />
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
            element={<BusinessMarketingPage />}
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
            element={<AliasRedirect to="/profile" />}
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
          <Route path="/help" element={<AliasRedirect to="/support" />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="/401" element={<UnauthorizedPage />} />
          <Route path="/403" element={<UnauthorizedPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {showFooter && <Footer />}
    </div>
  )
}
