import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSeo } from '../utils/useSeo'
import { Mail, Globe, Shield, MapPin, CreditCard, Store, Clock, Cpu, Lock } from 'lucide-react'

export default function PrivacyPolicyPage() {
  const { user } = useAuth()
  useSeo({
    title: 'Privacy Policy — serveQ',
    description: 'Learn how serveQ collects, uses, stores, processes, and protects your personal information, venue data, and payment details.',
    robots: 'index, follow',
    canonical: 'https://serveq.tech/privacy',
  })

  const dashboardPath = user?.role === 'owner' ? '/business' : user?.role === 'admin' ? '/admin' : '/customers'

  return (
    <div className="min-h-screen app-background text-zinc-900 flex flex-col justify-between selection:bg-emerald-500/20 selection:text-emerald-900 relative">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-zinc-200/80">
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
            {user ? (
              <Link
                to={dashboardPath}
                className="text-xs font-bold bg-[#114227] hover:bg-[#0c311d] text-white px-4 py-2 rounded-full shadow-sm hover:shadow transition-all active:scale-95"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="text-xs font-bold bg-[#114227] hover:bg-[#0c311d] text-white px-4 py-2 rounded-full shadow-sm hover:shadow transition-all active:scale-95"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10 text-left">
        {/* Page Title */}
        <div className="space-y-3 pb-8 border-b border-zinc-200">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
            <Shield className="w-3 h-3 text-emerald-700" />
            <span>Legal Transparency</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium">
            Last Updated: November 1, 2026
          </p>
        </div>

        {/* Intro */}
        <div className="space-y-4 text-sm sm:text-base text-zinc-700 leading-relaxed bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs">
          <p>
            <strong>ServeQ</strong> (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, process and share information when you access or use our website, applications and services.
          </p>
          <p className="text-zinc-600 font-medium">
            By using ServeQ, you acknowledge the practices described in this Privacy Policy.
          </p>
        </div>

        {/* Section 1: Information We Collect */}
        <section className="space-y-6">
          <div className="border-b border-zinc-200 pb-3">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight flex items-center gap-2.5">
              <span>1. Information We Collect</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-1 font-medium">
              We may collect the following categories of information:
            </p>
          </div>

          <div className="space-y-4">
            {/* 1.A */}
            <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-2xs space-y-2.5">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center text-xs font-black">A</span>
                <span>User and Account Information</span>
              </h3>
              <p className="text-xs text-zinc-600">When you register or use ServeQ, we may collect:</p>
              <ul className="list-disc list-inside text-xs sm:text-sm text-zinc-600 space-y-1.5 pl-2">
                <li>Full name</li>
                <li>Email address</li>
                <li>Mobile phone number</li>
                <li>Profile information</li>
                <li>Account credentials and authentication information</li>
                <li>User preferences and account settings</li>
              </ul>
            </div>

            {/* 1.B */}
            <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center text-xs font-black">B</span>
                <span>Location Information</span>
              </h3>
              <p className="text-xs text-zinc-600">ServeQ may collect or process your location information, including:</p>
              <ul className="list-disc list-inside text-xs sm:text-sm text-zinc-600 space-y-1 pl-2">
                <li>Approximate geographical location</li>
                <li>Precise device location, when you grant permission</li>
                <li>Location coordinates (latitude and longitude)</li>
                <li>Selected campus or geographical area</li>
                <li>Venue location and navigation-related information</li>
              </ul>

              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-zinc-700 space-y-1.5">
                <p className="font-bold text-zinc-900">Why we collect location information:</p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-zinc-600">
                  <li>To display nearby salons and other available venues.</li>
                  <li>To help users discover businesses within their selected campus or area.</li>
                  <li>To provide location-based services and navigation.</li>
                  <li>To improve the relevance of venue recommendations.</li>
                </ul>
                <p className="pt-1.5 text-zinc-500 font-medium">
                  Location permissions can be controlled through your device or browser settings. You may still use certain features by selecting a location manually, where supported.
                </p>
              </div>
            </div>

            {/* 1.C */}
            <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-2xs space-y-2.5">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center text-xs font-black">C</span>
                <span>Payment and Transaction Information</span>
              </h3>
              <p className="text-xs text-zinc-600">When you make payments through ServeQ, we may collect and process:</p>
              <ul className="list-disc list-inside text-xs sm:text-sm text-zinc-600 space-y-1 pl-2">
                <li>Transaction amount</li>
                <li>Payment date and time</li>
                <li>Payment status</li>
                <li>Transaction and payment reference IDs</li>
                <li>Refund and cancellation details</li>
                <li>Payment method information, where provided by the payment gateway</li>
                <li>Business payment and settlement status</li>
              </ul>
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-xs text-amber-950 space-y-1">
                <p>Payments may be processed through third-party payment providers, including Razorpay.</p>
                <p>
                  Your card details, UPI credentials, banking passwords and other sensitive payment credentials are handled by the relevant payment service provider through its secure payment infrastructure. ServeQ does not intend to store such credentials on its own servers.
                </p>
                <p className="font-medium text-amber-900">
                  Payment processing and related information are subject to the payment provider&apos;s privacy policy and terms.
                </p>
              </div>
            </div>

            {/* 1.D */}
            <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-2xs space-y-2.5">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center text-xs font-black">D</span>
                <span>Venue and Business Information</span>
              </h3>
              <p className="text-xs text-zinc-600">When businesses register on ServeQ, we may collect:</p>
              <ul className="list-disc list-inside text-xs sm:text-sm text-zinc-600 space-y-1 pl-2">
                <li>Business or venue name</li>
                <li>Business owner&apos;s or authorized representative&apos;s name</li>
                <li>Business address and location coordinates</li>
                <li>Contact information</li>
                <li>Business category</li>
                <li>Services offered and pricing</li>
                <li>Operating hours and availability</li>
                <li>Staff or service-provider profiles</li>
                <li>Business images, logos and descriptions</li>
                <li>Business account and verification information</li>
              </ul>
              <p className="text-xs text-zinc-500 leading-relaxed pt-1">
                This information enables businesses to manage their profiles, services, staff, bookings and customer interactions. Where payment onboarding or verification is required, additional business and identity information may be processed through our payment and verification partners.
              </p>
            </div>

            {/* 1.E */}
            <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-2xs space-y-2.5">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center text-xs font-black">E</span>
                <span>Booking and Queue Information</span>
              </h3>
              <p className="text-xs text-zinc-600">When you book a service or join a queue, we may collect:</p>
              <ul className="list-disc list-inside text-xs sm:text-sm text-zinc-600 space-y-1 pl-2">
                <li>Selected venue or business</li>
                <li>Selected service</li>
                <li>Selected staff member, where applicable</li>
                <li>Booking date and time</li>
                <li>Queue token and queue position</li>
                <li>Estimated waiting time</li>
                <li>Booking and service status</li>
                <li>Cancellation and rescheduling details</li>
                <li>Customer instructions or special requests</li>
                <li>Related booking communications</li>
              </ul>
              <p className="text-xs text-zinc-500 leading-relaxed pt-1">
                We use this information to manage bookings, operate live queues, calculate estimated waiting times, coordinate services and notify users about booking updates.
              </p>
            </div>

            {/* 1.F */}
            <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-2xs space-y-2.5">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center text-xs font-black">F</span>
                <span>Device and Technical Information</span>
              </h3>
              <p className="text-xs text-zinc-600">We may automatically collect certain technical information, including:</p>
              <ul className="list-disc list-inside text-xs sm:text-sm text-zinc-600 space-y-1 pl-2">
                <li>IP address</li>
                <li>Browser type and version</li>
                <li>Device type and operating system</li>
                <li>Usage information</li>
                <li>Log data</li>
                <li>Application performance and error information</li>
                <li>Cookies and similar technologies, where implemented</li>
              </ul>
              <p className="text-xs text-zinc-500 leading-relaxed pt-1">
                This information helps us maintain platform security, troubleshoot issues and improve our services.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-4 bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            2. How We Use Your Information
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600">We use collected information for the following purposes:</p>
          <ul className="list-disc list-inside text-xs sm:text-sm text-zinc-600 space-y-1.5 pl-2">
            <li>Creating and managing user accounts.</li>
            <li>Displaying available salons, venues and services.</li>
            <li>Providing location-based discovery.</li>
            <li>Processing bookings and queue registrations.</li>
            <li>Managing live queue positions and estimated waiting times.</li>
            <li>Processing payments, refunds and transaction records.</li>
            <li>Facilitating communication between customers and businesses.</li>
            <li>Sending booking confirmations, reminders and service notifications.</li>
            <li>Managing business onboarding and verification.</li>
            <li>Detecting fraudulent, suspicious or unauthorized activities.</li>
            <li>Improving platform performance and user experience.</li>
            <li>Complying with applicable legal and regulatory requirements.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-4 bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            3. Sharing of Information
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600">
            ServeQ may share relevant information with trusted third parties when necessary to provide our services. These may include:
          </p>
          <ul className="list-disc list-inside text-xs sm:text-sm text-zinc-600 space-y-2 pl-2">
            <li>
              <strong>Payment Service Providers:</strong> Razorpay and other applicable payment partners for payment processing, linked business accounts, transaction verification, refunds and settlements.
            </li>
            <li>
              <strong>Hosting and Infrastructure Providers:</strong> Cloud hosting, database and infrastructure providers required to operate ServeQ.
            </li>
            <li>
              <strong>Communication Providers:</strong> Email, SMS, WhatsApp or notification service providers, where used, to send booking updates and service communications.
            </li>
            <li>
              <strong>Business Partners:</strong> Relevant customer booking and service information may be shared with the selected salon or venue so that it can manage and fulfil the booking.
            </li>
            <li>
              <strong>Legal and Regulatory Authorities:</strong> Information may be disclosed when required by applicable law, regulation, court orders or lawful government requests.
            </li>
          </ul>
          <p className="text-xs sm:text-sm font-bold text-zinc-900 pt-2 border-t border-zinc-100">
            We do not sell users&apos; personal information to third parties.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-3 bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            4. Location Permissions
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Certain ServeQ features may require access to your device location. You can deny or revoke location permissions through your browser or device settings. If location access is unavailable, some location-based features may not function as intended.
          </p>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            We may also use manually selected locations to provide venue discovery services.
          </p>
        </section>

        {/* Section 5 */}
        <section className="space-y-3 bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            5. Payments and Financial Information
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            All eligible online payments are processed through authorized payment service providers. ServeQ may maintain transaction records for payment reconciliation, booking verification, refunds, business reporting and dispute resolution.
          </p>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Business payment information may be used to facilitate payment transfers and settlements through supported payment infrastructure.
          </p>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium">
            ServeQ does not guarantee payment settlement timelines independently of the payment service provider.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-3 bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            6. Data Retention
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            We retain personal information only for as long as reasonably necessary to:
          </p>
          <ul className="list-disc list-inside text-xs sm:text-sm text-zinc-600 space-y-1 pl-2">
            <li>Provide our services.</li>
            <li>Maintain booking and transaction history.</li>
            <li>Resolve disputes and customer complaints.</li>
            <li>Maintain financial and business records.</li>
            <li>Meet applicable legal and regulatory obligations.</li>
            <li>Prevent fraud and protect platform security.</li>
          </ul>
          <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed pt-2">
            When information is no longer required, we will take appropriate steps to delete, anonymize or securely dispose of it, subject to applicable legal retention requirements.
          </p>
        </section>

        {/* Section 7 */}
        <section className="space-y-3 bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            7. Data Security
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            We implement reasonable technical and organizational safeguards to protect personal information against unauthorized access, alteration, disclosure, loss or misuse. These measures may include:
          </p>
          <ul className="list-disc list-inside text-xs sm:text-sm text-zinc-600 space-y-1 pl-2">
            <li>Secure authentication mechanisms.</li>
            <li>Access controls and role-based permissions.</li>
            <li>Encrypted communication using HTTPS.</li>
            <li>Secure handling of payment integrations.</li>
            <li>Restricted access to sensitive business information.</li>
            <li>Monitoring and security controls.</li>
          </ul>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium pt-1">
            However, no internet-based platform can guarantee absolute security.
          </p>
        </section>

        {/* Section 8 */}
        <section className="space-y-3 bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            8. Cookies and Similar Technologies
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            ServeQ may use cookies, session storage or similar technologies to:
          </p>
          <ul className="list-disc list-inside text-xs sm:text-sm text-zinc-600 space-y-1 pl-2">
            <li>Maintain login sessions.</li>
            <li>Remember user preferences.</li>
            <li>Improve platform functionality.</li>
            <li>Analyze platform usage, where implemented.</li>
            <li>Protect against unauthorized activity.</li>
          </ul>
          <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed pt-1">
            You may manage cookies through your browser settings. Disabling certain cookies may affect platform functionality.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-3 bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            9. Your Rights and Choices
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            Subject to applicable laws, you may:
          </p>
          <ul className="list-disc list-inside text-xs sm:text-sm text-zinc-600 space-y-1 pl-2">
            <li>Request access to your personal information.</li>
            <li>Request correction of inaccurate information.</li>
            <li>Request deletion of personal information, subject to applicable retention requirements.</li>
            <li>Withdraw location permissions.</li>
            <li>Manage communication preferences.</li>
            <li>Raise concerns regarding the processing of your information.</li>
            <li>Request account closure.</li>
          </ul>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium pt-1">
            To exercise these rights, contact ServeQ through the contact information provided below.
          </p>
        </section>

        {/* Section 10 */}
        <section className="space-y-3 bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            10. Children&apos;s Privacy
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            ServeQ is not intentionally designed to collect personal information from children in violation of applicable laws. Where required, parental or guardian consent and other appropriate safeguards will be implemented.
          </p>
        </section>

        {/* Section 11 */}
        <section className="space-y-3 bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            11. Third-Party Services
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            ServeQ may integrate with third-party platforms and services, including payment gateways, mapping services, hosting providers and communication services. These providers may process information in accordance with their own privacy policies and applicable terms.
          </p>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium">
            We encourage users to review the privacy policies of third-party providers before using their services.
          </p>
        </section>

        {/* Section 12 */}
        <section className="space-y-3 bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            12. Changes to This Privacy Policy
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            We may update this Privacy Policy from time to time to reflect changes in our services, technology, business practices or legal requirements. Any updated version will be published on this page with a revised Last Updated date.
          </p>
          <p className="text-xs sm:text-sm text-zinc-500 font-medium">
            Continued use of ServeQ after an update will be subject to the revised Privacy Policy, to the extent permitted by applicable law.
          </p>
        </section>

        {/* Section 13 */}
        <section className="space-y-4 bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
            13. Contact and Grievance Redressal
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            For privacy-related questions, requests, complaints or concerns, you may contact us:
          </p>
          <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs sm:text-sm text-zinc-700 space-y-2">
            <p>
              <strong>Platform:</strong> ServeQ
            </p>
            <p className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-700" />
              <strong>Website:</strong>{' '}
              <a href="https://serveq.tech" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:text-emerald-800 font-semibold underline">
                https://serveq.tech
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-700" />
              <strong>Email:</strong>{' '}
              <a href="mailto:support@serveq.tech" className="text-emerald-700 hover:text-emerald-800 font-semibold underline">
                support@serveq.tech
              </a>
            </p>
          </div>
          <p className="text-xs text-zinc-500 pt-2 font-medium">
            We will review and respond to privacy-related requests in accordance with applicable legal requirements. By using ServeQ, you acknowledge that you have read and understood this Privacy Policy.
          </p>
        </section>
      </main>
    </div>
  )
}
