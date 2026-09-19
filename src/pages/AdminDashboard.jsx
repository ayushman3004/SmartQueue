import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import axios from '../api/axios'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'approved' | 'suspended'

  // Detail Modal State
  const [selectedBusinessDetail, setSelectedBusinessDetail] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchAdminData = async () => {
    try {
      const [statsRes, bizRes] = await Promise.all([
        axios.get('/admin/stats'),
        axios.get('/admin/businesses', { params: { search } }),
      ])
      setStats(statsRes.data.data)
      setBusinesses(bizRes.data.data.businesses || [])
    } catch {
      toast.error('Failed to load admin telemetry')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdminData()
  }, [search])

  const handleModerate = async (id, action) => {
    try {
      const res = await axios.patch(`/admin/business/${id}/moderate`, { action })
      toast.success(res.data.message || `Action ${action} succeeded`)
      fetchAdminData()
      if (selectedBusinessDetail?.business?._id === id) {
        viewBusinessDetails(id)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Moderation action failed')
    }
  }

  const handleDeleteBusiness = async (id) => {
    if (!window.confirm('CRITICAL: This will permanently delete this business, its queues, and appointments. Proceed?')) return
    try {
      await axios.delete(`/admin/business/${id}`)
      toast.success('Business permanently purged')
      setDetailModalOpen(false)
      fetchAdminData()
    } catch {
      toast.error('Failed to delete business')
    }
  }

  const viewBusinessDetails = async (id) => {
    setLoadingDetail(true)
    setDetailModalOpen(true)
    try {
      const res = await axios.get(`/admin/business/${id}`)
      setSelectedBusinessDetail(res.data.data)
    } catch {
      toast.error('Failed to fetch business details')
      setDetailModalOpen(false)
    } finally {
      setLoadingDetail(false)
    }
  }

  const filteredBusinesses = businesses.filter((b) => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'approved') return b.approvalStatus === 'approved' && b.isActive
    if (filterStatus === 'suspended') return b.approvalStatus === 'suspended' || !b.isActive
    return true
  })

  if (loading) return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
      <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="container max-w-7xl py-10 px-4 sm:px-6 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-700">Enterprise Administration</span>
          <h1 className="text-4xl font-black tracking-tight text-zinc-950 uppercase mt-1">
            Global <span className="text-teal-600">Control</span> Hub
          </h1>
        </div>
      </div>

      {/* Global Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Total Users</p>
          <p className="text-3xl font-black text-teal-700 mt-2">{stats?.stats?.users || 0}</p>
          <p className="text-[10px] text-slate-400 mt-1">Platform Accounts</p>
        </div>

        <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Registered Hubs</p>
          <p className="text-3xl font-black text-indigo-700 mt-2">{stats?.stats?.businesses || 0}</p>
          <p className="text-[10px] text-slate-400 mt-1">Active Venues</p>
        </div>

        <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Total Bookings</p>
          <p className="text-3xl font-black text-zinc-950 mt-2">{stats?.stats?.bookings || 0}</p>
          <p className="text-[10px] text-slate-400 mt-1">Appointments Created</p>
        </div>

        <div className="bg-white border border-zinc-200 p-6 rounded-3xl shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Platform Revenue</p>
          <p className="text-3xl font-black text-emerald-600 mt-2">₹{stats?.stats?.revenue || 0}</p>
          <p className="text-[10px] text-slate-400 mt-1">Completed Transactions</p>
        </div>
      </div>

      {/* Business Management Section */}
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden space-y-6 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div>
            <h2 className="text-xl font-black text-zinc-950">Businesses & Hub Directory</h2>
            <p className="text-xs text-slate-500">Monitor queue lengths, view revenue, approve, suspend, or delete venues.</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search business..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 rounded-xl border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {['all', 'approved', 'suspended'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                    filterStatus === st ? 'bg-white shadow-xs text-zinc-900' : 'text-slate-500 hover:text-zinc-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredBusinesses.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            No businesses found matching this query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-zinc-100">
                <tr>
                  <th className="py-3.5 px-4">Business</th>
                  <th className="py-3.5 px-4">Owner</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Queue / Bookings</th>
                  <th className="py-3.5 px-4">Revenue</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredBusinesses.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4">
                      <p className="font-bold text-zinc-900 text-sm">{b.name}</p>
                      <p className="text-[10px] text-slate-400 capitalize">{b.category} Hub</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-medium text-zinc-800">{b.owner?.name || 'Owner'}</p>
                      <p className="text-[10px] text-slate-400">{b.owner?.email}</p>
                      {b.owner?.phone && <p className="text-[10px] text-slate-400">{b.owner?.phone}</p>}
                    </td>
                    <td className="py-4 px-4 text-slate-600">
                      <p className="font-medium">{b.location || b.address || 'Not specified'}</p>
                    </td>
                    <td className="py-4 px-4 font-semibold">
                      <span className="text-teal-700">{b.queueLength || 0} in queue</span>
                      <span className="text-slate-400 text-[10px] block">{b.bookingCount || 0} bookings</span>
                    </td>
                    <td className="py-4 px-4 font-black text-zinc-950">
                      ₹{b.revenue || 0}
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase block w-fit ${
                          b.approvalStatus === 'approved' && b.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {b.approvalStatus || (b.isActive ? 'approved' : 'suspended')}
                        </span>
                        <span className={`text-[9px] font-bold block ${b.isOpen ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {b.isOpen ? '● Open' : '○ Closed'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => viewBusinessDetails(b._id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold"
                      >
                        Details
                      </button>
                      {b.isActive && b.approvalStatus === 'approved' ? (
                        <button
                          onClick={() => handleModerate(b._id, 'suspend')}
                          className="px-3 py-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleModerate(b._id, 'approve')}
                          className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => handleModerate(b._id, b.isOpen ? 'close' : 'open')}
                        className="px-3 py-1.5 bg-slate-50 border border-zinc-200 hover:bg-white text-slate-700 rounded-lg text-xs font-bold"
                      >
                        {b.isOpen ? 'Close' : 'Open'}
                      </button>
                      <button
                        onClick={() => handleDeleteBusiness(b._id)}
                        className="px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Business Details Breakdown Modal */}
      <AnimatePresence>
        {detailModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-3xl w-full shadow-2xl border border-zinc-200 space-y-6 max-h-[85vh] overflow-y-auto"
            >
              {loadingDetail ? (
                <div className="py-20 text-center">
                  <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 mt-2 font-bold">Loading venue telemetry...</p>
                </div>
              ) : selectedBusinessDetail ? (
                <>
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                    <div>
                      <h2 className="text-2xl font-black text-zinc-950">{selectedBusinessDetail.business?.name}</h2>
                      <p className="text-xs text-slate-400 capitalize">
                        {selectedBusinessDetail.business?.category} Hub • {selectedBusinessDetail.business?.location || 'Location Unspecified'}
                      </p>
                    </div>
                    <button
                      onClick={() => setDetailModalOpen(false)}
                      className="text-slate-400 hover:text-zinc-900 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Top Stats Banner */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-100">
                      <p className="text-xs font-bold uppercase text-teal-800">Total Revenue</p>
                      <p className="text-2xl font-black text-teal-900 mt-1">₹{selectedBusinessDetail.revenue || 0}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-zinc-100">
                      <p className="text-xs font-bold uppercase text-slate-500">Queue Entries</p>
                      <p className="text-2xl font-black text-zinc-900 mt-1">
                        {selectedBusinessDetail.queue?.users?.length || 0} active
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-zinc-100">
                      <p className="text-xs font-bold uppercase text-slate-500">Total Customers</p>
                      <p className="text-2xl font-black text-zinc-900 mt-1">
                        {selectedBusinessDetail.customers?.length || 0} unique
                      </p>
                    </div>
                  </div>

                  {/* Owner Information */}
                  <div className="p-4 rounded-2xl border border-zinc-200 bg-slate-50/50 space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400">Assigned Business Owner</p>
                    <p className="text-sm font-bold text-zinc-900">{selectedBusinessDetail.business?.owner?.name}</p>
                    <p className="text-xs text-slate-500">Email: {selectedBusinessDetail.business?.owner?.email} • Phone: {selectedBusinessDetail.business?.phone || selectedBusinessDetail.business?.owner?.phone || 'N/A'}</p>
                  </div>

                  {/* Current Queue Section */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase text-zinc-950 tracking-wider">Live Queue Entries</h4>
                    {(selectedBusinessDetail.queue?.users || []).length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-xl">No one in the live queue right now.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedBusinessDetail.queue.users.map((u, i) => (
                          <div key={i} className="p-3 rounded-xl bg-slate-50 border border-zinc-200 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-zinc-900">{u.userId?.name || 'Customer'}</p>
                              <p className="text-[10px] text-slate-400">{u.serviceType} ({u.serviceTime} mins)</p>
                            </div>
                            <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-white border border-zinc-200">
                              {u.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Customers Section */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase text-zinc-950 tracking-wider">Recent Registered Customers</h4>
                    <div className="flex flex-wrap gap-2">
                      {(selectedBusinessDetail.customers || []).map((c, i) => (
                        <div key={i} className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium">
                          {c.name} ({c.email})
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Modal Action Controls */}
                  <div className="pt-4 border-t border-zinc-100 flex items-center justify-between gap-3">
                    <button
                      onClick={() => handleDeleteBusiness(selectedBusinessDetail.business?._id)}
                      className="px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold"
                    >
                      Delete Venue
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleModerate(selectedBusinessDetail.business?._id, selectedBusinessDetail.business?.isActive ? 'suspend' : 'approve')}
                        className="px-4 py-2.5 bg-zinc-900 text-white hover:bg-zinc-800 rounded-xl text-xs font-bold"
                      >
                        {selectedBusinessDetail.business?.isActive ? 'Suspend Business' : 'Approve Business'}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
