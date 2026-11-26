import { useState } from 'react'
import { checkInWalkIn } from '../api/queue.api'
import { normalizePhoneNumber } from '../utils/phoneNumbers'

const field = 'mt-1 block min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm'

export default function WalkInCheckIn({ businessId, onAdded }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const values = new FormData(form)
    const name = values.get('name').trim()
    const phone = normalizePhoneNumber(values.get('phone'))
    if (!name || !phone) {
      setResult({ error: true, message: 'Enter the patient’s name and a valid mobile number.' })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const { data } = await checkInWalkIn(businessId, { name, phone, whatsappConsent: values.has('whatsappConsent') })
      form.reset()
      setResult({ message: `Patient checked in at position ${data.data.position}.` })
      onAdded()
    } catch (error) {
      setResult({ error: true, message: error.response?.data?.message || 'Could not confirm check-in. Check the queue before trying again.' })
    } finally { setBusy(false) }
  }

  return <section className="business-surface rounded-3xl border border-zinc-200 bg-white p-6 lg:col-span-12" aria-labelledby="walk-in-heading">
    <h3 id="walk-in-heading" className="text-lg font-bold text-zinc-950">Check in a walk-in</h3>
    <form onSubmit={submit} aria-busy={busy} className="mt-4 space-y-4">
      <fieldset disabled={busy} className="grid gap-3 text-sm font-medium sm:grid-cols-2">
        <label>Patient name<input name="name" className={field} maxLength={120} required /></label>
        <label>Mobile number<input name="phone" type="tel" className={field} maxLength={50} placeholder="+91 98765 43210" required /></label>
        <label className="flex items-start gap-2 text-sm font-normal text-zinc-700 sm:col-span-2">
          <input name="whatsappConsent" type="checkbox" className="mt-1 accent-teal-700" />
          The patient agrees to receive a WhatsApp link to the prescription for this visit.
        </label>
      </fieldset>
      <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
        {busy ? 'Checking in…' : 'Add to queue'}
      </button>
      {result && <p role={result.error ? 'alert' : 'status'} className={result.error ? 'text-sm text-red-700' : 'text-sm text-teal-800'}>{result.message}</p>}
    </form>
  </section>
}
