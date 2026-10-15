import { Link } from 'react-router-dom'
import { useSeo } from '../utils/useSeo'

export default function NotFoundPage() {
  useSeo({
    title: '404 — Page Not Found',
    description: 'The requested page could not be found on serveQ. Return to the homepage or explore available venues.',
    robots: 'noindex, nofollow',
  })

  return (
    <div className="min-h-screen bg-[#fafaf9] text-zinc-900 flex flex-col justify-between selection:bg-teal-500/20 selection:text-teal-900">
      {/* Header */}
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline group" aria-label="serveQ Homepage">
            <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200/80 p-1 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <img src="/logo.png?v=2" alt="serveQ Logo" className="w-full h-full object-contain" width="36" height="36" />
            </div>
            <span className="text-lg font-black tracking-tight text-zinc-950">serve<span className="text-[#FF5537]">Q</span></span>
          </Link>
          <Link
            to="/"
            className="text-xs font-bold text-teal-700 hover:text-teal-800 px-3 py-2 rounded-lg hover:bg-teal-50 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-lg bg-white border border-zinc-200/90 rounded-3xl p-8 sm:p-12 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-center justify-center mx-auto text-teal-700 font-black text-2xl shadow-xs">
            404
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-teal-700 bg-teal-50 border border-teal-200/70 px-3 py-1 rounded-full">
              Resource Not Found
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight pt-1">
              Page Not Found
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-sm mx-auto">
              The page you are looking for doesn't exist, has been moved, or the URL might have a typo.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/"
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all text-center"
            >
              Return Home
            </Link>
            <Link
              to="/customers"
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold uppercase tracking-wider active:scale-95 transition-all text-center"
            >
              Browse Queues
            </Link>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-center gap-6 text-xs text-zinc-500">
            <Link to="/business" className="hover:text-zinc-900 transition-colors">
              Business Portal
            </Link>
            <span>•</span>
            <Link to="/login" className="hover:text-zinc-900 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/80 py-6 bg-white text-xs text-zinc-500 text-center">
        <p>© {new Date().getFullYear()} serveQ. All rights reserved.</p>
      </footer>
    </div>
  )
}
