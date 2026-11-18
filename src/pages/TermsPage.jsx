import LegalPageLayout from '../components/LegalPageLayout'
import { useSeo } from '../utils/useSeo'

export default function TermsPage() {
  useSeo({
    title: 'Terms and Conditions',
    description: 'Review the terms and conditions for using serveQ, including virtual queue tokens, appointments, cancellations, and venue management.',
    robots: 'index, follow',
    canonical: 'https://www.serveq.tech/terms',
  })

  return (
    <LegalPageLayout
      title="Terms and Conditions"
      label="Terms of service"
      updated="Effective Date: October 13, 2026 • Last updated: October 2026"
    >
      {/* Notice Callout */}
      <div className="legal-notice">
        <p className="font-bold">
          Note for Legal Review:
        </p>
        <p>
          These terms govern standard use of the serveQ web application and queue services. Governing law, specific dispute resolution forum, and registered corporate identity require legal confirmation.
        </p>
      </div>

      {/* Content Sections */}
      <section className="space-y-4">
        <h2 className="legal-section-title">
          1. Acceptance of Terms
        </h2>
        <p className="legal-copy">
          By creating an account, accessing, or using serveQ (the "Platform"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, do not access or use our services.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="legal-section-title">
          2. Customer Virtual Queue & Token Rules
        </h2>
        <p className="legal-copy">
          When joining a live virtual queue:
        </p>
        <ul className="legal-list">
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
        <h2 className="legal-section-title">
          3. Appointments, Deposits & Refunds
        </h2>
        <p className="legal-copy">
          The Platform provides appointment reservation tools and wallet-based deposits:
        </p>
        <ul className="legal-list">
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
        <h2 className="legal-section-title">
          4. Business & Hub Owner Responsibilities
        </h2>
        <p className="legal-copy">
          Venues and business operators using the Hub Command Center agree to:
        </p>
        <ul className="legal-list">
          <li>Maintain accurate operating hours, service catalog details, and pricing.</li>
          <li>Advance queues fairly and accurately reflect counter operational status.</li>
          <li>Promptly communicate unexpected delays through the queue system.</li>
          <li>Honor valid bookings and appointments scheduled through the Platform.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="legal-section-title">
          5. Intellectual Property
        </h2>
        <p className="legal-copy">
          All rights, title, and interest in serveQ, including brand assets, logos, user interface components, software, and real-time queuing algorithms, remain the exclusive property of serveQ. You may not copy, reverse engineer, or redistribute platform assets without prior written consent.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="legal-section-title">
          6. Limitation of Liability
        </h2>
        <p className="legal-copy">
          serveQ provides virtual queue and scheduling software. Actual service delivery, professional treatments, and in-person consultations are the sole responsibility of the independent venue operator. To the maximum extent permitted by applicable law, serveQ shall not be liable for venue service disputes, scheduling adjustments made by venues, or indirect damages.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="legal-section-title">
          7. Contact & Legal Notices
        </h2>
        <p className="legal-copy">
          For contractual inquiries, terms clarification, or official notices, contact:
        </p>
        <div className="legal-contact">
          <p className="font-bold text-zinc-950">serveQ Legal Counsel</p>
          <p>
            Email:{' '}
            <a href="mailto:legal@serveq.tech" className="legal-link">
              legal@serveq.tech
            </a>
          </p>
          <p>
            Support:{' '}
            <a href="mailto:support@serveq.tech" className="legal-link">
              support@serveq.tech
            </a>
          </p>
          <p className="text-zinc-500 pt-1">
            [Registered Legal Entity name and Jurisdiction pending confirmation by website owner]
          </p>
        </div>
      </section>
    </LegalPageLayout>
  )
}
