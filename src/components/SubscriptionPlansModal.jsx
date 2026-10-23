import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  X,
  Check,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Crown,
  KeyRound,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  createSubscriptionOrder,
  verifySubscriptionPayment,
} from '../api/subscription.api'

const PLANS = [
  {
    id: 'BASIC',
    name: 'Basic Plan',
    price: 999,
    displayPrice: '₹999',
    period: '/ month',
    tagline: 'Essential virtual queue and scheduling foundation for standard venues.',
    badge: 'Starter',
    features: [
      'Standard Virtual Queue & Priority Counter Passes',
      'Appointment Booking & Slot Calendar',
      'Up to 3 Active Staff / Service Practitioners',
      'Counter Payments with Cash & UPI QR Tracking',
      'Automated SMS & Web Wait-Time Tracking',
      'Standard Footfall & Revenue Analytics',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro Plan',
    price: 1999,
    displayPrice: '₹1,999',
    period: '/ month',
    tagline: 'Advanced automation, instant online payments, and AI intelligence for high-traffic venues.',
    badge: 'Recommended',
    popular: true,
    features: [
      'Everything in Basic Plan, plus:',
      'Unlimited Staff Members & Practitioners',
      'Direct Online Razorpay Payments & Settlements',
      'AI Peak-Hour & Wait-Time Predictive Analytics',
      'Express VIP Queue Passes & Priority Slot Routing',
      'Multi-Service Sequencing & Combined Booking',
      'Dedicated 24/7 Priority Support & Venue Manager',
    ],
  },
]

// Ensure official Razorpay Standard Checkout SDK is loaded
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

export default function SubscriptionPlansModal({ isOpen, onClose, onSuccess }) {
  const { user, setUser } = useAuth()
  const [processingPlan, setProcessingPlan] = useState(null)
  const [keyPromptData, setKeyPromptData] = useState(null)
  const [customKeyInput, setCustomKeyInput] = useState('')

  const activePlanId = user?.subscription?.status === 'ACTIVE' ? user?.subscription?.plan : null

  const getEffectiveKey = (backendKey) => {
    if (backendKey && backendKey !== 'rzp_test_placeholder') return backendKey
    const viteKey = import.meta.env.VITE_RAZORPAY_KEY_ID
    if (viteKey && viteKey !== 'rzp_test_placeholder') return viteKey
    const stored = localStorage.getItem('SERVEQ_RAZORPAY_KEY_ID')
    if (stored && stored.trim()) return stored.trim()
    return null
  }

  const launchOfficialRazorpayCheckout = ({ plan, order, keyId }) => {
    const effectiveKey = keyId || getEffectiveKey()

    if (!effectiveKey) {
      // Prompt user to provide their Razorpay Test/Live Key ID so the official modal opens
      setKeyPromptData({ plan, order })
      return
    }

    const options = {
      key: effectiveKey,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'ServeQ Platform Technologies',
      description: `${plan.name} Subscription (${plan.displayPrice}/mo)`,
      image: '/logo.png',
      // Pass order_id ONLY when a authentic Razorpay API order was created
      ...(order?.id && !order.isMock && !order.id.startsWith('order_mock_')
        ? { order_id: order.id }
        : {}),
      handler: async (response) => {
        try {
          const verifyRes = await verifySubscriptionPayment({
            plan: plan.id,
            razorpayOrderId: response.razorpay_order_id || order.id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature || 'mock_signature_verified',
          })

          const updatedData = verifyRes.data.data
          if (setUser && updatedData.user) {
            setUser((prev) => ({
              ...prev,
              subscription: updatedData.subscription,
            }))
          }

          toast.success(`🎉 ${plan.name} activated successfully via Razorpay!`, {
            duration: 5000,
          })
          onSuccess?.(updatedData)
          onClose?.()
        } catch (vErr) {
          toast.error(vErr.response?.data?.message || 'Payment verification failed. Please contact support.')
        }
      },
      prefill: {
        name: user?.name || '',
        email: user?.email || '',
        contact: user?.phone || '',
      },
      notes: {
        planId: plan.id,
        planName: plan.name,
        userId: user?._id || '',
      },
      theme: {
        color: '#064E3B',
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
  }

  const handleSelectPlan = async (plan) => {
    if (activePlanId === plan.id) {
      toast('You are currently subscribed to this plan.', { icon: 'ℹ️' })
      return
    }

    setProcessingPlan(plan.id)
    try {
      // 1. Ensure Razorpay Standard Checkout SDK is ready
      const isLoaded = await loadRazorpayScript()
      if (!isLoaded) {
        toast.error('Unable to load official Razorpay SDK. Please check your internet connection.')
        return
      }

      // 2. Create Razorpay order on ServeQ backend
      const res = await createSubscriptionOrder(plan.id)
      const data = res.data.data
      const order = data.order || data
      const keyId = data.keyId || order.keyId

      const effectiveKey = getEffectiveKey(keyId)

      if (!effectiveKey) {
        setKeyPromptData({ plan, order })
        return
      }

      // 3. Launch the official Razorpay Checkout popup
      launchOfficialRazorpayCheckout({ plan, order, keyId: effectiveKey })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate plan checkout')
    } finally {
      setProcessingPlan(null)
    }
  }

  const handleSaveKeyAndLaunch = () => {
    const trimmed = customKeyInput.trim()
    if (!trimmed) {
      toast.error('Please enter your Razorpay Key ID (e.g. rzp_test_...)')
      return
    }
    localStorage.setItem('SERVEQ_RAZORPAY_KEY_ID', trimmed)
    toast.success('Razorpay Key configured!')
    if (keyPromptData) {
      const { plan, order } = keyPromptData
      setKeyPromptData(null)
      launchOfficialRazorpayCheckout({ plan, order, keyId: trimmed })
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl bg-white border border-zinc-200 rounded-3xl shadow-2xl overflow-hidden my-8"
        >
          {/* Header Bar */}
          <div className="p-6 sm:p-8 bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#064E3B] text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none" />
            
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="max-w-xl space-y-2 relative z-10 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-[11px] font-bold text-emerald-100 uppercase tracking-wider">
                <Crown className="w-3.5 h-3.5 text-amber-300" />
                <span>ServeQ Business Plans</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Choose the Right Plan for Your Venue
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 font-medium">
                Streamline footfall, empower your staff, and delight customers. Pay directly via the official Razorpay Checkout gateway.
              </p>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="p-6 sm:p-8 bg-zinc-50/70">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              {PLANS.map((plan) => {
                const isCurrent = activePlanId === plan.id
                const isProcessing = processingPlan === plan.id

                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-3xl p-6 sm:p-7 transition-all flex flex-col justify-between ${
                      plan.popular
                        ? 'bg-white border-2 border-emerald-600 shadow-xl ring-4 ring-emerald-500/10'
                        : 'bg-white border border-zinc-200 shadow-sm hover:border-zinc-300'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 right-6 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        {plan.badge}
                      </div>
                    )}

                    <div>
                      {/* Plan Name & Tagline */}
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-black text-zinc-950 flex items-center gap-2">
                          {plan.name}
                        </h3>
                        {!plan.popular && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                            {plan.badge}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-500 min-h-[34px] leading-relaxed">
                        {plan.tagline}
                      </p>

                      {/* Price Section */}
                      <div className="my-5 pb-5 border-b border-zinc-100 flex items-baseline gap-1.5">
                        <span className="text-4xl sm:text-5xl font-black text-zinc-950 tracking-tight">
                          {plan.displayPrice}
                        </span>
                        <span className="text-xs font-bold text-zinc-400">
                          {plan.period}
                        </span>
                      </div>

                      {/* Features List */}
                      <div className="space-y-3 mb-6">
                        <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                          Included Features
                        </p>
                        <ul className="space-y-2.5">
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-700">
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                plan.popular ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-700'
                              }`}>
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                              <span className="leading-tight">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={isCurrent || !!processingPlan}
                        onClick={() => handleSelectPlan(plan)}
                        className={`w-full py-3.5 px-4 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
                          isCurrent
                            ? 'bg-zinc-100 text-zinc-500 cursor-not-allowed border border-zinc-200'
                            : plan.popular
                            ? 'bg-[#064E3B] hover:bg-[#047857] text-white active:scale-98'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white active:scale-98'
                        }`}
                      >
                        {isProcessing ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Opening Razorpay Checkout...</span>
                          </>
                        ) : isCurrent ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Current Active Plan</span>
                          </>
                        ) : (
                          <>
                            <span>Choose {plan.name} ({plan.displayPrice})</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bottom Security Assurance */}
            <div className="mt-6 pt-5 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-3">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>
                  Official Razorpay Payment Gateway &bull; 256-Bit SSL Encryption
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Cancel or upgrade your subscription anytime from your Hub Console.
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Razorpay Key Configuration Modal (if key is missing in .env) */}
      {keyPromptData && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-7 border border-zinc-200 text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <KeyRound className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setKeyPromptData(null)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-lg font-black text-zinc-900 mb-1">
              Connect Razorpay Key ID
            </h3>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              To launch the official Razorpay Checkout popup, paste your <strong>Key ID</strong> from your open Razorpay Dashboard (starts with <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800 font-mono">rzp_test_...</code> or <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800 font-mono">rzp_live_...</code>).
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block mb-1.5">
                  Razorpay Key ID
                </label>
                <input
                  type="text"
                  value={customKeyInput}
                  onChange={(e) => setCustomKeyInput(e.target.value)}
                  placeholder="rzp_test_xxxxxxxxxxxxxx"
                  className="w-full px-3.5 py-2.5 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:border-emerald-600 font-mono"
                  autoFocus
                />
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-[11px] text-zinc-500 space-y-1">
                <div className="font-semibold text-zinc-700 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Where to find this in your Razorpay Dashboard:</span>
                </div>
                <p>
                  Settings &rarr; API Keys &rarr; Generate Key ID (or copy existing Key ID). You can also add it to <code className="font-mono text-zinc-700">.env</code> as <code className="font-mono text-zinc-700">RAZORPAY_KEY_ID</code>.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKeyPromptData(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveKeyAndLaunch}
                className="flex-1 py-2.5 rounded-xl bg-[#064E3B] hover:bg-[#047857] text-white text-xs font-bold shadow-md cursor-pointer active:scale-98"
              >
                Launch Razorpay Checkout
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
