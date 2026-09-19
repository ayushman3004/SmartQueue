import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { createBusiness } from '../api/business.api'
import { CATEGORY_METADATA, SERVICE_PRESETS } from '../utils/servicePresets'

export default function RegisterHubModal({ isOpen, onClose, onCreated }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'salon',
    address: '',
    location: '',
    phone: '',
    timings: { open: '09:00', close: '20:00' },
    averageServiceTime: 20,
    basePrice: 150,
    services: [
      { name: 'Haircut & Styling', duration: 30, price: 250 },
      { name: 'Beard Grooming & Trim', duration: 15, price: 150 },
    ],
  })

  const [newService, setNewService] = useState({ name: '', duration: 20, price: 150 })

  if (!isOpen) return null

  const handleCategoryChange = (cat) => {
    const meta = CATEGORY_METADATA[cat] || {}
    const presets = SERVICE_PRESETS[cat] || []
    setForm(prev => ({
      ...prev,
      category: cat,
      averageServiceTime: meta.defaultDuration || 20,
      basePrice: meta.defaultPrice || 100,
      // If services list has default or is empty, auto-populate with the first 2 presets of new category
      services: presets.slice(0, 3),
    }))
  }

  const handleAddService = () => {
    if (!newService.name.trim()) {
      toast.error('Please specify a service name')
      return
    }
    const duration = Math.max(1, Number(newService.duration) || 15)
    const price = Math.max(0, Number(newService.price) || 0)

    setForm(prev => ({
      ...prev,
      services: [...prev.services, { name: newService.name.trim(), duration, price }],
    }))
    setNewService({ name: '', duration: 20, price: 150 })
  }

  const handleRemoveService = (index) => {
    if (form.services.length <= 1) {
      toast.error('A hub must offer at least one service')
      return
    }
    setForm(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index),
    }))
  }

  const handleLoadPresets = () => {
    const presets = SERVICE_PRESETS[form.category] || []
    if (presets.length === 0) return
    setForm(prev => ({
      ...prev,
      services: [...presets],
    }))
    toast.success(`Loaded standard ${CATEGORY_METADATA[form.category]?.label || ''} services!`)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Hub name is required')
      return
    }
    if (form.services.length === 0) {
      toast.error('Please add at least one service to your hub')
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        address: form.address.trim(),
        location: form.location.trim(),
        phone: form.phone.trim(),
        timings: form.timings,
        averageServiceTime: Number(form.averageServiceTime) || 20,
        basePrice: Number(form.basePrice) || 0,
        services: form.services,
      }

      const res = await createBusiness(payload)
      const created = res.data.data.business
      toast.success(`🎉 Hub "${created.name}" established with ${created.services?.length || 0} services!`)
      onCreated?.(created)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register hub')
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
          className="bezel-shell w-full max-w-2xl my-8 text-left shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bezel-core p-6 sm:p-8 bg-white border border-zinc-200/90 rounded-3xl max-h-[90vh] overflow-y-auto custom-scrollbar space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-2xl shadow-xs">
                  🏢
                </div>
                <div>
                  <h2 className="text-xl font-black text-zinc-950 tracking-tight">Register Business Hub</h2>
                  <p className="text-xs text-zinc-500 font-medium">Establish a live operational hub and configure its service catalog.</p>
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

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Category Pill Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">
                  Industry / Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(CATEGORY_METADATA).map(([catKey, meta]) => {
                    const isSelected = form.category === catKey
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => handleCategoryChange(catKey)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <span className="text-base">{meta.icon}</span>
                        <span className="truncate">{meta.label.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Hub Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    Hub / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Blade & Shears Executive Saloon"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    City / Neighborhood *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Downtown Central"
                    value={form.location}
                    onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium focus:outline-none focus:border-teal-600 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium focus:outline-none focus:border-teal-600 transition-colors"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    Detailed Physical Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2nd Floor, Grand Arcade, 14th Main Road"
                    value={form.address}
                    onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium focus:outline-none focus:border-teal-600 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    Opening Time
                  </label>
                  <input
                    type="time"
                    value={form.timings.open}
                    onChange={(e) => setForm(f => ({ ...f, timings: { ...f.timings, open: e.target.value } }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    Closing Time
                  </label>
                  <input
                    type="time"
                    value={form.timings.close}
                    onChange={(e) => setForm(f => ({ ...f, timings: { ...f.timings, close: e.target.value } }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              {/* ─── SERVICES CONFIGURATION SECTION ─── */}
              <div className="pt-5 border-t border-zinc-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-1.5">
                      <span>⚡</span> Configured Services ({form.services.length})
                    </h3>
                    <p className="text-xs text-zinc-500">Customers select these services when reserving or joining your queue.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadPresets}
                    className="text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100/80 border border-teal-200 px-3 py-1.5 rounded-xl transition-all self-start sm:self-auto flex items-center gap-1"
                  >
                    <span>⚡</span> Load Industry Presets
                  </button>
                </div>

                {/* Service Cards List */}
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {form.services.map((svc, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between gap-3 shadow-xs hover:border-zinc-300 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-black text-zinc-950 truncate">{svc.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 font-semibold">
                          <span>⏱ {svc.duration} mins</span>
                          <span>•</span>
                          <span className="text-teal-700 font-extrabold">₹{svc.price}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(idx)}
                        className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 flex items-center justify-center font-bold text-xs transition-colors flex-shrink-0"
                        title="Remove service"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Inline Add Service Sub-Form */}
                <div className="p-4 rounded-2xl border border-dashed border-teal-300/80 bg-teal-50/40 space-y-3">
                  <span className="text-[10px] font-black uppercase text-teal-800 tracking-wider block">
                    + Add New Service to Catalog
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        placeholder="Service Name (e.g. Royal Shave)"
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
                    + Add This Service
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-teal-600/20 transition-all flex items-center gap-2 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Establishing Hub...
                    </>
                  ) : (
                    'Establish Hub & Open Catalog 🚀'
                  )}
                </button>
              </div>

            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
