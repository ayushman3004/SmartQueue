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
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: "I'm having trouble connecting right now. Please try again later." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="bezel-shell w-[360px] sm:w-[380px] h-[520px] mb-4 shadow-2xl origin-bottom-right"
          >
            <div className="bezel-core h-full flex flex-col overflow-hidden text-left">
              {/* Header */}
              <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center text-lg shadow-sm">
                    🤖
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-zinc-950 tracking-tight">serveQ Assistant</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-radar" />
                      <span className="text-[9px] font-extrabold uppercase text-emerald-600 tracking-wider">Online</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="w-8 h-8 rounded-full hover:bg-zinc-200/80 text-zinc-400 hover:text-zinc-950 transition-colors flex items-center justify-center font-bold text-sm active:scale-[0.96]"
                  aria-label="Close Assistant"
                >
                  ✕
                </button>
              </div>

              {/* Message List */}
              <div ref={chatRef} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-white">
                {messages.map((m, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs font-semibold leading-relaxed ${
                      m.role === 'user' 
                        ? 'bg-zinc-950 text-white rounded-br-none shadow-xs' 
                        : 'bg-zinc-100 text-zinc-800 rounded-bl-none border border-zinc-200/60'
                    }`}>
                      {m.text}
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <div className="flex items-center gap-1.5 pl-2 py-1">
                    <span className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 ml-1">Analyzing...</span>
                  </div>
                )}
              </div>

              {/* Input Footer */}
              <div className="p-3.5 border-t border-zinc-100 bg-zinc-50/60">
                <div className="relative flex items-center">
                  <input 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Ask about live queues or bookings..."
                    className="w-full bg-white border border-zinc-200/90 rounded-full pl-4 pr-12 py-3 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all shadow-inner"
                  />
                  <button 
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="absolute right-1.5 w-8 h-8 rounded-full bg-zinc-950 text-white flex items-center justify-center hover:bg-zinc-800 disabled:opacity-40 transition-all active:scale-[0.94] shadow-xs"
                    aria-label="Send"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Trigger Button */}
      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-14 h-14 rounded-full bg-zinc-950 text-white shadow-xl shadow-zinc-950/25 flex items-center justify-center border border-zinc-800 overflow-hidden group"
        aria-label="Open AI Assistant"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="text-xl relative z-10 transition-transform group-hover:scale-110">🤖</span>
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-teal-400 animate-radar" />
      </motion.button>
    </div>
  )
}
