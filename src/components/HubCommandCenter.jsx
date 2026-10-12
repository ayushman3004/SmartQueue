import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { getMyBusinesses } from '../api/business.api'
import { toast } from 'react-hot-toast'
import RegisterHubModal from './RegisterHubModal'
import ManageServicesModal from './ManageServicesModal'
import { CATEGORY_METADATA } from '../utils/servicePresets'

export default function HubCommandCenter() {
  const { user } = useAuth()
  const { onBusinessStatus } = useSocket()
  const navigate = useNavigate()

  const [myBusinesses, setMyBusinesses] = useState([])
  const [fetchingHubs, setFetchingHubs] = useState(true)
  const [registerHubOpen, setRegisterHubOpen] = useState(false)
  const [manageServicesBiz, setManageServicesBiz] = useState(null)

  const loadHubs = useCallback(async () => {
    setFetchingHubs(true)
    try {
      const res = await getMyBusinesses()
      setMyBusinesses(res.data.data.businesses || [])
    } catch (err) {
      console.error('Failed to load hubs:', err)
    } finally {
      setFetchingHubs(false)
    }
  }, [])

  useEffect(() => {
    loadHubs()
  }, [loadHubs])

  // Real-time status sync for hubs
  useEffect(() => {
    const unsub = onBusinessStatus?.((data) => {
      setMyBusinesses((prev) =>
        prev.map((b) =>
          b._id === data.businessId
            ? { ...b, isOpen: data.isOpen, isActive: data.isActive }
            : b
        )
      )
    })
    return () => unsub?.()
  }, [onBusinessStatus])

  return (
    <div className="min-h-screen bg-[#07090e] text-white p-4 sm:p-6 lg:p-10 relative">
      {/* Ambient background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-teal-500/8 blur-[160px] pointer-events-none -z-10" />

      <div className="container mx-auto max-w-6xl space-y-8 pt-4 pb-16">
        {/* Top Bar Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6 text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-teal-400">
                Business Operations Console
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">
                serveq.tech/business
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Hub Command Center
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-medium">
              Signed in as <span className="text-white font-bold">{user?.name}</span> ({user?.email}) &bull; Hub Owner
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRegisterHubOpen(true)}
              className="btn-island py-3 px-5 text-xs bg-teal-500 hover:bg-teal-400 text-zinc-950 font-black tracking-wider uppercase shadow-xl shadow-teal-500/20 flex items-center gap-2"
            >
              <span>+ Register New Hub</span>
              <span className="btn-bubble bg-zinc-950 text-teal-400">🏢</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <span>Active Hubs</span>
              <span>🏢</span>
            </div>
            <div className="text-3xl font-black text-white">{myBusinesses.length}</div>
            <p className="text-[11px] text-zinc-500">Registered venue locations</p>
          </div>

          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <span>Live Open Status</span>
              <span>⚡</span>
            </div>
            <div className="text-3xl font-black text-teal-400">
              {myBusinesses.filter((b) => b.isOpen).length} / {myBusinesses.length}
            </div>
            <p className="text-[11px] text-zinc-500">Currently accepting queue entries</p>
          </div>

          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <span>Catalog Services</span>
              <span>📋</span>
            </div>
            <div className="text-3xl font-black text-indigo-400">
              {myBusinesses.reduce((acc, b) => acc + (b.services?.length || 0), 0)}
            </div>
            <p className="text-[11px] text-zinc-500">Configured offerings & pricing</p>
          </div>
        </div>

        {/* Hubs Listing */}
        <div className="space-y-4 text-left">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Your Operational Hubs</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-extrabold border border-teal-500/30">
                {myBusinesses.length}
              </span>
            </h2>
          </div>

          {fetchingHubs ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Loading Hub Nodes...</p>
            </div>
          ) : myBusinesses.length === 0 ? (
            <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl p-10 sm:p-14 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-3xl mx-auto">
                🏢
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-xl font-black text-white tracking-tight">No Hubs Registered Yet</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You are verified as a Hub Owner on serveq.tech! Create your first business hub to define your catalog of services, customize session durations and pricing, and launch your live queue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRegisterHubOpen(true)}
                className="px-6 py-3 rounded-full bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-teal-500/20 active:scale-95 transition-all inline-flex items-center gap-2"
              >
                <span>+ Deploy Your First Hub</span>
                <span>✨</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myBusinesses.map((b) => (
                <div
                  key={b._id}
                  className="bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 rounded-3xl p-6 flex flex-col justify-between transition-all group hover:shadow-xl hover:shadow-teal-500/5"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-2xl shadow-sm">
                        {CATEGORY_METADATA[b.category]?.icon || '🏢'}
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          b.isOpen
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {b.isOpen ? '● LIVE QUEUE' : '○ CLOSED'}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black text-white tracking-tight group-hover:text-teal-300 transition-colors">
                        {b.name}
                      </h3>
                      <p className="text-xs text-zinc-400 line-clamp-2 mt-1">
                        {b.description || 'Enterprise queue operational hub'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-semibold">{b.location || b.address || 'Urban Hub'}</span>
                      <span className="font-bold text-zinc-300">{b.services?.length || 0} services</span>
                    </div>
                  </div>

                  <div className="pt-6 space-y-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/business/${b._id}/manage`)}
                      className="w-full py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-md shadow-teal-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <span>Launch Operations Console</span>
                      <span>→</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setManageServicesBiz(b)}
                        className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-[11px] uppercase tracking-wider transition-colors"
                      >
                        Services ({b.services?.length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/queue/${b._id}`)}
                        className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-[11px] uppercase tracking-wider transition-colors"
                      >
                        Queue View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals for Hub Registration and Service Management */}
      <RegisterHubModal
        isOpen={registerHubOpen}
        onClose={() => setRegisterHubOpen(false)}
        onCreated={(newBiz) => {
          setMyBusinesses((prev) => [newBiz, ...prev])
          setRegisterHubOpen(false)
          toast.success(`Hub "${newBiz.name}" deployed successfully!`)
        }}
      />

      <ManageServicesModal
        isOpen={Boolean(manageServicesBiz)}
        business={manageServicesBiz}
        onClose={() => setManageServicesBiz(null)}
        onUpdated={(updatedBiz) => {
          setMyBusinesses((prev) =>
            prev.map((b) => (b._id === updatedBiz._id ? updatedBiz : b))
          )
          setManageServicesBiz(null)
          toast.success('Services updated successfully!')
        }}
      />
    </div>
  )
}
