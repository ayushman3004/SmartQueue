const BASIC_CLINIC_LIMIT = 3;
const PRO_CLINIC_LIMIT = 5;

export const SUBSCRIPTION_PLANS = {
  BASIC: {
    id: "BASIC",
    name: "Basic — Essential Clinic Operations",
    price: 799,
    amountInPaise: 79900,
    interval: "monthly",
    durationDays: 30,
    maxActiveClinics: BASIC_CLINIC_LIMIT,
    tagline: "Run the daily queue, bookings, and walk-in visits.",
    features: [
      "Virtual queues and appointment scheduling",
      `Up to ${BASIC_CLINIC_LIMIT} active clinics or service providers`,
      "Walk-in registration and queue management alongside appointments",
      "Counter payments with UPI QR codes and cash tracking",
      "Live web wait-time updates and queue notifications",
      "Digital prescriptions and opt-in WhatsApp prescription notices",
      "Opt-in WhatsApp appointment reminders where templates are configured",
      "Email support",
    ],
    plannedFeatures: [
      "Community support",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro — Advanced Clinic Management",
    price: 1499,
    amountInPaise: 149900,
    interval: "monthly",
    durationDays: 30,
    maxActiveClinics: PRO_CLINIC_LIMIT,
    tagline: "Everything in Basic, plus expanded clinic capacity and AI analytics.",
    features: [
      `Up to ${PRO_CLINIC_LIMIT} active clinics`,
      "Multi-room queue views",
      "AI-powered peak-hour and revenue analytics",
      "Configurable WhatsApp queue-turn alerts where templates are configured",
      "Opt-in WhatsApp follow-up reminders where templates are configured",
      "Multi-service sequencing for queues and appointments with the assigned doctor",
    ],
    plannedFeatures: [
      "Dedicated account manager and 24/7 phone support",
    ],
  },
};
