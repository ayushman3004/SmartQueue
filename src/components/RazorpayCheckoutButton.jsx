import React, { useState } from 'react'
import { toast } from 'react-hot-toast'
import { createStandardOrder, verifyStandardPayment } from '../api/payment.api'

/**
 * Loads the official Razorpay Checkout SDK script dynamically if not already loaded
 */
const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      return resolve(true)
    }
    const existingScript = document.getElementById('razorpay-checkout-js')
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true))
      existingScript.addEventListener('error', () => resolve(false))
      return
    }
    const script = document.createElement('script')
    script.id = 'razorpay-checkout-js'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })

/**
 * Reusable Razorpay Standard Web Checkout Button
 *
 * @param {number} amount - Amount in paise (minimum 100 paise = ₹1.00)
 * @param {string} currency - Currency code, defaults to "INR"
 * @param {string} name - Merchant name
 * @param {string} description - Order description
 * @param {object} prefill - { name, email, contact }
 * @param {function} onSuccess - Callback with verification response
 * @param {function} onFailure - Callback with error details
 * @param {string} className - Optional custom CSS classes
 * @param {React.ReactNode} children - Button label or custom content
 */
export default function RazorpayCheckoutButton({
  amount = 10000, // 10000 paise = ₹100
  currency = 'INR',
  name = 'ServeQ Platform Technologies',
  description = 'Online Payment Settlement',
  image = '/serveq-logo.png',
  prefill = {},
  notes = {},
  themeColor = '#16A34A',
  onSuccess,
  onFailure,
  className = '',
  children,
}) {
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    if (amount < 100) {
      toast.error('Amount must be at least ₹1 (100 paise)')
      return
    }

    setLoading(true)

    try {
      // 1. Ensure official Razorpay Checkout script is loaded
      const isLoaded = await loadRazorpayScript()
      if (!isLoaded || typeof window.Razorpay === 'undefined') {
        toast.error('Unable to load Razorpay Checkout SDK. Please check your internet connection.')
        setLoading(false)
        return
      }

      // 2. Step 1: Create Order on backend
      const res = await createStandardOrder({
        amount,
        currency,
        receipt: `rcpt_${Date.now()}`,
      })

      const data = res.data
      const orderId = data.order_id || data.id
      const keyId =
        data.key_id ||
        import.meta.env.VITE_RAZORPAY_KEY_ID ||
        localStorage.getItem('SERVEQ_RAZORPAY_KEY_ID') ||
        'rzp_test_TrRKQRGYrt7iVb'

      if (!orderId) {
        toast.error('Failed to create Razorpay order.')
        setLoading(false)
        return
      }

      // 3. Step 2: Open Razorpay modal with order_id
      const options = {
        key: keyId,
        amount: data.amount || amount,
        currency: data.currency || currency,
        name,
        description,
        image,
        order_id: orderId,
        prefill: {
          name: prefill.name || '',
          email: prefill.email || '',
          contact: prefill.contact || '',
        },
        notes: {
          ...notes,
          orderId,
        },
        theme: {
          color: themeColor,
        },
        modal: {
          ondismiss: () => {
            toast('Payment checkout closed', { icon: 'ℹ️' })
            setLoading(false)
            onFailure?.({ dismissed: true })
          },
        },
        // Step 3: Handle successful payment and send to verify endpoint
        handler: async (response) => {
          try {
            const verifyRes = await verifyStandardPayment({
              razorpay_order_id: response.razorpay_order_id || orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })

            toast.success('🎉 Payment verified successfully!')
            setLoading(false)
            onSuccess?.(verifyRes.data)
          } catch (vErr) {
            console.error('Signature verification error:', vErr)
            toast.error(
              vErr.response?.data?.message || 'Payment signature verification failed.'
            )
            setLoading(false)
            onFailure?.(vErr)
          }
        },
      }

      const rzp = new window.Razorpay(options)

      rzp.on('payment.failed', (errRes) => {
        console.error('Razorpay payment failed:', errRes)
        toast.error(
          errRes.error?.description || 'Payment failed or was declined by bank.'
        )
        setLoading(false)
        onFailure?.(errRes.error)
      })

      rzp.open()
    } catch (err) {
      console.error('Checkout initialization error:', err)
      toast.error(
        err.response?.data?.message || err.message || 'Failed to start payment.'
      )
      setLoading(false)
      onFailure?.(err)
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleCheckout}
      className={
        className ||
        'px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2'
      }
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Opening Checkout...</span>
        </>
      ) : (
        children || `Pay ₹${(amount / 100).toLocaleString('en-IN')}`
      )}
    </button>
  )
}
