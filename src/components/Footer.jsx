import { Link } from 'react-router-dom'
import {
  Mail,
  ShieldCheck,
  Clock,
  Sparkles,
  ExternalLink,
  ArrowUpRight,
  Headphones,
  CheckCircle2,
} from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-white border-t border-zinc-200/90 text-zinc-600 font-sans mt-auto selection:bg-emerald-500/20 selection:text-emerald-900 z-10">
      {/* Top Banner / Highlight */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          
          {/* Brand & Mission (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-4">
            <Link to="/" className="inline-flex items-center group text-decoration-none">
              <img
                src="/serveq-logo.png"
                alt="serveQ"
                className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105"
              />
            </Link>

            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-sm font-medium">
              Smarter queues. Better experiences. We help clinics, salons, and service businesses eliminate crowded waiting rooms with live virtual queueing and easy appointments.
            </p>

            {/* Operational Status Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EAF7EE] border border-[#BDE8CB] text-[#114227] text-xs font-bold shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <span>All Systems Operational</span>
            </div>

            <div className="pt-2 text-xs text-zinc-500 space-y-1">
              <p>
                Inquiries &amp; Support:{' '}
                <a
                  href="mailto:support@serveq.tech"
                  className="font-semibold text-zinc-900 hover:text-emerald-700 transition-colors"
                >
                  support@serveq.tech
                </a>
              </p>
              <p>
                Security &amp; Auth:{' '}
                <a
                  href="mailto:security@serveq.tech"
                  className="font-semibold text-zinc-900 hover:text-emerald-700 transition-colors"
                >
                  security@serveq.tech
                </a>
              </p>
            </div>
          </div>

          {/* Navigation Column 1: For Customers (lg:col-span-3) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
              For Customers
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm font-medium">
              <li>
                <Link to="/customers" className="text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1.5">
                  Customer Portal
                </Link>
              </li>
              <li>
                <Link to="/queue" className="text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1.5">
                  Live Virtual Queues
                </Link>
              </li>
              <li>
                <Link to="/booking" className="text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1.5">
                  Book an Appointment
                </Link>
              </li>
              <li>
                <Link to="/wallet" className="text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1.5">
                  Passes &amp; Wallet
                </Link>
              </li>
              <li>
                <Link to="/history" className="text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1.5">
                  Queue &amp; Visit History
                </Link>
              </li>
            </ul>
          </div>

          {/* Navigation Column 2: For Businesses (lg:col-span-3) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
              For Businesses
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm font-medium">
              <li>
                <Link to="/business" className="text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1.5">
                  Business Hub Console
                </Link>
              </li>
              <li>
                <Link to="/business/onboarding" className="text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1.5">
                  Register Your Venue
                </Link>
              </li>
              <li>
                <Link to="/support" className="text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1.5">
                  Partner Help &amp; Support
                </Link>
              </li>
              <li>
                <a
                  href="mailto:support@serveq.tech?subject=Business%20Partnership%20Inquiry"
                  className="text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1"
                >
                  Partner With Us <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
                </a>
              </li>
            </ul>
          </div>

          {/* Navigation Column 3: Trust & Company (lg:col-span-2) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
              Support &amp; Trust
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm font-medium">
              <li>
                <Link to="/support" className="text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1.5">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1.5">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1.5">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/profile" className="text-zinc-600 hover:text-zinc-950 transition-colors flex items-center gap-1.5">
                  Account Settings
                </Link>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom Sub-bar */}
      <div className="border-t border-zinc-100 bg-[#FAFBFB] py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <p>© {currentYear} ServeQ Technologies. All rights reserved.</p>

          <div className="flex items-center gap-4 text-xs font-medium">
            <Link to="/privacy" className="text-zinc-500 hover:text-zinc-900 transition-colors">
              Privacy
            </Link>
            <span className="text-zinc-300">•</span>
            <Link to="/terms" className="text-zinc-500 hover:text-zinc-900 transition-colors">
              Terms
            </Link>
            <span className="text-zinc-300">•</span>
            <Link to="/support" className="text-zinc-500 hover:text-zinc-900 transition-colors">
              Support
            </Link>
            <span className="text-zinc-300">•</span>
            <span className="text-zinc-400">Made for waitless living</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
