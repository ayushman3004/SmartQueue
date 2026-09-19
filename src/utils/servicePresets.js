export const CATEGORY_METADATA = {
  salon: { label: "Salon & Wellness", icon: "💇", defaultDuration: 30, defaultPrice: 250 },
  healthcare: { label: "Healthcare & Clinic", icon: "🏥", defaultDuration: 20, defaultPrice: 400 },
  restaurant: { label: "Restaurant & Cafe", icon: "🍽️", defaultDuration: 40, defaultPrice: 100 },
  banking: { label: "Banking & Financial", icon: "🏦", defaultDuration: 15, defaultPrice: 0 },
  retail: { label: "Retail & Fitting", icon: "🛍️", defaultDuration: 20, defaultPrice: 100 },
  government: { label: "Government & Civic", icon: "🏛️", defaultDuration: 15, defaultPrice: 50 },
  other: { label: "General Hub", icon: "🏢", defaultDuration: 15, defaultPrice: 150 },
};

export const SERVICE_PRESETS = {
  salon: [
    { name: "Haircut & Styling", duration: 30, price: 250 },
    { name: "Beard Grooming & Trim", duration: 15, price: 150 },
    { name: "Hair Spa & Scalp Therapy", duration: 35, price: 400 },
    { name: "Executive Facial Treatment", duration: 45, price: 650 },
    { name: "Head & Shoulder Massage", duration: 20, price: 200 },
  ],
  healthcare: [
    { name: "General Physician Consultation", duration: 15, price: 400 },
    { name: "Specialist Consultation", duration: 25, price: 800 },
    { name: "Diagnostic Blood Sample Collection", duration: 10, price: 200 },
    { name: "Follow-up Health Review", duration: 10, price: 150 },
  ],
  restaurant: [
    { name: "Dine-in Priority Table Reservation", duration: 45, price: 100 },
    { name: "Express Counter Takeaway Order", duration: 10, price: 0 },
    { name: "Chef's Curated Degustation Table", duration: 60, price: 350 },
  ],
  banking: [
    { name: "Teller Cash & Deposit Counter", duration: 10, price: 0 },
    { name: "Personal Loan & Financial Advisory", duration: 25, price: 0 },
    { name: "Account Opening & KYC Verification", duration: 20, price: 0 },
    { name: "Wealth Management Consultation", duration: 30, price: 0 },
  ],
  retail: [
    { name: "Personal Styling & Fitting Suite", duration: 30, price: 150 },
    { name: "Express Purchase & Gift Boxing", duration: 10, price: 0 },
    { name: "Merchandise Exchange & Helpdesk", duration: 15, price: 0 },
  ],
  government: [
    { name: "Document Verification & Attestation", duration: 20, price: 50 },
    { name: "Permit & License Renewal Desk", duration: 15, price: 100 },
    { name: "Public Grievance & Citizen Advisory", duration: 15, price: 0 },
  ],
  other: [
    { name: "Standard Consultation", duration: 15, price: 200 },
    { name: "Express Priority Window", duration: 10, price: 300 },
    { name: "Comprehensive Service Session", duration: 30, price: 500 },
  ],
};
