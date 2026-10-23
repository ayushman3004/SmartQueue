import { Link } from 'react-router-dom'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-white border-t border-zinc-200/80 text-zinc-600 font-sans mt-auto selection:bg-emerald-500/20 selection:text-emerald-900 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
          {/* Brand & Tagline */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 text-center sm:text-left">
            <Link to="/" className="inline-flex items-center group text-decoration-none">
              <img
                src="/serveq-logo.png"
                alt="serveQ"
                className="h-6 w-auto object-contain transition-transform group-hover:scale-105"
              />
            </Link>
            <span className="hidden sm:inline text-zinc-300">•</span>
            <p className="text-xs text-zinc-500 font-medium">
              Virtual queueing &amp; counter appointments
            </p>
            <span className="hidden sm:inline text-zinc-300">•</span>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF7EE] text-[#114227] text-[11px] font-bold border border-[#BDE8CB]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Operational</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs font-semibold text-zinc-600">
            <Link to="/customers" className="hover:text-zinc-950 transition-colors">
              Customer Portal
            </Link>
            <Link to="/business" className="hover:text-zinc-950 transition-colors">
              Business Console
            </Link>
            <Link to="/subscription" className="hover:text-zinc-950 transition-colors">
              Subscription
            </Link>
            <Link to="/support" className="hover:text-zinc-950 transition-colors">
              Support
            </Link>
            <Link to="/privacy" className="hover:text-zinc-950 transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-zinc-950 transition-colors">
              Terms
            </Link>
          </div>
        </div>

        {/* Bottom Compact Sub-bar */}
        <div className="mt-4 pt-3.5 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-400">
          <p>© {currentYear} ServeQ Technologies. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <a
              href="mailto:support@serveq.tech"
              className="text-zinc-500 hover:text-zinc-900 transition-colors font-medium"
            >
              support@serveq.tech
            </a>
            <span>•</span>
            <span>Made for waitless living</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
