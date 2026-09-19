import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { updateBusiness } from '../api/business.api'
import { CATEGORY_METADATA, SERVICE_PRESETS } from '../utils/servicePresets'

export default function ManageServicesModal({ isOpen, business, onClose, onUpdated }) {
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState([])
  const [editingIndex, setEditingIndex] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', duration: 15, price: 0 })
  const [newService, setNewService] = useState({ name: '', duration: 20, price: 150 })

  useEffect(() => {
    if (business?.services) {
      setServices(business.services.map(s => ({
        name: s.name,
        duration: s.duration,
        price: s.price !== undefined ? s.price : 0,
      })))
    } else {
      setServices([{ name: 'General Service', duration: 15, price: 0 }])
    }
    setEditingIndex(null)
  }, [business])

  if (!isOpen || !business) return null

  const categoryInfo = CATEGORY_METADATA[business.category] || CATEGORY_METADATA.other

  const handleStartEdit = (index) => {
    setEditingIndex(index)
    setEditForm({ ...services[index] })
  }

  const handleSaveInlineEdit = () => {
    if (!editForm.name.trim()) {
      toast.error('Service name cannot be empty')
      return
    }
    const updated = [...services]
    updated[editingIndex] = {
      name: editForm.name.trim(),
      duration: Math.max(1, Number(editForm.duration) || 15),
      price: Math.max(0, Number(editForm.price) || 0),
    }
    setServices(updated)
    setEditingIndex(null)
  }

  const handleCancelInlineEdit = () => {
    setEditingIndex(null)
  }

  const handleAddService = () => {
    if (!newService.name.trim()) {
      toast.error('Enter service name')
      return
    }
    const duration = Math.max(1, Number(newService.duration) || 15)
    const price = Math.max(0, Number(newService.price) || 0)

    setServices(prev => [...prev, { name: newService.name.trim(), duration, price }])
    setNewService({ name: '', duration: 20, price: 150 })
    toast.success(`Added "${newService.name.trim()}" to staging`)
  }

  const handleRemoveService = (index) => {
    if (services.length <= 1) {
      toast.error('Every hub must keep at least one active service')
      return
    }
    setServices(prev => prev.filter((_, i) => i !== index))
    if (editingIndex === index) setEditingIndex(null)
  }

  const handleLoadPresets = () => {
    const presets = SERVICE_PRESETS[business.category] || []
    if (presets.length === 0) return
    setServices([...presets])
    toast.success(`Loaded standard ${categoryInfo.label} service catalog!`)
  }

  const handleSaveAll = async () => {
    if (services.length === 0) {
      toast.error('At least one service is required')
      return
    }

    setLoading(true)
    try {
      const res = await updateBusiness(business._id, {
        services,
      })
      const updatedBusiness = res.data.data.business
      toast.success('Services updated successfully!')
      onUpdated?.(updatedBusiness)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update services')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="bezel-shell w-full max-w-xl my-8 text-left shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bezel-core p-6 sm:p-8 bg-white border border-zinc-200/90 rounded-3xl max-h-[90vh] overflow-y-auto custom-scrollbar space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-2xl shadow-xs">
                  {categoryInfo.icon}
                </div>
                <div>
                  <h2 className="text-xl font-black text-zinc-950 tracking-tight">
                    Manage Hub Services
                  </h2>
                  <p className="text-xs text-zinc-500 font-medium truncate max-w-xs sm:max-w-md">
                    {business.name} &bull; {categoryInfo.label}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center font-bold text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>📋</span> Active Catalog ({services.length})
              </span>
              <button
                type="button"
                onClick={handleLoadPresets}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100/80 border border-teal-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
              >
                <span>⚡</span> Load Standard Presets
              </button>
            </div>

            {/* Services List with Inline Edit */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
              {services.map((svc, idx) => {
                const isEditing = editingIndex === idx

                if (isEditing) {
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-300 space-y-2 shadow-xs"
                    >
                      <p className="text-[10px] font-black uppercase text-teal-800 tracking-wider">
                        Edit Service #{idx + 1}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-6">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold bg-white focus:outline-none focus:border-teal-600"
                            placeholder="Service Name"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <div className="relative">
                            <input
                              type="number"
                              value={editForm.duration}
                              onChange={(e) => setEditForm(f => ({ ...f, duration: e.target.value }))}
                              className="w-full pl-2 pr-7 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold bg-white focus:outline-none focus:border-teal-600"
                              placeholder="Duration"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">m</span>
                          </div>
                        </div>
                        <div className="sm:col-span-3">
                          <div className="relative">
                            <input
                              type="number"
                              value={editForm.price}
                              onChange={(e) => setEditForm(f => ({ ...f, price: e.target.value }))}
                              className="w-full pl-5 pr-2 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold bg-white focus:outline-none focus:border-teal-600"
                              placeholder="Price"
                            />
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">₹</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCancelInlineEdit}
                          className="px-3 py-1 rounded-lg text-xs font-bold text-zinc-500 hover:bg-zinc-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveInlineEdit}
                          className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between gap-3 shadow-xs hover:border-zinc-300 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black text-zinc-950 truncate">{svc.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 font-semibold">
                        <span>⏱ {svc.duration} mins</span>
                        <span>•</span>
                        <span className="text-teal-700 font-extrabold">₹{svc.price}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(idx)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300 text-xs font-bold transition-all shadow-2xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(idx)}
                        className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 flex items-center justify-center font-bold text-xs transition-colors"
                        title="Remove service"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add New Service Card */}
            <div className="p-4 rounded-2xl border border-dashed border-teal-300/80 bg-teal-50/40 space-y-3">
              <span className="text-[10px] font-black uppercase text-teal-800 tracking-wider block">
                + Add Service to {business.name}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    placeholder="Service Name (e.g. Keratin Hair Spa)"
                    value={newService.name}
                    onChange={(e) => setNewService(s => ({ ...s, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-xs font-medium bg-white focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div className="sm:col-span-3">
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Duration"
                      min="1"
                      max="180"
                      value={newService.duration}
                      onChange={(e) => setNewService(s => ({ ...s, duration: e.target.value }))}
                      className="w-full pl-3 pr-8 py-2 rounded-xl border border-zinc-200 text-xs font-medium bg-white focus:outline-none focus:border-teal-600"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">min</span>
                  </div>
                </div>
                <div className="sm:col-span-3">
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Price"
                      min="0"
                      value={newService.price}
                      onChange={(e) => setNewService(s => ({ ...s, price: e.target.value }))}
                      className="w-full pl-6 pr-3 py-2 rounded-xl border border-zinc-200 text-xs font-medium bg-white focus:outline-none focus:border-teal-600"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-400">₹</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddService}
                className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs active:scale-[0.99]"
              >
                + Add Service to List
              </button>
            </div>

            {/* Save All Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center gap-2 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  'Save & Deploy Services 💾'
                )}
              </button>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
