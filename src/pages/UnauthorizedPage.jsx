import { Link } from 'react-router-dom'
import { ArrowLeft, Home, Headphones } from 'lucide-react'
import { useSeo } from '../utils/useSeo'

export default function UnauthorizedPage({ message }) {
  useSeo({
    title: '401 — Unauthorized Access | serveQ',
    description: "You don't have permission to view this page or perform this action.",
    robots: 'noindex, nofollow',
  })

  return (
    <div className="fixed inset-0 z-[120] bg-[#EBF7F0]/95 backdrop-blur-xs text-zinc-900 flex flex-col justify-between selection:bg-[#049645]/20 selection:text-[#049645] overflow-y-auto">
      {/* Top Header */}
      <header className="border-b border-zinc-200/70 bg-white sticky top-0 z-10 shrink-0">
        <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 h-16 sm:h-18 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group" aria-label="serveQ Homepage">
            <img
              src="/serveq-logo.png"
              alt="serveQ Logo"
              className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-[1.02]"
            />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-zinc-200 bg-white text-xs sm:text-sm font-semibold text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-zinc-700" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 py-10 sm:py-16">
        <div className="w-full max-w-[840px] bg-white rounded-3xl sm:rounded-[36px] shadow-sm border border-zinc-100/80 p-6 sm:p-10 lg:p-12">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1.1fr] items-center gap-8 md:gap-10">
            {/* Left Column: Character with Laptop & Lock */}
            <div className="flex items-center justify-center py-2">
              <img
                src="/401-character.png"
                alt="Unauthorized Access Illustration"
                className="w-56 sm:w-64 md:w-72 h-auto object-contain select-none"
                draggable={false}
              />
            </div>

            {/* Vertical Separator Divider */}
            <div className="hidden md:block w-px self-stretch bg-zinc-200/70" />

            {/* Right Column: 401 Message and Actions */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-3.5 sm:space-y-4">
              <span className="text-6xl sm:text-7xl font-black text-zinc-950 tracking-tight leading-none">
                401
              </span>

              <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-extrabold tracking-tight">
                <span className="text-zinc-950">Unauthorized </span>
                <span className="text-[#049645]">Access</span>
              </h1>

              <p className="text-sm sm:text-base text-zinc-500 max-w-xs sm:max-w-sm leading-relaxed">
                {message || "You don't have permission to view this page or perform this action."}
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3 w-full">
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#049645] hover:bg-[#03833c] text-white text-xs sm:text-sm font-semibold shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>Go to Home</span>
                </Link>

                <Link
                  to="/support"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-xs sm:text-sm font-semibold shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Headphones className="w-4 h-4 text-zinc-700" />
                  <span>Contact Support</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Subtle Bottom Balance Spacing */}
      <div className="h-4 sm:h-8 shrink-0" />
    </div>
  )
}

