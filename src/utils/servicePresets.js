// Extensible list of allowed business categories
// Currently restricted to salon and clinic, but can easily add further similar categories here (e.g. 'spa', 'dental')
export const ALLOWED_CATEGORIES = ['salon', 'clinic']

export const CATEGORY_METADATA = {
  salon: { label: "Salon & Wellness", icon: "💇", defaultDuration: 30, defaultPrice: 250 },
  clinic: { label: "Clinic & Healthcare", icon: "🏥", defaultDuration: 20, defaultPrice: 400 },
  healthcare: { label: "Clinic & Healthcare", icon: "🏥", defaultDuration: 20, defaultPrice: 400 }, // alias for backward compatibility
  other: { label: "General Service Hub", icon: "🏢", defaultDuration: 15, defaultPrice: 150 },
}

export const SERVICE_PRESETS = {
  salon: [
    { name: "Haircut & Styling", duration: 30, price: 250 },
    { name: "Beard Grooming & Trim", duration: 15, price: 150 },
    { name: "Hair Spa & Scalp Therapy", duration: 35, price: 400 },
    { name: "Executive Facial Treatment", duration: 45, price: 650 },
    { name: "Head & Shoulder Massage", duration: 20, price: 200 },
  ],
  clinic: [
    { name: "General Physician Consultation", duration: 15, price: 400 },
    { name: "Specialist Consultation", duration: 25, price: 800 },
    { name: "Diagnostic Blood Sample Collection", duration: 10, price: 200 },
    { name: "Follow-up Health Review", duration: 10, price: 150 },
    { name: "Vitals Check & Prescription Refill", duration: 10, price: 100 },
  ],
  healthcare: [
    { name: "General Physician Consultation", duration: 15, price: 400 },
    { name: "Specialist Consultation", duration: 25, price: 800 },
    { name: "Diagnostic Blood Sample Collection", duration: 10, price: 200 },
    { name: "Follow-up Health Review", duration: 10, price: 150 },
  ],
  other: [
    { name: "Standard Consultation", duration: 15, price: 200 },
    { name: "Express Priority Window", duration: 10, price: 300 },
    { name: "Comprehensive Service Session", duration: 30, price: 500 },
  ],
}
