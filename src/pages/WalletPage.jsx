import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import * as walletApi from '../api/wallet.api'
import { useAuth } from '../context/AuthContext'

export default function WalletPage() {
  const { user, setUser } = useAuth()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAddMoney = async (e) => {
    e.preventDefault()
    if (!amount || amount <= 0) return toast.error("Enter a valid amount")
    
    setLoading(true)
    try {
      const res = await walletApi.addMoney(Number(amount))
      setUser({ ...user, walletBalance: res.data.data.balance })
      toast.success("Wallet updated successfully!", {
        style: { borderRadius: '16px', background: '#111', color: '#fff', border: '1px solid #06b6d4' }
      })
      setAmount('')
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add money")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-2xl px-4 sm:px-6">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass p-8 md:p-12 space-y-10 rounded-[3rem] shadow-2xl"
      >
        <div className="text-center space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-500">Secure Environment</span>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Smart<span className="gradient-text italic">Pay</span> Hub</h1>
        </div>

        <div className="bg-linear-to-br from-neutral-900 to-black rounded-[2.5rem] p-8 md:p-10 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-[100px] group-hover:opacity-20 transition-opacity duration-700" />
          <div className="relative space-y-3">
            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Global Liquid Balance</span>
            <div className="text-5xl md:text-7xl font-black text-white tracking-tighter italic">
              <span className="text-3xl text-cyan-500 mr-2 not-italic">₹</span>
              {(user?.walletBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <form onSubmit={handleAddMoney} className="space-y-8">
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600 ml-1">Injection Amount (INR)</label>
            <div className="relative group">
              {/* <span className="absolute left-8 top-1/2 -translate-y-1/2 text-2xl font-black text-cyan-500 group-focus-within:scale-110 transition-transform">₹</span> */}
              <input 
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="input pl-14 text-2xl font-black py-7 border-white/5 focus:border-cyan-500/30 rounded-[1.75rem] transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[10, 50, 100, 500].map(val => (
              <button 
                key={val}
                type="button"
                onClick={() => setAmount(val)}
                className="py-4 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-black text-white uppercase tracking-widest hover:bg-cyan-500 hover:text-black hover:border-transparent transition-all active:scale-95"
              >
                +₹{val}
              </button>
            ))}
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-7 rounded-4xl text-[10px] font-black uppercase tracking-[0.3em] bg-linear-to-r from-cyan-400 to-blue-600 text-black shadow-2xl shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all hover:-translate-y-1 active:scale-[0.98] relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative z-10">{loading ? "Synchronizing..." : "Initialize Transfer"}</span>
          </button>
        </form>

        <p className="text-[9px] text-center text-neutral-700 font-black uppercase tracking-[0.2em] leading-relaxed italic">
          Transactions secured via AES-256 liquid encryption layer.<br/>
          Mock gateway active for environment validation.
        </p>
      </motion.div>
    </div>
  )
}
