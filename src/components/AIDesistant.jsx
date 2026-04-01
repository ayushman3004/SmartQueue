import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from '../api/axios'

export default function AIDesistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([{ role: 'bot', text: 'Hello! I am your serveQ assistant. How can I help you book today?' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = input
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const res = await axios.post('/chatbot/chat', { message: userMsg, businessInfo: "Full Platform" })
      setMessages(prev => [...prev, { role: 'bot', text: res.data.data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "I'm having trouble connecting right now. Please try again later." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-10 right-10 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 40 }}
            className="w-96 h-[550px] bg-white rounded-[2.5rem] border border-zinc-200 shadow-2xl mb-6 flex flex-col overflow-hidden"
          >
            <div className="px-8 py-6 border-b border-zinc-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-950 flex items-center justify-center text-xl shadow-lg">🤖</div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-black text-zinc-950 tracking-tight uppercase">Neural Core</h4>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black uppercase text-emerald-600 tracking-widest">Signal Stable</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="w-10 h-10 rounded-xl hover:bg-zinc-200 transition-all text-slate-400 hover:text-zinc-950 font-black flex items-center justify-center text-xl"
              >
                ×
              </button>
            </div>

            <div ref={chatRef} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-white">
              {messages.map((m, i) => (
                <motion.div 
                  key={i} 
                  initial={{ x: m.role === 'user' ? 20 : -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] px-6 py-4 rounded-[1.75rem] text-[11px] font-bold leading-relaxed shadow-sm uppercase tracking-tight ${
                    m.role === 'user' 
                      ? 'bg-zinc-950 text-white rounded-tr-none' 
                      : 'bg-slate-50 text-zinc-950 border border-zinc-100 rounded-tl-none'
                  }`}>
                    {m.text}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 pl-2">
                  <div className="w-1 h-1 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-1 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                  <div className="w-1 h-1 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Analyzing...</span>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-100 bg-slate-50/50">
              <div className="relative group">
                <input 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSend()}
                  placeholder="Need assistance?"
                  className="w-full bg-white border border-zinc-200 rounded-2xl px-6 py-4 text-xs font-black text-zinc-950 placeholder:text-slate-400 placeholder:uppercase placeholder:tracking-widest focus:border-teal-600/30 transition-all outline-none shadow-xs"
                />
                <button 
                  onClick={handleSend}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-zinc-950 text-white font-black flex items-center justify-center hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
                >
                  →
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button 
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-20 h-20 rounded-[2rem] bg-zinc-950 shadow-2xl shadow-zinc-950/20 flex items-center justify-center text-3xl group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-linear-to-br from-teal-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="group-hover:animate-float transition-all relative z-10">🤖</span>
      </motion.button>
    </div>
  )
}
