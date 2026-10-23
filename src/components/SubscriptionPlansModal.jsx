import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import {
  X,
  Check,
  Sparkles,
  ShieldCheck,
  Zap,
  Star,
  Loader2,
  ArrowRight,
  Crown,
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

export default function SubscriptionPlansModal({ isOpen, onClose, onSuccess }) {
  const { user, setUser } = useAuth()
  const [processingPlan, setProcessingPlan] = useState(null)

  const activePlanId = user?.subscription?.status === 'ACTIVE' ? user?.subscription?.plan : null

  const handleSelectPlan = async (plan) => {
    if (activePlanId === plan.id) {
      toast('You are currently subscribed to this plan.', { icon: 'ℹ️' })
      return
    }

    setProcessingPlan(plan.id)
    try {
      // Step 1: Create Razorpay Order on ServeQ Platform
      const res = await createSubscriptionOrder(plan.id)
      const { order, keyId } = res.data.data

      // Step 2: Handle Mock / Development Checkout
      if (order.isMock) {
        const verifyRes = await verifySubscriptionPayment({
          plan: plan.id,
          razorpayOrderId: order.id,
          razorpayPaymentId: `pay_mock_${Date.now()}`,
          razorpaySignature: 'mock_signature_verified',
        })

        const updatedData = verifyRes.data.data
        if (setUser && updatedData.user) {
          setUser((prev) => ({
            ...prev,
            subscription: updatedData.subscription,
          }))
        }

        toast.success(`🎉 ${plan.name} (₹${plan.price}) activated successfully!`, {
          duration: 5000,
        })
        onSuccess?.(updatedData)
        onClose?.()
        return
      }

      // Step 3: Load Razorpay Checkout dynamically
      const loadRazorpay = () =>
        new Promise((resolve) => {
          if (window.Razorpay) return resolve(true)
          const script = document.createElement('script')
          script.src = 'https://checkout.razorpay.com/v1/checkout.js'
          script.onload = () => resolve(true)
          script.onerror = () => resolve(false)
          document.body.appendChild(script)
        })

      const isLoaded = await loadRazorpay()
      if (!isLoaded) {
        toast.error('Unable to load Razorpay checkout. Please check your network connection.')
        return
      }

      // Step 4: Launch Razorpay Checkout Modal for ServeQ
      const options = {
        key: keyId || order.keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'serveQ Technologies',
        description: `${plan.name} Subscription (${plan.displayPrice})`,
        image: '/serveq-logo.png',
        order_id: order.id,
        handler: async (response) => {
          try {
            const verifyRes = await verifySubscriptionPayment({
              plan: plan.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })

            const updatedData = verifyRes.data.data
            if (setUser && updatedData.user) {
              setUser((prev) => ({
                ...prev,
                subscription: updatedData.subscription,
              }))
            }

            toast.success(`🎉 ${plan.name} activated successfully! Welcome to ServeQ ${plan.name}.`, {
              duration: 5000,
            })
            onSuccess?.(updatedData)
            onClose?.()
          } catch (vErr) {
            toast.error(vErr.response?.data?.message || 'Payment verification failed. Please contact support.')
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.phone || '',
        },
        theme: {
          color: '#064E3B',
        },
        modal: {
          ondismiss: () => {
            toast('Subscription payment session closed.')
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (errRes) => {
        toast.error(errRes.error?.description || 'Payment failed. Please try again.')
      })
      rzp.open()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate plan checkout')
    } finally {
      setProcessingPlan(null)
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
                Streamline footfall, empower your staff, and delight customers. Pay directly to ServeQ via secure Razorpay checkout.
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
                            <Loader2 className="w-4 h-4 animate-spin" />
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
                  Direct ServeQ Razorpay Settlement &bull; 256-Bit SSL Encryption
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                Cancel or upgrade your subscription anytime from your Hub Console.
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
