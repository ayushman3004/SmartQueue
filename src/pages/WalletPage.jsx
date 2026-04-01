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
    <div className="container max-w-2xl px-4 sm:px-6 pt-12 pb-20">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border border-zinc-200 p-8 md:p-12 space-y-10 rounded-[3rem] shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="text-center space-y-2 relative z-10">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-teal-600">Secure Environment</span>
          <h1 className="text-4xl font-black tracking-tight text-zinc-950 uppercase leading-none">Smart<span className="text-teal-600">Pay</span> Hub</h1>
        </div>

        <div className="bg-teal-600 rounded-[2.5rem] p-8 md:p-10 border border-teal-500 relative overflow-hidden group shadow-xl shadow-teal-600/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] group-hover:opacity-40 transition-opacity duration-700" />
          <div className="relative space-y-4">
            <span className="text-[10px] font-black text-teal-100 uppercase tracking-widest">Global Liquid Balance</span>
            <div className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none">
              <span className="text-3xl text-teal-200 mr-2 not-italic">₹</span>
              {(user?.walletBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <form onSubmit={handleAddMoney} className="space-y-8 relative z-10">
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-2">Injection Amount (INR)</label>
            <div className="relative group">
              <input 
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="input pl-10 text-2xl font-black py-7 border-zinc-200 focus:border-teal-600/30 rounded-[1.75rem] transition-all bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[10, 50, 100, 500].map(val => (
              <button 
                key={val}
                type="button"
                onClick={() => setAmount(val)}
                className="py-4 rounded-2xl bg-slate-50 border border-zinc-100 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-teal-600 hover:text-white hover:border-teal-500 transition-all active:scale-95 shadow-xs"
              >
                +₹{val}
              </button>
            ))}
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-7 rounded-4xl text-[10px] font-black uppercase tracking-[0.3em] bg-zinc-950 text-white shadow-xl shadow-zinc-950/10 hover:bg-zinc-800 transition-all hover:-translate-y-1 active:scale-[0.98] relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative z-10">{loading ? "Synchronizing..." : "Initialize Transfer"}</span>
          </button>
        </form>

        <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-[0.2em] leading-relaxed opacity-80">
          Transactions secured via AES-256 liquid encryption layer.<br/>
          Mock gateway active for environment validation.
        </p>
      </motion.div>
    </div>
  )
}
