import { useCallback, useEffect, useState } from 'react'
import { Mail, Ticket } from 'lucide-react'
import api from '../api/axios'

export default function AdminFreeSubscriptionCoupon({ business }) {
  const [coupon, setCoupon] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const endpoint = `/admin/business/${business._id}/subscription-coupon`
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const { data } = await api.get(endpoint); setCoupon(data.data.coupon) }
    catch (err) { setError(err.response?.data?.message || 'Could not load this business’s coupon.') }
    finally { setLoading(false) }
  }, [endpoint])
  useEffect(() => { load() }, [load])
  const send = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const { data } = await api.post(endpoint, {}, { timeout: 45000 })
      setCoupon(data.data.coupon)
      if (data.data.emailSent) setNotice(`Coupon emailed to ${data.data.coupon.email}.`)
      else setError('Coupon saved, but email delivery failed. Wait one minute, then resend the same coupon.')
    } catch (err) { setError(err.response?.data?.message || 'Could not send the coupon. Refresh its status before retrying.') }
    finally { setBusy(false) }
  }
  const redeemed = coupon?.status === 'REDEEMED'
  const expired = coupon && new Date(coupon.redeemBy).getTime() <= Date.now()
  const eligible = business.approvalStatus === 'approved' && Boolean(business.email)
  return <section className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 space-y-3" aria-labelledby="free-pro-coupon-heading">
    <div className="flex items-start gap-2"><Ticket size={18} className="shrink-0 text-emerald-800" /><div><h4 id="free-pro-coupon-heading" className="text-sm font-bold text-zinc-950">Free Pro subscription coupon</h4><p className="mt-1 text-xs leading-relaxed text-zinc-600">One free 30-day Pro period for this business. The owner activates it from Subscription. No payment or automatic renewal.</p></div></div>
    <p className="text-xs text-zinc-600 break-all">Business email: <strong>{business.email || 'Add a business email first'}</strong></p>
    {loading ? <p role="status">Loading coupon status…</p> : <>
      {coupon && <div className="bg-white rounded-xl border border-emerald-100 p-3 space-y-2">
        <code className="block text-sm font-bold text-emerald-900 break-all select-all">{coupon.code}</code>
        <p className="text-xs text-zinc-600">{redeemed ? `Activated once · Pro until ${new Date(coupon.subscriptionExpiresAt).toLocaleDateString('en-IN')}` : expired ? 'Coupon expired' : `Redeem by ${new Date(coupon.redeemBy).toLocaleDateString('en-IN')} · Email: ${coupon.emailStatus.toLowerCase()}`}</p>
      </div>}
      {!eligible && <p className="text-xs text-amber-800">An approved business with a valid business email is required.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !eligible || redeemed || Boolean(expired) || Boolean(error && !coupon)} onClick={send} className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl bg-emerald-900 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"><Mail size={15} />{busy ? 'Sending coupon…' : redeemed ? 'Coupon already activated' : coupon ? 'Resend coupon email' : 'Generate & email free Pro coupon'}</button>
        <button type="button" disabled={busy} onClick={load} className="min-h-11 px-3 py-2 text-xs font-semibold underline">Refresh status</button>
      </div>
    </>}
    {error && <p role="alert" className="text-xs leading-relaxed text-rose-800">{error}</p>}
    {notice && <p role="status" className="text-xs text-emerald-900">{notice}</p>}
  </section>
}
