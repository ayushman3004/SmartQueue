export const SITE_URL = 'https://www.serveq.tech'

// Shared by the router, build output and sitemap so discovery cannot drift.
export const publicPages = [
  { path: '/', title: 'Clinic Queues, Digital Prescriptions & Follow-up Reminders', description: 'Help patients spend less time waiting with live clinic queues, digital prescriptions, and automatic follow-up reminders via WhatsApp.' },
  { path: '/business', title: 'ServeQ for Clinics — Apply to Join', description: 'Manage patient queues, appointments, and digital prescriptions. Send automatic follow-up reminders with WhatsApp opt-in.' },
  { path: '/support', title: 'Help & Support — ServeQ', description: 'Get in touch with the ServeQ support team for help with your queues, appointments, and business account.' },
  { path: '/privacy', title: 'Privacy Policy — serveQ', description: 'Learn how serveQ collects, uses, stores, processes, and protects your personal information, venue data, and payment details.' },
  { path: '/terms', title: 'Terms and Conditions', description: 'Review the terms and conditions for using serveQ, including virtual queue tokens, appointments, cancellations, and venue management.' },
  { path: '/about', title: 'About Us — Our Story & Founders', description: 'Meet Ayushman and Ritika, the founder and cofounder of serveQ, and discover why we are building a better way to wait at clinics.' },
  {
    path: '/how-it-works', title: 'How serveQ Works', description: 'Learn how to find a venue, join a virtual queue, follow your turn, and book an available appointment with serveQ.',
    sections: [
      ['Find your service', 'Sign in to the customer portal and choose a clinic. Set your location to see participating venues, then review the services and available staff before choosing where to visit.'],
      ['Choose a queue or appointment', 'Join a live queue for a walk-in service, or open the booking page to choose an available date and time slot. Availability depends on the venue and its operating hours. Review the service and any payment details before confirming.'],
      ['Follow your turn', 'Open your queue pass to check your current position and estimated wait. Estimates can change as earlier services finish or take longer. Keep your queue page available and allow notifications if you want turn updates.'],
      ['Manage your visit', 'Use your booking history to review appointments and available cancellation options. For questions about a specific service or arrival time, contact the venue. For account or platform issues, use serveQ support.'],
    ],
  },
  {
    path: '/virtual-queue', title: 'Virtual Queue Management', description: 'Understand virtual queues, live queue positions, and estimated wait times for visits to participating clinics.',
    sections: [
      ['A place in line on your phone', 'A virtual queue lets you follow a service line without standing at the counter throughout the wait. On serveQ, customers choose a participating venue and join its live queue from their account.'],
      ['Queue positions and wait estimates', 'Your queue pass shows your position and an estimated wait. These are live estimates rather than guaranteed appointment times: staff availability, service length, and changes in the line can affect when you are called.'],
      ['Queues and appointments serve different needs', 'A queue is useful when you want the next available turn. An appointment lets you choose an available slot in advance. Check the venue and service details to decide which option suits your visit.'],
      ['Stay ready for your turn', 'Keep an eye on your live status, plan travel time, and follow the venue’s arrival instructions. If you cannot attend, use the available leave or cancellation action so the venue can serve the next customer.'],
    ],
  },
  {
    path: '/for-clinics', title: 'Queue Management for Clinics', description: 'Reduce waiting with live clinic queues, digital prescriptions, and automatic patient follow-up reminders.',
    sections: [
      ['Organize patient arrivals', 'Clinic visits can combine walk-in demand with planned appointments. serveQ gives participating clinics tools to manage live queues and appointment availability while customers follow their visit status from their phone.'],
      ['Configure services and practitioners', 'Use the business portal to set up your clinic profile, offered services, staff, and operating schedule. Keep these details current so customers can choose an appropriate service and available practitioner.'],
      ['Manage the line during the day', 'The business dashboard helps staff follow the active queue and update service progress. Customers can check their live position and estimated wait, reducing the need to ask the counter for repeated status updates.'],
      ['Continue care after the visit', 'Doctors can issue digital prescriptions and set a follow-up date. Patients can find the prescription in their visit history and opt in to WhatsApp reminders after verifying their phone number.'],
      ['Set clear expectations', 'Consultations vary in length, and wait estimates may change. Keep arrival instructions clear and contact the clinic directly for urgent needs. serveQ manages queues and bookings; it does not provide medical advice or emergency care.'],
    ],
  },
]

export const guidePages = publicPages.filter(page => page.sections)
export const canonicalUrl = path => `${SITE_URL}${path === '/' ? '' : path.replace(/\/+$/, '')}`
export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

// The same guide HTML is rendered at build time and in the React route.
export function renderGuide(page) {
  return `<article class="mx-auto w-full max-w-4xl px-6 py-12 sm:py-20 text-zinc-900"><nav aria-label="Main navigation" class="flex flex-wrap gap-6 mb-12 text-sm font-semibold"><a href="/">serveQ Home</a><a href="/business">For clinics</a><a href="/support">Support</a></nav><h1 class="text-4xl sm:text-5xl font-bold tracking-tight mb-6">${escapeHtml(page.title)}</h1><p class="text-lg text-zinc-600 leading-relaxed mb-12">${escapeHtml(page.description)}</p>${page.sections.map(([heading, text]) => `<section class="mb-10"><h2 class="text-2xl font-semibold mb-3">${escapeHtml(heading)}</h2><p class="text-base leading-relaxed text-zinc-600">${escapeHtml(text)}</p></section>`).join('')}<nav aria-label="Get started" class="flex flex-wrap gap-6 py-6 font-semibold"><a href="/customers">Find a clinic</a><a href="/business">Open the business portal</a></nav><nav aria-label="Related guides" class="flex flex-wrap gap-6 border-t border-zinc-200 pt-6 text-sm">${guidePages.filter(other => other.path !== page.path).map(other => `<a href="${other.path}">${escapeHtml(other.title)}</a>`).join('')}</nav></article>`
}
