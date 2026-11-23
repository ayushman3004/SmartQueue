import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { chooseOwnerCategory, getOwnerCategories, getAccessibleBusinesses } from '../api/business.api'
import { hasActiveSubscription } from '../utils/subscription'

export default function OwnerCategoryBoundary({ children }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [state, setState] = useState({ loading: true, categories: [], businesses: [] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setState(previous => ({ ...previous, loading: true }))
    Promise.all([getOwnerCategories(), getAccessibleBusinesses()]).then(([access, venues]) => {
      if (active) setState({ loading: false, categories: access.data.data.categories, businesses: venues.data.data.businesses })
    }).catch(() => { if (active) { setState({ loading: false, categories: [], businesses: [] }); setError('Could not load business access. Please retry.') } })
    return () => { active = false }
  }, [pathname, revision])
  if (user?.role === 'admin') return children
  if (!hasActiveSubscription(user?.subscription) || (!user?.isEmailVerified && user?.authProvider !== 'google')) return children
  if (state.loading) return <p className="p-8" role="status">Loading your business access…</p>
  const businessId = pathname.match(/^\/business\/(?:onboarding\/)?([^/]+)/)?.[1]
  const denied = businessId && businessId !== 'onboarding' && !state.businesses.some(business => String(business._id) === businessId)
  if (state.categories.length && !denied) return children
  return <main className="business-page min-h-screen flex items-center justify-center p-6">
    <section className="w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-8 space-y-6">
      <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Business access</p>
      <h1 className="text-3xl font-bold">{denied ? 'This venue is not available to your account' : 'Enable clinic access'}</h1>
      <p className="text-sm text-zinc-600">Enable access to continue setting up your clinic.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!denied && !error && <div><button type="button" disabled={busy} className="rounded-2xl border border-teal-200 bg-teal-50 p-6 font-bold capitalize text-teal-900 disabled:opacity-50" onClick={async () => {
        setBusy(true)
        try { await chooseOwnerCategory('clinic'); setRevision(value => value + 1) }
        catch (failure) { setError(failure.response?.data?.message || 'Could not save your choice.') }
        finally { setBusy(false) }
      }}>Enable clinic access</button></div>}
      {error && <button type="button" className="underline" onClick={() => { setError(''); setRevision(value => value + 1) }}>Retry</button>}
      <Link to="/support" className="block text-sm font-semibold text-teal-700 underline">Request admin access</Link>
      {denied && <Link to="/hub/dashboard" className="block text-sm underline">Back to my businesses</Link>}
    </section>
  </main>
}
