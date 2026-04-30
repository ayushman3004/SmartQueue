import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getAllBusinesses, createBusiness, getMyBusinesses } from '../api/business.api'
import BusinessCard from '../components/BusinessCard'
import { getGreeting } from '../utils/helpers'

const CATEGORIES = ['healthcare', 'banking', 'retail', 'salon', 'restaurant', 'government', 'other']


export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState([])
  const [myBusinesses, setMyBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', category: 'other', averageServiceTime: 10, basePrice: 0, pricing: [], services: [{ name: 'General Consultation', duration: 15, price: 0 }] })
  const [creating, setCreating] = useState(false)

  const isOwner = user?.role === 'owner'
  const { onBusinessStatus } = useSocket()

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
        setTimeout(() => setLoading(false), 800)
      }
    }
    fetchData()

    const unsub = onBusinessStatus((data) => {
      // Business was deactivated by admin — remove from customer list
      if (data.isActive === false) {
        setBusinesses(prev => prev.filter(b => b._id !== data.businessId && b._id !== data.businessId?.toString()));
        setMyBusinesses(prev => prev.map(b => (b._id === data.businessId || b._id === data.businessId?.toString()) ? { ...b, ...data } : b));
        return;
      }

      // Business was reactivated — re-fetch full list so it re-appears
      if (data.isActive === true) {
        getAllBusinesses().then(res => setBusinesses(res.data.data.businesses)).catch(() => {});
        setMyBusinesses(prev => prev.map(b => (b._id === data.businessId || b._id === data.businessId?.toString()) ? { ...b, ...data } : b));
        return;
      }

      // Normal status update (open/closed toggle by owner)
      setBusinesses(prev => {
        // If business closed, remove from customer list (they only see open hubs)
        if (data.isOpen === false) {
          return prev.filter(b => b._id !== data.businessId && b._id !== data.businessId?.toString());
        }
        // If business opened, it may not be in the list — re-fetch
        if (data.isOpen === true) {
          getAllBusinesses().then(res => setBusinesses(res.data.data.businesses)).catch(() => {});
          return prev;
        }
        return prev.map(b => (b._id === data.businessId || b._id === data.businessId?.toString()) ? { ...b, ...data } : b);
      });
      setMyBusinesses(prev => prev.map(b => (b._id === data.businessId || b._id === data.businessId?.toString()) ? { ...b, ...data } : b));
    })
    return () => unsub?.()
  }, [isOwner, onBusinessStatus])

  const filtered = businesses.filter(b => {
    const isMine = myBusinesses.some(mb => mb._id === b._id)
    if (isMine) return false
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase()) || b.category.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'all' || b.category === category
    return matchesSearch && matchesCategory
  })

  return (
    <div className="container space-y-16 md:space-y-24 pt-12">
      {/* Owner Section */}
      {isOwner && myBusinesses.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-8"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-200 pb-6">
            <h2 className="text-3xl font-black text-zinc-950 tracking-tight">Your Infrastructure</h2>
            <div className="flex flex-wrap items-center gap-4">
              <div className="bg-white border border-zinc-200 px-6 py-4 rounded-2xl flex flex-col min-w-[140px] shadow-xs">
                <span className="text-2xl font-black text-zinc-950">{myBusinesses.length}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Active Hubs</span>
              </div>
              <div className="bg-white border border-teal-200 px-6 py-4 rounded-2xl flex flex-col min-w-[140px] shadow-xs bg-teal-50/30">
                <span className="text-2xl font-black text-teal-700">{myBusinesses.reduce((acc, b) => acc + (b.queueLength || 0), 0)}</span>
                <span className="text-[10px] font-bold text-teal-700/60 uppercase tracking-widest mt-1">Total Queue</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {myBusinesses.map((b, i) => (
              <motion.div
                key={b._id}
                whileHover={{ y: -4 }}
                onClick={() => navigate(`/business/${b._id}/manage`)}
                className="bg-white border border-zinc-200 p-8 lg:p-10 rounded-2xl cursor-pointer flex flex-col justify-between min-h-[280px] hover:border-teal-300 transition-all shadow-md group"
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center text-2xl shadow-xs border border-zinc-100">🏢</div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${b.isOpen ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-rose-100 border-rose-200 text-rose-700'} text-xs font-bold`}>
                    <div className={`w-2 h-2 rounded-full ${b.isOpen ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                    {b.isOpen ? 'LIVE' : 'CLOSED'}
                  </div>
                </div>
                <div className="mb-8">
                  <h3 className="text-2xl md:text-3xl font-black text-zinc-950 group-hover:text-teal-700 transition-colors tracking-tight truncate">{b.name}</h3>
                  <div className="flex items-center gap-4 mt-4 text-sm font-bold text-slate-500">
                    <span className="bg-slate-50 border border-zinc-100 px-3 py-1.5 rounded-lg">Queue: <span className="text-zinc-950 ml-1">{b.queueLength || 0}</span></span>
                    <span className="bg-slate-50 border border-zinc-100 px-3 py-1.5 rounded-lg capitalize">{b.category}</span>
                  </div>
                </div>
                <div className="pt-6 border-t border-zinc-100 flex items-center justify-between text-slate-400 group-hover:text-teal-700 transition-colors">
                  <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">Manage Dashboard <span className="text-lg">→</span></span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Exploration Section */}
      {!isOwner && (
        <section id="explore" className="space-y-12 pb-20">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-zinc-200 pb-8">
            <div className="space-y-3 max-w-xl">
              <h2 className="text-3xl md:text-4xl font-black text-zinc-950 tracking-tight">Active Hubs</h2>
              <p className="text-slate-500 font-medium text-sm">Real-time status synchronized via low-latency sockets.</p>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
              <div className="relative w-full md:w-64">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                  className="input pl-11 h-12 rounded-xl" 
                  placeholder="Search hubs..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 custom-scrollbar">
                {['all', ...CATEGORIES].map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-5 h-12 rounded-xl text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
                      category === c ? 'bg-zinc-950 text-white shadow-lg' : 'bg-white text-slate-500 border border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
               [...Array(6)].map((_, i) => (
                <div key={i} className="bg-white border border-zinc-200 p-8 h-[300px] rounded-2xl animate-pulse flex flex-col shadow-xs" />
              ))
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-24 bg-white border border-dashed border-zinc-300 rounded-3xl text-center space-y-4">
                <span className="text-4xl block opacity-40">🔎</span>
                <h3 className="text-xl font-bold text-slate-400 tracking-tight">Zero Hubs Found</h3>
              </div>
            ) : (
              filtered.map((b, i) => <BusinessCard key={b._id} business={b} index={i} />)
            )}
          </div>
        </section>
      )}

      {/* Launch Hub Modal */}
      <AnimatePresence>
        {isOwner && showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/20 backdrop-blur-sm overflow-y-auto">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="bg-white border border-zinc-200 p-8 md:p-10 max-w-2xl w-full rounded-[22px] my-8 relative shadow-2xl">
              <button onClick={() => setShowCreate(false)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-50 border border-zinc-100 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              
              <div className="mb-10 text-left">
                <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600 mb-2 block">Terminal</span>
                <h2 className="text-3xl font-black text-zinc-950 tracking-tight leading-none">Deploy Hub</h2>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                setCreating(true);
                try {
                  const payload = { ...form, averageServiceTime: Number(form.averageServiceTime) }
                  const res = await createBusiness(payload)
                  const newBiz = res.data.data.business
                  setBusinesses(prev => [newBiz, ...prev])
                  setMyBusinesses(prev => [newBiz, ...prev])
                  setShowCreate(false)
                  setForm({ name: '', description: '', category: 'other', averageServiceTime: 10, basePrice: 0, pricing: [], services: [{ name: 'General Consultation', duration: 15, price: 0 }] })
                  navigate(`/business/${newBiz._id}/manage`)
                } catch (err) { alert(err.response?.data?.message || 'Failed') } finally { setCreating(false) }
              }} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 mb-2 block">Hub Identity</label>
                    <input className="input" placeholder="Business Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-2 block">Category</label>
                    <select className="input appearance-none bg-slate-50" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-2 block">Base Rate (₹)</label>
                    <input className="input" type="text" inputMode="numeric" placeholder="0" value={form.basePrice === 0 ? '' : form.basePrice} onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                      setForm({...form, basePrice: v === '' ? 0 : Number(v)});
                    }} />
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100">
                  <label className="text-xs font-bold text-slate-500 mb-4 block">Services & Capacity</label>
                  <div className="space-y-3">
                    {form.services.map((svc, idx) => (
                      <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 items-center">
                        <input className="input" placeholder="Service Name" value={svc.name} onChange={e => {
                          const newSvcs = [...form.services];
                          newSvcs[idx].name = e.target.value;
                          setForm({...form, services: newSvcs});
                        }} required />
                        <input className="input text-center" type="text" inputMode="numeric" placeholder="Mins" value={svc.duration} onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                          const newSvcs = [...form.services];
                          newSvcs[idx].duration = v === '' ? '' : Number(v);
                          setForm({...form, services: newSvcs});
                        }} required />
                        <input className="input text-center" type="text" inputMode="numeric" placeholder="₹ Price" value={svc.price !== undefined && svc.price !== 0 ? svc.price : ''} onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                          const newSvcs = [...form.services];
                          newSvcs[idx].price = v === '' ? 0 : Number(v);
                          setForm({...form, services: newSvcs});
                        }} />
                        {form.services.length > 1 ? (
                          <button type="button" onClick={() => {
                            const newSvcs = form.services.filter((_, i) => i !== idx);
                            setForm({...form, services: newSvcs});
                          }} className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors border border-rose-200">✕</button>
                        ) : <div className="w-10"></div>}
                      </div>
                    ))}
                    <button type="button" onClick={() => setForm({...form, services: [...form.services, {name: '', duration: 15, price: 0}]})} className="text-xs text-teal-600 font-bold hover:text-teal-700 mt-2 block w-fit">+ Add New Service Column</button>
                  </div>
                </div>

                <div className="pt-8">
                  <button type="submit" disabled={creating} className="w-full btn-primary py-4 text-xs">
                    {creating ? 'Deploying Infrastructure...' : 'Launch Hub Instance'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
