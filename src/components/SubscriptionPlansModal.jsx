import { useState } from 'react'
import { X } from 'lucide-react'
import BusinessSubscriptionPlans from './BusinessSubscriptionPlans'

export default function SubscriptionPlansModal({ isOpen, onClose, onSuccess }) {
  const [busy, setBusy] = useState(false)
  if (!isOpen) return null
  return <div className="business-subscription-overlay fixed inset-0 z-50 p-4 sm:p-6 bg-zinc-950/40 backdrop-blur-xs overflow-y-auto flex items-start justify-center">
    <section role="dialog" aria-modal="true" aria-labelledby="subscription-plans-title" className="business-page business-subscription-dialog relative max-w-4xl w-full my-auto rounded-3xl border p-5 sm:p-8 bg-white">
      <div className="flex items-start justify-between gap-4 mb-6"><div><p className="business-eyebrow">MAKE ROOM FOR YOUR NEXT CHAPTER</p><h2 id="subscription-plans-title" className="text-2xl mt-2">A plan for your business.</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close subscription plans" className="p-2 rounded-full bg-zinc-100"><X size={20} /></button></div>
      <BusinessSubscriptionPlans onBusyChange={setBusy} onSuccess={async (result) => { await onSuccess?.(result); onClose?.() }} />
    </section>
  </div>
}
