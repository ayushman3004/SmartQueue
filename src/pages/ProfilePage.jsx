import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast, Toaster } from 'react-hot-toast'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    location: user?.location || '',
    avatar: user?.avatar || ''
  })

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        bio: user.bio || '',
        location: user.location || '',
        avatar: user.avatar || ''
      })
    }
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.patch('/auth/me', form)
      if (res.data.success) {
        setUser(res.data.data.user)
        toast.success("Profile updated successfully!", {
          style: { borderRadius: '16px', background: '#111', color: '#fff', border: '1px solid #06b6d4' }
        })
        setEditing(false)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-4xl px-4 sm:px-6">
      <Toaster />
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass overflow-hidden rounded-[3rem] shadow-2xl"
      >
        {/* Profile Header Background */}
        <div className="h-48 relative overflow-hidden bg-linear-to-br from-cyan-900/40 via-blue-900/20 to-neutral-900">
           <div className="absolute inset-0 bg-white/[0.02] grid-pattern pointer-events-none" />
           <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px]" />
           <div className="absolute top-10 left-10">
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-500 mb-2 block">User Environment</span>
             <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">My Account</h1>
           </div>
        </div>

        <div className="p-8 md:p-12 relative">
          {/* Avatar Section */}
          <div className="absolute -top-16 left-12 group">
            <div className="relative">
              {form.avatar ? (
                <img src={form.avatar} className="w-32 h-32 rounded-3xl object-cover border-4 border-[#080B0F] shadow-2xl" alt="Avatar" />
              ) : (
                <div className="w-32 h-32 rounded-3xl flex items-center justify-center text-4xl font-black text-black bg-linear-to-br from-cyan-400 to-blue-500 border-4 border-[#080B0F] shadow-2xl">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
              )}
              {editing && (
                 <div className="absolute inset-0 bg-black/60 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white">Change Ph</span>
                 </div>
              )}
            </div>
          </div>

          <div className="mt-20 space-y-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{user?.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">{user?.role} ACCOUNT</span>
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">ID: {user?._id?.slice(-8)}</span>
                </div>
              </div>
              <button 
                onClick={() => setEditing(!editing)}
                className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 ${
                  editing ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'btn-primary'
                }`}
              >
                {editing ? 'Discard Changes' : '🛠️ Edit Profile'}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6 md:col-span-1">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Full Name</label>
                  <input readOnly={!editing} className="input text-sm font-bold" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Email Terminal</label>
                  <input readOnly={true} className="input text-sm font-bold opacity-50 cursor-not-allowed" value={form.email} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Phone Link</label>
                  <input readOnly={!editing} className="input text-sm font-bold" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
              </div>

              <div className="space-y-6 md:col-span-1">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Current Sector (Location)</label>
                  <input readOnly={!editing} className="input text-sm font-bold" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                </div>
                 <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Avatar Link (URL)</label>
                  <input readOnly={!editing} className="input text-sm font-bold" value={form.avatar} onChange={e => setForm({...form, avatar: e.target.value})} placeholder="https://image-url.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Bio (Manifesto)</label>
                  <textarea readOnly={!editing} className="input text-sm font-bold min-h-[100px] py-4" value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} />
                </div>
              </div>

              {editing && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="md:col-span-2 pt-6">
                  <button type="submit" disabled={loading} className="w-full py-6 rounded-[2rem] bg-linear-to-r from-cyan-400 via-blue-500 to-indigo-600 text-black font-black uppercase tracking-[0.3em] text-xs shadow-2xl active:scale-95 transition-all relative overflow-hidden group">
                    <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span className="relative z-10">{loading ? 'Synchronizing Genesis...' : '💾 Commmit Global Changes'}</span>
                  </button>
                </motion.div>
              )}
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
