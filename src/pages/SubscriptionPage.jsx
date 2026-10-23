import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  Crown,
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Lock,
  ArrowLeft,
  Zap,
  HelpCircle,
  ExternalLink,
  CreditCard,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getCurrentSubscription,
  createSubscriptionOrder,
  verifySubscriptionPayment,
} from '../api/subscription.api'
import { getMyBusinesses } from '../api/business.api'
import { useSeo } from '../utils/useSeo'

// Load official Razorpay Standard Checkout SDK
const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const existing = document.getElementById('razorpay-checkout-js')
    if (existing) {
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const script = document.createElement('script')
    script.id = 'razorpay-checkout-js'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })

export default function SubscriptionPage() {
  useSeo({
    title: 'My Subscription',
    description: 'Manage your ServeQ business subscription, features, and plan details.',
  })

  const { user, setUser, logOut } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [subscriptionData, setSubscriptionData] = useState(() => user?.subscription || null)

  const effectiveSub =
    subscriptionData?.subscription ||
    subscriptionData ||
    user?.subscription ||
    null

  const activePlan = effectiveSub?.status === 'ACTIVE' ? effectiveSub?.plan : null
  const isBasic = activePlan === 'BASIC'
  const isPro = activePlan === 'PRO'

  // Refresh latest subscription status from backend
  useEffect(() => {
    setLoading(true)
    getCurrentSubscription()
      .then((res) => {
        const sub = res.data?.data?.subscription || res.data?.data
        if (sub) {
          setSubscriptionData(sub)
          if (setUser && sub.status) {
            setUser((prev) => (prev ? { ...prev, subscription: sub } : prev))
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [setUser])

  const getEffectiveKey = () => {
    const viteKey = import.meta.env.VITE_RAZORPAY_KEY_ID
    if (viteKey && viteKey !== 'rzp_test_placeholder') return viteKey
    const stored = localStorage.getItem('SERVEQ_RAZORPAY_KEY_ID')
    if (stored && stored.trim()) return stored.trim()
    return 'rzp_test_placeholder'
  }

  const handleSubscribePlan = async (planId) => {
    setUpgrading(true)
    try {
      const isLoaded = await loadRazorpayScript()
      if (!isLoaded) {
        toast.error('Unable to load Razorpay Checkout. Please check your internet connection.')
        return
      }

      const res = await createSubscriptionOrder(planId)
      const order = res.data?.data?.order

      if (!order) {
        toast.error(`Failed to initiate ${planId} Plan checkout order.`)
        return
      }

      const keyId =
        data.keyId ||
        order.keyId ||
        getEffectiveKey() ||
        import.meta.env.VITE_RAZORPAY_KEY_ID ||
        'rzp_test_TrJxH9KnV9zPUX'

      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'ServeQ Platform Technologies',
        description: `${planId === 'PRO' ? 'Pro Plan' : 'Basic Plan'} Subscription (₹${planId === 'PRO' ? '1,999' : '999'}/mo)`,
        image: '/serveq-logo.png',
        ...(order?.id && !order.isMock && !order.id.startsWith('order_mock_')
          ? { order_id: order.id }
          : {}),
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#16A34A',
        },
        handler: async (response) => {
          try {
            const verifyRes = await verifySubscriptionPayment({
              plan: planId,
              razorpayOrderId: response.razorpay_order_id || order.id,
              razorpayPaymentId: response.razorpay_payment_id || 'pay_verified',
              razorpaySignature: response.razorpay_signature || 'sig_verified',
            })

            const updatedData = verifyRes.data.data
            if (setUser && updatedData.user) {
              setUser((prev) => ({
                ...prev,
                subscription: updatedData.subscription,
              }))
            }
            setSubscriptionData(updatedData.subscription)
            toast.success(`🎉 Successfully subscribed to ${planId === 'PRO' ? 'Pro' : 'Basic'} Plan!`, { duration: 6000 })

            try {
              const bizRes = await getMyBusinesses()
              const list = bizRes.data?.data?.businesses || []
              const completed = list.find((b) => b.onboarding?.status === 'COMPLETED')
              if (completed) {
                navigate(`/business/${completed._id}`)
              } else {
                navigate('/business/onboarding')
              }
            } catch {
              navigate('/business')
            }
          } catch (vErr) {
            toast.error(vErr.response?.data?.message || 'Payment verification failed.')
          }
        },
        modal: {
          ondismiss: () => {
            toast('Razorpay checkout window closed.', { icon: 'ℹ️' })
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (errRes) => {
        toast.error(errRes.error?.description || 'Razorpay payment was not completed')
      })
      rzp.open()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start subscription order')
    } finally {
      setUpgrading(false)
    }
  }

  const handleUpgradeToPro = () => handleSubscribePlan('PRO')

  const handleBackToDashboard = async () => {
    try {
      const bizRes = await getMyBusinesses()
      const list = bizRes.data?.data?.businesses || []
      const completed = list.find((b) => b.onboarding?.status === 'COMPLETED')
      if (completed) {
        navigate(`/business/${completed._id}`)
      } else {
        navigate('/business')
      }
    } catch {
      navigate('/business')
    }
  }

  return (
    <div className="min-h-screen app-background-glow text-zinc-900 flex flex-col font-sans selection:bg-[#EAF7EE] selection:text-[#114227] relative overflow-x-hidden">
      {/* ── TOP HEADER BAR ── */}
      <header className="sticky top-0 z-40 bg-[#f7fcf9]/90 backdrop-blur-md border-b border-[#BDE8CB]/70 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackToDashboard}
            className="p-2 rounded-xl text-zinc-600 hover:text-zinc-950 hover:bg-[#EAF7EE] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4 text-[#114227]" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </button>
          <div className="h-4 w-px bg-[#BDE8CB]" />
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-zinc-950 tracking-tight">serveQ</span>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EAF7EE] text-[#114227] border border-[#BDE8CB]">
              Venue Subscription
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => navigate('/support')}
            className="px-3 py-1.5 rounded-xl border border-[#BDE8CB] bg-white hover:bg-[#EAF7EE] text-zinc-700 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#114227]" />
            <span>Support</span>
          </button>

          <button
            type="button"
            onClick={() => {
              logOut()
              navigate('/login')
            }}
            className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-rose-50 hover:border-rose-200 text-zinc-600 hover:text-rose-700 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            title="Sign out of your account"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8 text-left">
        {/* Page Title & Status Eyebrow */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF7EE] border border-[#BDE8CB] text-[#114227] text-xs font-black uppercase tracking-wider">
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            <span>ServeQ Business Membership</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-zinc-950 tracking-tight">
            My Subscription
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 font-medium max-w-2xl">
            {isPro
              ? 'Your venue is operating at maximum tier with unlimited capacity and full AI intelligence.'
              : isBasic
              ? 'Your venue is currently active on the Basic Plan. Review your included features or upgrade to Pro below.'
              : 'Choose an active subscription plan to manage live appointments, queues, and floor operations.'}
          </p>
        </div>

        {/* ── CASE 1: BASIC PLAN SUBSCRIBED ── */}
        {isBasic && (
          <div className="space-y-6">
            {/* Active Basic Plan Overview Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-[#BDE8CB] shadow-xs relative overflow-hidden space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#BDE8CB]/60 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl sm:text-2xl font-black text-zinc-950">Basic Plan</h2>
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#EAF7EE] text-[#114227] border border-[#BDE8CB]">
                      ✓ Active Plan
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-500 font-medium">
                    Essential virtual queue and scheduling foundation for independent venues.
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-2xl sm:text-3xl font-black text-[#114227]">₹999</p>
                  <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">per month &bull; Billed Monthly</p>
                </div>
              </div>

              {/* What You Get in Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-zinc-500 tracking-wider">
                  What You Get in Details:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-800">
                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>5 Staff & Specialist Roster Slots:</strong> Add doctors, barbers, or stylists with individual availability toggles.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>Live Virtual Queue & Floor:</strong> Call next customer, manage waiting times, and floor capacity seamlessly.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>Appointment Booking Calendar:</strong> Patrons select available time-slots with zero advance online fee.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>Counter Payment Collection:</strong> Direct Cash, Card POS & Venue UPI QR with one-click payment verification.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>Dynamic Wait-Time Estimates:</strong> Real-time automated calculations based on live service progress.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>Customer Tracking & History:</strong> Full historical ledger of served appointments and queue completions.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>Direct Notifications:</strong> Patrons receive automatic position alerts when approaching their turn.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>Standard Business Support:</strong> Verified ticketing and email technical assistance.</span>
                  </div>
                </div>
              </div>

              {/* Locked Features Notice */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Features not included in Basic Plan:</span> AI Performance Intelligence, predictive peak-hour congestion forecasting, and unlimited staff seats are exclusive to the Pro Plan.
                </div>
              </div>
            </div>

            {/* Small Upgrade to Pro Card */}
            <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-[#EAF7EE] via-emerald-50/60 to-white border-2 border-emerald-500 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                    Recommended Upgrade
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-zinc-950">
                  Upgrade to Pro Plan — ₹1,999 / mo
                </h3>
                <p className="text-xs text-zinc-600 max-w-xl">
                  Unlock unlimited staff seats, full AI-powered executive analytics, peak-hour predictive models, and VIP 24/7 dedicated support.
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-bold text-[#114227]">
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-[#BDE8CB]">• Unlimited Staff</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-[#BDE8CB]">• Full AI Analytics</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-[#BDE8CB]">• VIP 24/7 Support</span>
                </div>
              </div>

              <button
                type="button"
                disabled={upgrading}
                onClick={handleUpgradeToPro}
                className="px-6 py-3.5 rounded-2xl bg-[#114227] hover:bg-[#0D361F] text-white font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-2 disabled:opacity-50"
              >
                {upgrading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Connecting Razorpay...</span>
                  </>
                ) : (
                  <>
                    <span>Upgrade to Pro →</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── CASE 2: PRO PLAN SUBSCRIBED (ONLY SHOW DETAILS OF PRO SUBSCRIPTION) ── */}
        {isPro && (
          <div className="space-y-6">
            {/* Top Pro VIP Active Banner */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-[#16A34A] shadow-sm relative overflow-hidden space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#BDE8CB]/60 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center font-black shadow-xs">
                      <Crown className="w-5 h-5 text-amber-950" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-zinc-950">Pro Plan</h2>
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#EAF7EE] text-[#114227] border border-[#BDE8CB]">
                      ✓ Top Tier Active
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-500 font-medium">
                    Maximum platform tier unlocked. All automated queue tools, AI intelligence, and VIP support are active.
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-2xl sm:text-3xl font-black text-[#114227]">₹1,999</p>
                  <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">per month &bull; Billed Monthly</p>
                </div>
              </div>

              {/* Status & Billing Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-[#EAF7EE]/60 border border-[#BDE8CB] text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">Subscription Status</span>
                  <span className="font-black text-[#114227]">ACTIVE / IN GOOD STANDING</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">Billing Interval</span>
                  <span className="font-black text-zinc-900">30 Days (Monthly)</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">Valid Until</span>
                  <span className="font-black text-zinc-900">
                    {effectiveSub?.expiresAt
                      ? new Date(effectiveSub.expiresAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Active'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">Feature Level</span>
                  <span className="font-black text-emerald-700">100% Unlocked</span>
                </div>
              </div>

              {/* Full Details of Pro Subscription */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase text-zinc-500 tracking-wider">
                  Full Details of Your Pro Subscription:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-800">
                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>Unlimited Staff, Doctors & Barbers:</strong> Zero limits on team member roster seats, individual schedules, and specialty listings.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>AI Executive Performance Intelligence:</strong> Automated peak-hour detection, congestion forecasting, top customer identification, and employee analytics.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>Intelligent Auto-Fallback Assignment:</strong> Automatically assigns on-duty general practitioners or available barbers when preferred staff is busy.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>Priority Floor & Virtual Queue Passes:</strong> Handle massive peak footfall without delays or queue capacity caps.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>Multi-Service Sequencing:</strong> Allow customers to select multiple consecutive treatments or procedures in a single booking.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>Direct Counter Settlement & QR:</strong> Retain 100% of revenue with Cash, POS Card, or custom Venue UPI QR display.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>Automated Customer Alerts:</strong> Instant queue position warnings via Web sockets and WhatsApp/SMS.</span>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#f7fcf9] border border-[#BDE8CB]/70">
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5 stroke-[3]" />
                    <span><strong>VIP 24/7 Dedicated Account Manager:</strong> Direct priority escalation channel and proactive system health monitoring.</span>
                  </div>
                </div>
              </div>

              {/* Premium Standing Badge & Actions */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-[#EAF7EE] via-white to-emerald-50 border border-[#BDE8CB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#114227]">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-[#16A34A] shrink-0" />
                  <div>
                    <span className="font-bold text-sm block text-zinc-950">Your venue is running with all Pro features unlocked and verified.</span>
                    {effectiveSub?.expiresAt && (
                      <span className="text-[11px] text-zinc-500 font-medium">
                        Active period valid until {new Date(effectiveSub.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white px-2.5 py-1.5 rounded-lg border border-[#BDE8CB] hidden sm:inline-block">
                    Tier 1 Certified
                  </span>
                  <button
                    type="button"
                    onClick={handleBackToDashboard}
                    className="flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-[#114227] hover:bg-[#0D361F] text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                  >
                    <span>Go to Business Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CASE 3: INACTIVE OR EXPIRED SUBSCRIPTION ── */}
        {!isBasic && !isPro && (
          loading ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-[#BDE8CB] shadow-xs space-y-3">
              <div className="w-8 h-8 border-3 border-[#16A34A] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Verifying your active subscription status...</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#BDE8CB] shadow-xs flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-zinc-950">Basic Plan</h3>
                  <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                    Starter
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-zinc-950">₹999</span>
                  <span className="text-xs text-zinc-500 font-bold">/ month</span>
                </div>
                <p className="text-xs text-zinc-600">
                  Ideal for single practitioners or small local venues getting started with virtual queues.
                </p>
                <div className="space-y-2 text-xs text-zinc-700 pt-2 border-t border-zinc-100">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Up to 5 Staff & Specialist Roster Slots</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Live Floor & Virtual Queue Management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Customer Appointment Slot Booking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>100% Counter Settlement (Cash, Card, UPI)</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={upgrading}
                onClick={() => handleSubscribePlan('BASIC')}
                className="w-full py-3 rounded-2xl border-2 border-zinc-900 text-zinc-900 font-bold text-xs uppercase tracking-wider hover:bg-zinc-900 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              >
                {upgrading ? 'Processing...' : 'Choose Basic (₹999)'}
              </button>
            </div>

            {/* Pro Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-[#16A34A] shadow-md flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-zinc-950">Pro Plan</h3>
                  <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#EAF7EE] text-[#114227] border border-[#BDE8CB]">
                    Recommended
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-[#114227]">₹1,999</span>
                  <span className="text-xs text-zinc-500 font-bold">/ month</span>
                </div>
                <p className="text-xs text-zinc-600">
                  Full power of AI analytics, unlimited staff members, and VIP priority support.
                </p>
                <div className="space-y-2 text-xs text-zinc-700 pt-2 border-t border-zinc-100">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#16A34A]" />
                    <span><strong>Unlimited</strong> Staff, Doctors & Barbers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#16A34A]" />
                    <span><strong>Full AI</strong> Executive Performance Analytics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#16A34A]" />
                    <span>Predictive Peak-Hour Congestion Forecasting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#16A34A]" />
                    <span>Intelligent Auto-Fallback Staff Allocation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#16A34A]" />
                    <span>24/7 VIP Dedicated Account Manager</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleUpgradeToPro}
                className="w-full py-3.5 rounded-2xl bg-[#114227] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#0D361F] transition-all shadow-md cursor-pointer"
              >
                Choose Pro & Pay via Razorpay (₹1,999) →
              </button>
            </div>
          </div>
        )
      )}
      </main>
    </div>
  )
}
