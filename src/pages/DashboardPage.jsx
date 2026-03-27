import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAllBusinesses, createBusiness, getMyBusinesses } from '../api/business.api'
import BusinessCard from '../components/BusinessCard'
import { getGreeting } from '../utils/helpers'

const CATEGORIES = ['healthcare', 'banking', 'retail', 'restaurant', 'government', 'other']

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState([])
  const [myBusinesses, setMyBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', category: 'other', averageServiceTime: 10 })
  const [creating, setCreating] = useState(false)

  const isOwner = user?.role === 'owner'

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allRes = await getAllBusinesses()
        setBusinesses(allRes.data.data.businesses)

        if (isOwner) {
          const myRes = await getMyBusinesses()
          setMyBusinesses(myRes.data.data.businesses)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [isOwner])

  const filtered = businesses.filter(b => {
    // Exclude owner's own businesses from general search to avoid duplicates
    const isMine = myBusinesses.some(mb => mb._id === b._id)
    if (isMine) return false

    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
                         b.category.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'all' || b.category === category
    return matchesSearch && matchesCategory
  })

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await createBusiness({ ...form, averageServiceTime: Number(form.averageServiceTime) })
      const newBiz = res.data.data.business
      setBusinesses(prev => [newBiz, ...prev])
      setMyBusinesses(prev => [newBiz, ...prev])
      setShowCreate(false)
      setForm({ name: '', description: '', category: 'other', averageServiceTime: 10 })
      navigate(`/business/${newBiz._id}/manage`)
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="container py-8 max-w-7xl">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 relative"
      >
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-[2px] bg-cyan-500 rounded-full" />
              <p className="text-[10px] font-black tracking-[0.3em] text-cyan-500 uppercase">
                Smart Queue Dashboard
              </p>
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white mb-4 tracking-tight">
              Good {getGreeting()}, <br />
              <span className="bg-linear-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                {user?.name?.split(' ')[0]}
              </span>
            </h1>
            <p className="text-neutral-400 text-lg max-w-xl leading-relaxed">
              {isOwner
                ? 'Your business operations at a glance. Manage queues and serve customers in real-time.'
                : 'Discover businesses, join queues, and skip the wait with AI-powered slot management.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
             {isOwner && (
              <button
                onClick={() => setShowCreate(v => !v)}
                className="btn-primary"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Launch New Business
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Owner: My Businesses Grid */}
      {isOwner && myBusinesses.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-black text-white">Your Managed Hubs</h2>
            <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none">
              {myBusinesses.length} Active
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {myBusinesses.map((b, i) => (
              <motion.div
                key={b._id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -5, scale: 1.02 }}
                onClick={() => navigate(`/business/${b._id}/manage`)}
                className="glass-bright cursor-pointer p-6 relative group overflow-hidden"
                style={{ border: '1px solid rgba(6,182,212,0.2)' }}
              >
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-cyan-500/5 rounded-full blur-3xl group-hover:bg-cyan-500/10 transition-colors" />
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl border border-white/10 group-hover:border-cyan-500/30 transition-colors">
                    🏢
                  </div>
                  <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${b.isOpen ? 'bg-cyan-500/10 text-cyan-500' : 'bg-red-500/10 text-red-500'}`}>
                    {b.isOpen ? 'Live' : 'Paused'}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white group-hover:text-cyan-400 transition-colors mb-2">{b.name}</h3>
                <p className="text-neutral-500 text-xs font-medium uppercase tracking-wider mb-6">{b.category} · {b.averageServiceTime}m avg</p>
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Manage Hub →</span>
                  <div className="flex -space-x-2">
                    {[1,2,3].map(j => <div key={j} className="w-6 h-6 rounded-full border-2 border-neutral-900 bg-neutral-800" />)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Main Exploration Section */}
      <section className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="relative flex-1 max-w-2xl">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all shadow-inner"
              placeholder="Search for clinics, banks, salons..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['all', ...CATEGORIES].map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border uppercase tracking-widest ${
                  category === c 
                    ? 'bg-white text-black border-white shadow-lg' 
                    : 'bg-white/5 text-neutral-500 border-white/5 hover:border-white/20 hover:text-white'
                }`}
              >
                {c === 'all' ? 'Everywhere' : c}
              </button>
            ))}
          </div>
        </div>

        {/* Create Business Modal/Form Overlay */}
        <AnimatePresence>
          {isOwner && showCreate && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            >
              <motion.div className="glass-bright p-10 max-w-2xl w-full relative">
                <button onClick={() => setShowCreate(false)} className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="mb-8 text-center">
                  <h2 className="text-3xl font-black text-white mb-2">Grow Your Business</h2>
                  <p className="text-neutral-400 text-sm">Join the network and start managing your customer flow better.</p>
                </div>
                <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block">Business Identity</label>
                    <input className="input !bg-black/40 !py-4" placeholder="e.g. Neo Health Center" value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block">Category</label>
                    <select className="input !bg-black/40 !py-4" value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c} value={c} className="bg-neutral-900">{c.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block">Avg Wait (min)</label>
                    <input className="input !bg-black/40 !py-4" type="number" min={1} value={form.averageServiceTime}
                      onChange={e => setForm(f => ({ ...f, averageServiceTime: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <button type="submit" className="w-full py-5 rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 text-black font-black text-lg shadow-xl shadow-cyan-500/20" disabled={creating}>
                      {creating ? 'Processing...' : 'Register Business Hub'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-3 mb-8">
          <h2 className="text-2xl font-black text-white">Explore Hubs</h2>
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
        </div>

        {/* Business Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 rounded-3xl shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 bg-white/5 rounded-3xl border border-dashed border-white/10">
            <p className="text-6xl mb-6 opacity-30">🔍</p>
            <h3 className="text-xl font-black text-white mb-2">No Matching Hubs</h3>
            <p className="text-neutral-500 text-sm">We couldn't find any businesses matching your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((b, i) => (
              <BusinessCard key={b._id} business={b} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
