import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from '../api/axios'

export default function AIDesistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([{ role: 'bot', text: 'Hello! I am your SmartQueue assistant. How can I help you book today?' }])
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
            className="w-96 h-[500px] glass p-1 shadow-2xl mb-6 flex flex-col overflow-hidden border-white/10"
          >
            <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--cyan)] to-[#7B61FF] flex items-center justify-center text-xl">🤖</div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-black text-white tracking-tight">SmartBot AI</h4>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Always Active</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-xl hover:bg-white/5 transition-colors text-[var(--text-muted)] hover:text-white font-black">×</button>
            </div>

            <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {messages.map((m, i) => (
                <motion.div 
                  key={i} 
                  initial={{ x: m.role === 'customer' ? 20 : -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className={`flex ${m.role === 'customer' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] px-5 py-4 rounded-3xl text-xs font-medium leading-relaxed shadow-sm ${
                    m.role === 'customer' 
                      ? 'bg-gradient-to-br from-[var(--cyan)] to-[#7B61FF] text-black font-bold rounded-tr-none' 
                      : 'bg-white/5 text-white border border-white/5 rounded-tl-none'
                  }`}>
                    {m.text}
                  </div>
                </motion.div>
              ))}
              {loading && <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] animate-pulse pl-4">SmartBot is thinking...</div>}
            </div>

            <div className="p-4 border-t border-white/5 bg-white/5">
              <div className="relative group">
                <input 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSend()}
                  placeholder="Need help or a quick booking?"
                  className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-xs font-medium text-white placeholder:text-[var(--text-muted)] focus:border-[var(--cyan)]/30 transition-all outline-none"
                />
                <button 
                  onClick={handleSend}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-[var(--cyan)] text-black font-black flex items-center justify-center hover:scale-105 transition-transform"
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
        className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[var(--cyan)] to-[#7B61FF] shadow-2xl shadow-[var(--cyan)]/20 flex items-center justify-center text-2xl group"
      >
        <span className="group-hover:animate-float transition-all">🤖</span>
      </motion.button>
    </div>
  )
}
