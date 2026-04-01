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
      setBusinesses(prev => {
        const isDeactivated = data.isActive === false || data.isOpen === false;
        if (isDeactivated) {
          return prev.filter(b => b._id !== data.businessId && b._id !== data.businessId?.toString());
        }
        return prev.map(b => (b._id === data.businessId || b._id === data.businessId?.toString()) ? { ...b, ...data } : b);
      });
      setMyBusinesses(prev => prev.map(b => (b._id === data.businessId || b._id === data.businessId?.toString()) ? { ...b, ...data } : b))
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
    <div className="container space-y-24 md:space-y-32">
      {/* Hero Section */}
      <section className="relative pt-12 md:pt-20">
        <div className="absolute -top-32 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-0 -right-32 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />
        
        <div className="flex flex-col items-center justify-center text-center space-y-8 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-6 py-2 rounded-full glass border-white/5 text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400"
          >
            Empowered by SmartQueue AI
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-8xl font-black text-white tracking-tighter leading-[0.9]"
          >
            The Future of <br />
            <span className="gradient-text">Efficient Queuing</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-base md:text-xl text-neutral-400 font-medium leading-relaxed max-w-2xl px-4"
          >
            {isOwner 
              ? `Good ${getGreeting()}, owner. Ready to manage your digital hubs today? Your queue operations are live and ready.`
              : `Don't waste time in line. Our AI-powered smart queuing system estimates wait times and secures your slot in seconds.`}
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 pt-4"
          >
            {!isOwner && (
              <button 
                onClick={() => document.getElementById('explore').scrollIntoView({ behavior: 'smooth' })}
                className="btn-primary py-5 px-10 text-xs w-full sm:w-auto"
              >
                🚀 Explore Hubs
              </button>
            )}
            {isOwner && (
              <button 
                onClick={() => setShowCreate(true)}
                className="btn-primary py-5 px-10 text-xs w-full sm:w-auto"
              >
                + Launch New Hub
              </button>
            )}
          </motion.div>
        </div>
      </section>

      {/* Owner Section */}
      {isOwner && myBusinesses.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-10"
        >
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase italic">Your Centers</h2>
            <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {myBusinesses.map((b, i) => (
              <motion.div
                key={b._id}
                whileHover={{ y: -5 }}
                onClick={() => navigate(`/business/${b._id}/manage`)}
                className="glass p-12 lg:p-16 rounded-[3rem] cursor-pointer group flex flex-col justify-between shadow-2xl min-h-[350px] border-white/5 hover:border-cyan-500/20"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl grayscale group-hover:grayscale-0 transition-all shadow-xl">🏢</div>
                  <div className={`w-3.5 h-3.5 rounded-full ${b.isOpen ? 'bg-emerald-500 shadow-[0_0_15px_1px_#10b981]' : 'bg-rose-500 shadow-[0_0_15px_1px_#f43f5e]'}`} />
                </div>
                <div className="mb-8">
                  <h3 className="text-3xl md:text-5xl font-black text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tighter truncate">{b.name}</h3>
                  <p className="text-xs md:text-sm font-black tracking-[0.4em] text-neutral-500 uppercase mt-4">Live Queue: <span className="text-white">{b.queueLength || 0}</span></p>
                </div>
                <div className="pt-8 border-t border-white/10 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">Manage Dashboard →</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Exploration Section */}
      {!isOwner && (
        <section id="explore" className="space-y-16 pb-20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12">
          <div className="space-y-4 max-w-xl">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase leading-[0.8] italic">Explore <br /> <span className="gradient-text italic">Live Hubs</span></h2>
            <p className="text-neutral-500 font-medium text-sm">Real-time status synchronized via AI prediction models.</p>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4 flex-1 lg:max-w-3xl">
            <div className="relative w-full group">
              <svg className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-cyan-500 transition-colors" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input 
                className="w-full h-16 bg-white/[0.03] border border-white/5 rounded-2xl pl-14 pr-6 text-sm text-white focus:outline-none focus:border-cyan-500/30 transition-all placeholder:text-neutral-700" 
                placeholder="Find Hubs..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-4 w-full md:w-auto custom-scrollbar">
              {['all', ...CATEGORIES].map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-6 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    category === c ? 'bg-white text-black shadow-2xl' : 'glass text-neutral-500 hover:text-white border-white/5'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
             [...Array(6)].map((_, i) => (
              <div key={i} className="glass p-10 h-[400px] rounded-[2.5rem] animate-pulse relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-br from-white/[0.02] to-transparent" />
                <div className="w-20 h-20 rounded-3xl bg-white/5 mb-8" />
                <div className="w-2/3 h-5 bg-white/5 rounded-full mb-4" />
                <div className="w-1/3 h-2 bg-white/5 rounded-full mb-10" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-32 glass rounded-[3rem] text-center space-y-6">
              <span className="text-6xl block mb-4 opacity-20">🔎</span>
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Zero Hubs Found</h3>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6 bg-black/95 backdrop-blur-2xl overflow-y-auto">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="glass p-8 md:p-12 max-w-3xl w-full relative rounded-[3rem] border-white/10 my-8">
              <button onClick={() => setShowCreate(false)} className="absolute top-6 right-6 md:top-10 md:right-10 w-12 h-12 rounded-full glass border-white/5 flex items-center justify-center text-neutral-400 hover:text-white transition-all"><svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              
              <div className="mb-12 text-left">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-500 mb-2 block">Registration Terminal</span>
                <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase leading-[0.8] italic">Launch Hub</h2>
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
              }} className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                <div className="md:col-span-2"><label className="text-[10px] font-black uppercase text-neutral-500 mb-3 block tracking-widest ml-1">Identity</label>
                  <input className="input h-16 text-lg font-bold" placeholder="Hub Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div><label className="text-[10px] font-black uppercase text-neutral-500 mb-3 block tracking-widest ml-1">Category</label>
                  <select className="input h-16 appearance-none" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c} value={c} className="bg-neutral-900">{c.toUpperCase()}</option>)}
                  </select>
                </div>
                <div><label className="text-[10px] font-black uppercase text-neutral-500 mb-3 block tracking-widest ml-1">Base Price (₹)</label>
                  <input className="input h-16 text-lg font-bold" type="text" inputMode="numeric" placeholder="0" value={form.basePrice === 0 ? '' : form.basePrice} onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                    setForm({...form, basePrice: v === '' ? 0 : Number(v)});
                  }} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-neutral-500 mb-3 block tracking-widest ml-1">Services</label>
                  <div className="space-y-2">
                    {form.services.map((svc, idx) => (
                      <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
                        <input className="input h-14 text-sm font-bold" placeholder="Service Name (e.g. Haircut)" value={svc.name} onChange={e => {
                          const newSvcs = [...form.services];
                          newSvcs[idx].name = e.target.value;
                          setForm({...form, services: newSvcs});
                        }} required />
                        <input className="input h-14 text-sm font-bold text-center px-1" type="text" inputMode="numeric" placeholder="Mins" value={svc.duration} onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                          const newSvcs = [...form.services];
                          newSvcs[idx].duration = v === '' ? '' : Number(v);
                          setForm({...form, services: newSvcs});
                        }} required />
                        <input className="input h-14 text-sm font-bold text-center px-1" type="text" inputMode="numeric" placeholder="₹ Price" value={svc.price !== undefined && svc.price !== 0 ? svc.price : ''} onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                          const newSvcs = [...form.services];
                          newSvcs[idx].price = v === '' ? 0 : Number(v);
                          setForm({...form, services: newSvcs});
                        }} />
                        {form.services.length > 1 ? (
                          <button type="button" onClick={() => {
                            const newSvcs = form.services.filter((_, i) => i !== idx);
                            setForm({...form, services: newSvcs});
                          }} className="w-12 h-14 rounded-2xl bg-rose-500/10 text-rose-500 font-bold hover:bg-rose-500/20 transition-colors flex items-center justify-center border border-rose-500/20">✕</button>
                        ) : <div className="w-12 h-14"></div>}
                      </div>
                    ))}
                    <button type="button" onClick={() => setForm({...form, services: [...form.services, {name: '', duration: 15, price: 0}]})} className="text-[10px] text-cyan-500 font-black uppercase tracking-widest mt-4 px-2 hover:text-cyan-400 block">+ Add Another Service</button>
                  </div>
                </div>
                <div className="md:col-span-2 pt-6">
                  <button type="submit" disabled={creating} className="w-full py-7 rounded-[2rem] bg-linear-to-r from-cyan-400 via-blue-500 to-indigo-600 text-black font-black uppercase tracking-[0.3em] text-xs shadow-2xl shadow-cyan-500/20 active:scale-95 transition-all overflow-hidden relative group">
                    <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span className="relative z-10 font-black">{creating ? 'Initializing...' : 'Launch Hub Now'}</span>
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
