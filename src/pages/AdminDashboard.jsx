import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import axios from '../api/axios'

const StatCard = ({ icon, label, value, color }) => (
  <div className="bg-white border border-zinc-200 p-8 rounded-[2rem] flex items-center justify-between group overflow-hidden relative shadow-lg hover:shadow-xl transition-all">
    <div className="absolute -top-10 -right-10 w-32 h-32 blur-[40px] opacity-10 group-hover:opacity-30 transition-all rounded-full" style={{ background: color }} />
    <div className="space-y-2 relative z-10">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <div className="text-4xl font-black text-zinc-950 italic tracking-tighter leading-none">{value}</div>
    </div>
    <div className="text-4xl p-5 bg-slate-50 rounded-3xl group-hover:bg-white transition-colors shadow-inner border border-zinc-50 relative z-10" style={{ color: color }}>
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
    <div className="container py-16 space-y-12 max-w-7xl animate-pulse">
      <div className="h-16 w-1/3 bg-slate-100 rounded-3xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="h-40 bg-slate-100 rounded-3xl" />
        <div className="h-40 bg-slate-100 rounded-3xl" />
        <div className="h-40 bg-slate-100 rounded-3xl" />
      </div>
    </div>
  )

  if (!data) return (
    <div className="container py-20 text-center text-slate-400">
      <p className="text-sm font-bold uppercase tracking-widest">Protocol Failure: Unable to load dashboard data.</p>
    </div>
  )

  return (
    <div className="container py-12 space-y-12 max-w-7xl px-4 sm:px-6">
      <div className="flex items-end justify-between border-b border-zinc-100 pb-8">
        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-teal-600">Enterprise Protocol</span>
          <h1 className="text-5xl font-black tracking-tighter text-zinc-950 uppercase italic leading-none">Global <span className="text-teal-600">Control</span> Hub</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard icon="👤" label="Active Nodes" value={data?.stats?.users || 0} color="#0d9488" />
        <StatCard icon="🏢" label="Registered Hubs" value={data?.stats?.businesses || 0} color="#4f46e5" />
        <StatCard icon="📅" label="Live Transactions" value={data?.stats?.bookings || 0} color="#059669" />
      </div>

      <div className="grid lg:grid-cols-2 gap-10">
        <div className="bg-white border border-zinc-200 p-10 rounded-[3rem] shadow-2xl space-y-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50/50 rounded-full blur-[80px] pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <h2 className="text-xl font-black uppercase italic tracking-tighter text-zinc-950">Recent Domain Assignments</h2>
          </div>
          <div className="space-y-4 relative z-10">
            {(data?.recent?.businesses || []).map(b => (
              <div key={b._id} className="p-5 rounded-3xl bg-slate-50 border border-zinc-100 flex items-center justify-between group hover:bg-white hover:border-zinc-200 transition-all shadow-xs">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center font-black text-xs text-teal-600 shadow-sm group-hover:scale-110 transition-transform">
                    {b.name[0]}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-zinc-950 transition-colors uppercase italic tracking-tight">{b.name}</h4>
                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-400 mt-1">Host Node: {b.owner?.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => toggleBusiness(b._id)}
                  className={`px-6 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all shadow-xs border ${
                    b.isActive 
                      ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-600 hover:text-white' 
                      : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white'
                  }`}
                >
                  {b.isActive ? 'Suspend' : 'Authorize'}
                </button>
              </div>
            ))}
            {(!data?.recent?.businesses?.length) && <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic py-8 text-center border border-dashed border-zinc-100 rounded-2xl">No recent hub nodes.</p>}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 p-10 rounded-[3rem] shadow-2xl space-y-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50/50 rounded-full blur-[80px] pointer-events-none" />
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-zinc-950 relative z-10">System Transaction Log</h2>
          <div className="space-y-4 relative z-10">
            {(data?.recent?.bookings || []).map(book => (
              <div key={book._id} className="p-5 rounded-3xl bg-slate-50 border border-zinc-100 flex items-center gap-5 hover:bg-white hover:border-zinc-200 transition-all shadow-xs group">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center text-lg shadow-inner group-hover:scale-110 transition-transform">📅</div>
                <div>
                  <h4 className="text-sm font-black text-zinc-950 uppercase italic tracking-tight">Signal: New Node Entry</h4>
                  <p className="text-[9px] uppercase font-black tracking-widest text-slate-400 mt-1">Request by {book.userId?.name} — {new Date(book.startTime).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</p>
                </div>
              </div>
            ))}
            {(!data?.recent?.bookings?.length) && <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic py-8 text-center border border-dashed border-zinc-100 rounded-2xl">Log is currently clear.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

