import { Link } from 'react-router-dom'
import { useSeo } from '../utils/useSeo'

export default function PrivacyPolicyPage() {
  useSeo({
    title: 'Privacy Policy',
    description: 'Learn how serveQ collects, uses, and protects personal information, queue data, appointment bookings, and device preferences.',
    robots: 'index, follow',
    canonical: 'https://serveq.tech/privacy',
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
            Legal Transparency
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight">
            Privacy Policy
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
            This policy outlines actual data handling practices implemented across the serveQ platform. Specific registered legal entity name, jurisdiction-specific regulatory representatives, and mailing address require final confirmation.
          </p>
        </div>

        {/* Content Sections */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            1. Information We Collect
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            serveQ collects only information necessary to deliver virtual queue management, appointment scheduling, and notification services:
          </p>
          <ul className="list-disc list-inside text-sm text-zinc-600 space-y-2 pl-2">
            <li>
              <strong>Account Information:</strong> Name, email address, password hash, and user role (Customer, Hub Owner, or Admin). If you sign in via Google OAuth, we receive your public name, email address, and avatar image.
            </li>
            <li>
              <strong>Contact Details:</strong> Phone number when provided for queue entry or SMS notification alerts when your token is called.
            </li>
            <li>
              <strong>Queue & Booking Activity:</strong> Token numbers, service selections, assigned counters or practitioners, check-in timestamps, estimated wait times, and appointment schedule history.
            </li>
            <li>
              <strong>Payment & Wallet Data:</strong> Wallet ledger balances and deposit transaction records used for appointment reservation security and automatic cancellation refunds. Payment processing is tokenized securely.
            </li>
            <li>
              <strong>Device & Performance Cookies:</strong> Preference cookies such as <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-xs text-zinc-800">serveq_perf_mode</code> to remember your display optimization settings across sessions.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            2. How We Use Your Information
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Your information is used strictly to provide and improve service delivery:
          </p>
          <ul className="list-disc list-inside text-sm text-zinc-600 space-y-2 pl-2">
            <li>To track your real-time position in queues and calculate accurate estimated wait times.</li>
            <li>To transmit instant token call updates via WebSockets, browser push notifications, and SMS alerts.</li>
            <li>To enable Hub Owners to manage service counters, call tickets, and prevent lobby overcrowding.</li>
            <li>To process wallet credits, deductions, and refunds for cancellations caused by venue delays.</li>
            <li>To provide venue traffic analytics and queue velocity metrics to venue operators.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            3. Data Sharing & Disclosure
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            serveQ does not sell, rent, or trade your personal data. Data is shared only with:
          </p>
          <ul className="list-disc list-inside text-sm text-zinc-600 space-y-2 pl-2">
            <li>
              <strong>Venues You Join:</strong> The specific salon, clinic, or business where you join a queue receives your name, token number, requested service, and phone number (if provided) to service your appointment.
            </li>
            <li>
              <strong>Infrastructure Service Providers:</strong> Cloud hosting, database, SMS gateway (e.g. Twilio for SMS alerts), and authentication providers operating under strict confidentiality.
            </li>
            <li>
              <strong>Legal Compliance:</strong> When required by applicable law, court order, or official governmental request.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            4. Data Retention & Security
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Active queue items transition to completed records upon service conclusion. We employ industry-standard encryption in transit (HTTPS / WSS) and hashed credential storage (bcrypt) to protect account access. Access to customer records is restricted by authenticated role-based controls.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            5. Your Rights & Choices
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            You retain control over your data:
          </p>
          <ul className="list-disc list-inside text-sm text-zinc-600 space-y-2 pl-2">
            <li>You can review and update your profile information in your account settings.</li>
            <li>You may withdraw from a virtual queue at any time prior to service commencement.</li>
            <li>You can request account deletion or data export by contacting our support team.</li>
            <li>You can control notification permissions directly in your browser settings.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            6. Contact & Legal Enquiries
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            If you have questions about this policy or our data practices, contact us at:
          </p>
          <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-700 space-y-1">
            <p className="font-bold text-zinc-950">serveQ Privacy Team</p>
            <p>
              Email:{' '}
              <a href="mailto:privacy@serveq.tech" className="text-teal-700 hover:text-teal-800 font-semibold underline">
                privacy@serveq.tech
              </a>
            </p>
            <p>Support:{' '}
              <a href="mailto:support@serveq.tech" className="text-teal-700 hover:text-teal-800 font-semibold underline">
                support@serveq.tech
              </a>
            </p>
            <p className="text-zinc-500 pt-1">
              [Registered Entity and Physical Address pending confirmation by website owner]
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
