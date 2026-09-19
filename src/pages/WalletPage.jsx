import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import * as walletApi from '../api/wallet.api'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

export default function WalletPage() {
  const { user, setUser } = useAuth()
  const { joinUser } = useSocket()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  // Fetch latest balance on mount
  useEffect(() => {
    walletApi.getBalance()
      .then(res => {
        setUser(prev => prev ? { ...prev, walletBalance: res.data.data.balance } : prev)
      })
      .catch(() => {})
  }, [])

  // Ensure user is in their private socket room for wallet:update events
  useEffect(() => {
    if (user?._id) joinUser(user._id)
  }, [user?._id])

  const handleAddMoney = async (e) => {
    e.preventDefault()
    if (!amount || amount <= 0) return toast.error("Enter a valid amount")
    
    setLoading(true)
    try {
      const res = await walletApi.addMoney(Number(amount))
      setUser({ ...user, walletBalance: res.data.data.balance })
      toast.success("Wallet updated successfully!", {
        style: { borderRadius: '16px', background: '#ffffff', color: '#09090b', border: '1px solid #f4f4f5' }
      })
      setAmount('')
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add money", {
        style: { borderRadius: '16px', background: '#ffffff', color: '#09090b', border: '1px solid #fef2f2' }
      })
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="container max-w-xl px-4 sm:px-6 pt-8 pb-20 text-left">
      <div className="bezel-shell">
        <div className="bezel-core p-6 sm:p-10 space-y-8 relative overflow-hidden">
          <div className="text-center space-y-2">
            <div className="badge-eyebrow mx-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
              Secure Liquid Vault
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">
              serveQ <span className="text-teal-600">Wallet</span>
            </h1>
            <p className="text-xs text-zinc-500 font-medium">Instant automated refunds and zero-wait checkout ledger.</p>
          </div>

          {/* Machined Metal / Liquid Teal Vault Card */}
          <div className="rounded-3xl p-7 md:p-8 bg-gradient-to-br from-teal-700 via-teal-800 to-zinc-950 text-white shadow-xl shadow-teal-900/20 border border-teal-600/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-400/20 rounded-full blur-[70px] pointer-events-none" />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-200">Verified Balance</span>
                <span className="text-[10px] font-bold text-teal-300/80 uppercase tracking-widest">Instant Settlement</span>
              </div>
              <div className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-none flex items-baseline">
                <span className="text-2xl sm:text-3xl text-teal-300 mr-2 font-normal">₹</span>
                {(user?.walletBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <form onSubmit={handleAddMoney} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 block">
                Deposit Amount (INR)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-zinc-400">₹</span>
                <input 
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="input pl-10 text-xl font-black py-4 rounded-2xl bg-white border-zinc-200 focus:border-teal-500"
                />
              </div>
            </div>

            {/* Tactile Quick Add Pills */}
            <div className="grid grid-cols-4 gap-2">
              {[50, 100, 200, 500].map(val => (
                <button 
                  key={val}
                  type="button"
                  onClick={() => setAmount(val.toString())}
                  className="py-3 rounded-xl bg-zinc-50 border border-zinc-200/90 text-xs font-extrabold text-zinc-700 hover:border-teal-500 hover:bg-teal-50/50 hover:text-teal-900 transition-all active:scale-[0.96] shadow-xs"
                >
                  +₹{val}
                </button>
              ))}
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full btn-island py-4 text-xs tracking-wider"
            >
              <span>{loading ? "Processing Deposit..." : "Add Funds to Wallet"}</span>
              <span className="btn-bubble">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </span>
            </button>
          </form>

          <p className="text-[10px] text-center text-zinc-400 font-medium leading-relaxed">
            Funds deposited are instantly credited and automatically drawn for slot bookings and express queue passes.
          </p>
        </div>
      </div>
    </div>
  )
}
