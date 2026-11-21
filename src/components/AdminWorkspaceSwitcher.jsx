import { ShieldCheck, Building2, Stethoscope, Users } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import '../styles/admin-switcher.css'

const destinations = [
  { id: 'admin', label: 'Admin dashboard', icon: ShieldCheck, path: '/admin' },
  { id: 'business', label: 'Business dashboard', icon: Building2, path: '/hub/dashboard' },
  { id: 'doctor', label: 'Doctor dashboard', icon: Stethoscope, path: '/doctor/dashboard' },
  { id: 'customer', label: 'Customer dashboard', icon: Users, path: '/customers?category=clinic' },
]

export default function AdminWorkspaceSwitcher({ onNavigate }) {
  const navigate = useNavigate()
  const { user, setUser } = useAuth()
  const { pathname } = useLocation()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const active = pathname.startsWith('/admin') ? 'admin'
    : /^\/(business|hub|subscription)(\/|$)/.test(pathname) ? 'business'
    : pathname.startsWith('/doctor') ? 'doctor' : 'customer'

  async function open(destination) {
    setError('')
    setBusy(destination.id)
    try {
      if (destination.id !== 'admin') {
        const { data } = await api.post('/admin/workspace')
        setUser(previous => previous?._id === data.data.user._id ? data.data.user : previous)
      }
      navigate(destination.path)
      onNavigate?.()
    } catch (failure) {
      setError(failure.response?.data?.message || 'Could not prepare your workspace. Please retry.')
    } finally { setBusy('') }
  }

  if (user?.role !== 'admin') return null

  return <section className="admin-switcher" aria-label="Super admin dashboards">
    <p className="admin-switcher-label">Dashboards</p>
    <nav aria-label="Switch dashboard">
      {destinations.map(destination => {
        const Icon = destination.icon
        return <button key={destination.id} type="button"
          disabled={Boolean(busy)} aria-current={active === destination.id ? 'page' : undefined}
          onClick={() => open(destination)}>
          <Icon size={16} aria-hidden="true" />
          {busy === destination.id ? 'Opening…' : destination.label}
        </button>
      })}
    </nav>
    {error && <p role="alert" className="admin-switcher-error">{error}</p>}
  </section>
}
