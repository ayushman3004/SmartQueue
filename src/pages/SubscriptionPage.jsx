import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useSeo } from '../utils/useSeo'
import { getMyBusinesses } from '../api/business.api'
import BusinessSubscriptionPlans from '../components/BusinessSubscriptionPlans'
import BusinessSetupProgress from '../components/BusinessSetupProgress'
import { hasActiveSubscription } from '../utils/subscription'

export default function SubscriptionPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  useEffect(() => {
    if (user?.role !== 'admin' && !user?.isEmailVerified && user?.authProvider !== 'google') navigate('/business/onboarding', { replace: true })
  }, [user, navigate])
  useSeo({ title: 'My Subscription', description: 'Manage your serveQ business plan and subscription.', robots: 'noindex, nofollow' })
  const continueToBusiness = async () => {
    try {
      const { data } = await getMyBusinesses()
      const businesses = data.data?.businesses || []
      const completed = businesses.find((business) => business.onboarding?.status === 'COMPLETED')
      const draft = businesses.find((business) => business.onboarding?.status === 'IN_PROGRESS')
      navigate(completed ? `/business/${completed._id}` : draft ? `/business/onboarding/${draft._id}` : '/business/onboarding')
    } catch { navigate('/hub/dashboard') }
  }
  return <div className="business-page business-pricing min-h-screen app-background-glow">
    <header className="business-page-header"><button type="button" onClick={() => navigate('/hub/dashboard')} className="inline-flex items-center gap-2 text-sm"><ArrowLeft size={16} />Business home</button><img src="/serveq-logo.png" alt="serveQ" className="h-7 w-auto" /><button type="button" onClick={() => navigate('/support')} className="text-sm">Support</button></header>
    <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <BusinessSetupProgress current={2} />
      <div className="business-pricing-intro space-y-3"><p className="business-eyebrow">YOUR BUSINESS, AT ITS BEST</p><h1 className="text-3xl sm:text-4xl">A little less waiting.<br />More room to grow.</h1><p className="text-sm text-zinc-600">Choose your plan, complete payment, then continue setting up your venue.</p></div>
      <BusinessSubscriptionPlans onSuccess={async () => { toast.success('Subscription activated.'); await continueToBusiness() }} />
      {hasActiveSubscription(user?.subscription) && <button type="button" onClick={continueToBusiness} className="text-sm font-semibold underline">Continue to my business</button>}
    </main>
  </div>
}
