import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import axios from '../api/axios'

const StatCard = ({ icon, label, value, color }) => (
  <div className="glass p-6 flex items-center justify-between group overflow-hidden relative">
    <div className="absolute -top-10 -right-10 w-32 h-32 blur-[40px] opacity-10 group-hover:opacity-20 transition-all rounded-full" style={{ background: color }} />
    <div className="space-y-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      <div className="text-3xl font-black text-white">{value}</div>
    </div>
    <div className="text-3xl p-4 bg-white/5 rounded-2xl group-hover:bg-white/10 transition-colors shadow-inner" style={{ color: color }}>
      {icon}
    </div>
  </div>
)

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await axios.get('/admin/stats')
      setData(res.data.data)
    } catch (err) {
      toast.error("Failed to fetch admin stats")
    } finally {
      setLoading(false)
    }
  }

  const toggleBusiness = async (id) => {
    try {
      const res = await axios.patch(`/admin/business/${id}/toggle`)
      toast.success(res.data.message)
      fetchStats()
    } catch (err) {
      toast.error("Moderate action failed")
    }
  }

  if (loading) return (
    <div className="container py-12 space-y-12 max-w-7xl animate-pulse">
      <div className="h-16 w-1/3 bg-white/5 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="h-32 bg-white/5 rounded-2xl" />
        <div className="h-32 bg-white/5 rounded-2xl" />
        <div className="h-32 bg-white/5 rounded-2xl" />
      </div>
    </div>
  )

  if (!data) return (
    <div className="container py-12 text-center text-neutral-500">
      <p>Unable to load dashboard data. Please try again later.</p>
    </div>
  )

  return (
    <div className="container py-12 space-y-12 max-w-7xl">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <span className="text-xs font-black uppercase tracking-[0.3em] text-[var(--cyan)]">System Hub</span>
          <h1 className="text-5xl font-black tracking-tighter text-white">Platform <span className="gradient-text">Control</span></h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard icon="👤" label="Platform Users" value={data?.stats?.users || 0} color="var(--cyan)" />
        <StatCard icon="🏢" label="Registered Entities" value={data?.stats?.businesses || 0} color="#7B61FF" />
        <StatCard icon="📅" label="System Bookings" value={data?.stats?.bookings || 0} color="var(--green)" />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="glass p-8 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Recent Entities</h2>
          </div>
          <div className="space-y-4">
            {(data?.recent?.businesses || []).map(b => (
              <div key={b._id} className="p-4 rounded-2xl bg-white/5 flex items-center justify-between group hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center font-black text-xs text-white">
                    {b.name[0]}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white transition-colors group-hover:text-[var(--cyan)]">{b.name}</h4>
                    <p className="text-[10px] uppercase font-black tracking-widest text-[var(--text-muted)]">Owner: {b.owner?.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => toggleBusiness(b._id)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    b.isActive ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500'
                  } hover:text-black`}
                >
                  {b.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
            {(!data?.recent?.businesses?.length) && <p className="text-xs text-neutral-500">No recent entities.</p>}
          </div>
        </div>

        <div className="glass p-8 space-y-8">
          <h2 className="text-xl font-bold tracking-tight">System Events</h2>
          <div className="space-y-4">
            {(data?.recent?.bookings || []).map(book => (
              <div key={book._id} className="p-4 rounded-2xl bg-white/5 flex items-center gap-4 hover:bg-white/10 transition-colors">
                <div className="p-3 bg-[var(--cyan)]/10 text-[var(--cyan)] rounded-xl">📅</div>
                <div>
                  <h4 className="text-sm font-bold text-white">New Booking by {book.userId?.name}</h4>
                  <p className="text-[10px] uppercase font-black tracking-widest text-[var(--text-muted)]">{new Date(book.startTime).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {(!data?.recent?.bookings?.length) && <p className="text-xs text-neutral-500">No recent system events.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

