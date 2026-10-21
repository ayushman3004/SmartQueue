import { Link } from 'react-router-dom'
import { useSeo } from '../utils/useSeo'

export default function TermsPage() {
  useSeo({
    title: 'Terms and Conditions',
    description: 'Review the terms and conditions for using serveQ, including virtual queue tokens, appointments, cancellations, and venue management.',
    robots: 'index, follow',
    canonical: 'https://serveq.tech/terms',
  })

  return (
    <div className="min-h-screen bg-[#fafaf9] text-zinc-900 flex flex-col justify-between selection:bg-teal-500/20 selection:text-teal-900">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#fafaf9]/85 backdrop-blur-md border-b border-zinc-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline group" aria-label="serveQ Homepage">
            <img src="/serveq-logo.png" alt="serveQ Logo" className="h-7.5 w-auto object-contain transition-transform group-hover:scale-105" />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-xs font-bold text-zinc-700 hover:text-zinc-950 px-3 py-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Home
            </Link>
            <Link
              to="/login"
              className="text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-full shadow-sm hover:shadow transition-all active:scale-95"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10 text-left">
        {/* Page Title */}
        <div className="space-y-3 pb-8 border-b border-zinc-200">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/70 text-teal-800 text-[10px] font-black uppercase tracking-wider">
            Terms of Service
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight">
            Terms and Conditions
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium">
            Effective Date: October 13, 2026 • Last updated: October 2026
          </p>
        </div>

        {/* Notice Callout */}
        <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-1">
          <p className="font-bold">
            Note for Legal Review:
          </p>
          <p>
            These terms govern standard use of the serveQ web application and queue services. Governing law, specific dispute resolution forum, and registered corporate identity require legal confirmation.
          </p>
        </div>

        {/* Content Sections */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            1. Acceptance of Terms
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            By creating an account, accessing, or using serveQ (the "Platform"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, do not access or use our services.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            2. Customer Virtual Queue & Token Rules
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            When joining a live virtual queue:
          </p>
          <ul className="list-disc list-inside text-sm text-zinc-600 space-y-2 pl-2">
            <li>
              <strong>Virtual Tokens:</strong> Tokens are issued sequentially. You are responsible for monitoring your estimated wait time and arriving promptly when your number approaches.
            </li>
            <li>
              <strong>No-Show Policy:</strong> If your token is called and you fail to present yourself within the venue's grace period, the operator may advance the counter to the next customer.
            </li>
            <li>
              <strong>Voluntary Withdrawal:</strong> You may leave a live queue at any time through the in-app Queue Pass interface.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            3. Appointments, Deposits & Refunds
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            The Platform provides appointment reservation tools and wallet-based deposits:
          </p>
          <ul className="list-disc list-inside text-sm text-zinc-600 space-y-2 pl-2">
            <li>
              <strong>Deposits & Payments:</strong> For venues requiring prepaid deposits or in-app payment, funds are drawn from your verified wallet balance.
            </li>
            <li>
              <strong>Delays & Cancellation Refunds:</strong> In the event that a service counter reports significant delays, customers may cancel their booking directly from the Queue Pass to receive an immediate automated wallet refund.
            </li>
            <li>
              <strong>Wallet Balances:</strong> Deposited funds are maintained in your account ledger and may be applied toward any participating venue on the Platform.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            4. Business & Hub Owner Responsibilities
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Venues and business operators using the Hub Command Center agree to:
          </p>
          <ul className="list-disc list-inside text-sm text-zinc-600 space-y-2 pl-2">
            <li>Maintain accurate operating hours, service catalog details, and pricing.</li>
            <li>Advance queues fairly and accurately reflect counter operational status.</li>
            <li>Promptly communicate unexpected delays through the queue system.</li>
            <li>Honor valid bookings and appointments scheduled through the Platform.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            5. Intellectual Property
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            All rights, title, and interest in serveQ, including brand assets, logos, user interface components, software, and real-time queuing algorithms, remain the exclusive property of serveQ. You may not copy, reverse engineer, or redistribute platform assets without prior written consent.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            6. Limitation of Liability
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            serveQ provides virtual queue and scheduling software. Actual service delivery, professional treatments, and in-person consultations are the sole responsibility of the independent venue operator. To the maximum extent permitted by applicable law, serveQ shall not be liable for venue service disputes, scheduling adjustments made by venues, or indirect damages.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            7. Contact & Legal Notices
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            For contractual inquiries, terms clarification, or official notices, contact:
          </p>
          <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-700 space-y-1">
            <p className="font-bold text-zinc-950">serveQ Legal Counsel</p>
            <p>
              Email:{' '}
              <a href="mailto:legal@serveq.tech" className="text-teal-700 hover:text-teal-800 font-semibold underline">
                legal@serveq.tech
              </a>
            </p>
            <p>
              Support:{' '}
              <a href="mailto:support@serveq.tech" className="text-teal-700 hover:text-teal-800 font-semibold underline">
                support@serveq.tech
              </a>
            </p>
            <p className="text-zinc-500 pt-1">
              [Registered Legal Entity name and Jurisdiction pending confirmation by website owner]
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/80 py-8 bg-white text-xs text-zinc-500">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/serveq-logo.png" alt="serveQ Logo" className="h-5 w-auto object-contain" />
            <span>• Smart Virtual Queuing</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-center">
            <Link to="/" className="hover:text-zinc-900 transition-colors">Home</Link>
            <Link to="/privacy" className="hover:text-zinc-900 transition-colors">Privacy Policy</Link>
            <Link to="/business" className="hover:text-zinc-900 transition-colors">Business Portal</Link>
          </div>
          <p>© {new Date().getFullYear()} serveQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
