import { GoogleGenerativeAI } from "@google/generative-ai";
import Business from "../business/business.model.js";
import Queue from "../../queue/queue.model.js";
import { getAvailableSlots } from "../../booking/booking.service.js";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Primary and fallback models
const CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
];

/**
 * Format active businesses into compact knowledge context
 */
async function getPlatformContext() {
  try {
    const businesses = await Business.find({ isActive: true })
      .select("name category services averageServiceTime timings address location phone isOpen staff")
      .lean();

    const queues = await Queue.find({
      businessId: { $in: businesses.map((b) => b._id) },
    }).lean();

    const queueMap = new Map();
    queues.forEach((q) => {
      queueMap.set(q.businessId.toString(), q.users || []);
    });

    const summary = businesses.map((b) => {
      const qUsers = queueMap.get(b._id.toString()) || [];
      const serving = qUsers.find((u) => u.status === "serving");
      const servingToken = serving ? qUsers.indexOf(serving) + 1 : null;

      const servicesList = (b.services || [])
        .map((s) => `${s.name} (₹${s.price}, ${s.duration} mins)`)
        .join("; ");

      const staffList = (b.staff || [])
        .map((s) => `${s.name} (${s.role || (b.category === "salon" ? "Barber" : "Doctor")})`)
        .join("; ");

      return `- **${b.name}** [ID: ${b._id}]:
  * Type: ${b.category === "salon" ? "Salon & Hair Studio" : "Medical Clinic & Healthcare"}
  * Status: ${b.isOpen ? "OPEN NOW" : "CLOSED"}
  * Location: ${b.address || b.location || "Local Hub"} | Phone: ${b.phone || "N/A"}
  * Operating Timings: ${b.timings?.open || "09:00"} to ${b.timings?.close || "18:00"}
  * Live Queue: ${qUsers.length} waiting | Now Serving Token: ${servingToken ? `#${servingToken}` : "Idle"}
  * Catalog Services: ${servicesList || "General Service (₹" + (b.basePrice || 0) + ")"}
  * Active Staff: ${staffList || "Verified Team"}`;
    });

    return { businesses, summary: summary.join("\n\n") };
  } catch (err) {
    console.warn("Could not compile live platform context:", err.message);
    return { businesses: [], summary: "Multiple verified salons and clinics active on serveQ." };
  }
}

/**
 * Check if the user is asking about slot availability and fetch live slots if applicable
 */
async function checkSlotAvailability(message, businesses) {
  const lower = message.toLowerCase();
  const isSlotQuery =
    lower.includes("slot") ||
    lower.includes("available") ||
    lower.includes("appointment") ||
    lower.includes("free time") ||
    lower.includes("when can i") ||
    lower.includes("openings") ||
    lower.includes("timing") ||
    lower.includes("schedule");

  if (!isSlotQuery || businesses.length === 0) return null;

  // Find targeted business by name match
  let targetBiz = null;
  for (const b of businesses) {
    const nameLower = b.name.toLowerCase();
    if (lower.includes(nameLower)) {
      targetBiz = b;
      break;
    }
    const words = nameLower.split(/\s+/).filter((w) => w.length > 3);
    if (words.some((w) => lower.includes(w))) {
      targetBiz = b;
      break;
    }
  }

  // Fallback: match by category if generic question
  if (!targetBiz) {
    if (lower.includes("clinic") || lower.includes("doctor")) {
      targetBiz = businesses.find((b) => b.category === "clinic" || b.category === "healthcare");
    } else if (lower.includes("salon") || lower.includes("barber")) {
      targetBiz = businesses.find((b) => b.category === "salon");
    } else if (businesses.length === 1) {
      targetBiz = businesses[0];
    }
  }

  if (!targetBiz) {
    // If multiple businesses exist and none was specifically targeted, prepare a quick summary of slots for the top 2
    try {
      const today = new Date();
      const summaries = [];
      for (const b of businesses.slice(0, 3)) {
        const slotData = await getAvailableSlots(b._id, today);
        const open = (slotData.slots || []).filter((s) => s.available);
        summaries.push(`- **${b.name}**: ${open.length} slots available today`);
      }
      return {
        isGeneral: true,
        summary: `Current Available Slots Overview:\n${summaries.join("\n")}`,
      };
    } catch {
      return null;
    }
  }

  try {
    const today = new Date();
    const slotData = await getAvailableSlots(targetBiz._id, today);
    const openSlots = (slotData.slots || []).filter((s) => s.available);
    const openTimes = openSlots.map((s) =>
      new Date(s.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );

    return {
      businessName: targetBiz.name,
      businessId: targetBiz._id,
      totalSlots: slotData.slots.length,
      availableCount: openSlots.length,
      availableTimes: openTimes,
      avgServiceTime: slotData.avgServiceTime || targetBiz.averageServiceTime || 15,
      summary: `LIVE REAL-TIME SLOT AVAILABILITY FOR "${targetBiz.name}":
- Total Slots in Schedule: ${slotData.slots.length}
- Number of Currently Available Open Slots: ${openSlots.length}
- Specific Available Slot Times: ${openTimes.length > 0 ? openTimes.slice(0, 15).join(", ") : "No slots currently open for today"}
- Average Consultation/Service Duration: ${slotData.avgServiceTime || targetBiz.averageServiceTime || 15} minutes`,
    };
  } catch (err) {
    console.warn(`Could not compute live slots for ${targetBiz.name}:`, err.message);
    return null;
  }
}

/**
 * Intelligent deterministic fallback response if Gemini is unreachable
 */
function getDeterministicResponse(message, businesses, slotContext) {
  const lower = message.toLowerCase();

  if (slotContext?.businessName) {
    if (slotContext.availableCount === 0) {
      return `Currently, there are no open appointment slots remaining today for **${slotContext.businessName}**. However, you can join their live virtual queue right now from the dashboard or choose an appointment for tomorrow!`;
    }
    const sampleTimes = slotContext.availableTimes.slice(0, 6).join(", ");
    return `We currently have **${slotContext.availableCount} available slots** for **${slotContext.businessName}** today! Open slot times include: **${sampleTimes}** (and more). Which time would you prefer to reserve?`;
  }

  if (lower.includes("salon") || lower.includes("haircut") || lower.includes("barber")) {
    const salons = businesses.filter((b) => b.category === "salon");
    if (salons.length > 0) {
      const s = salons[0];
      return `Welcome to serveQ! For salon and grooming services, we have **${s.name}** active with live virtual queues and services like haircut, beard styling, and coloring. You can join the queue online and walk in without waiting!`;
    }
  }

  if (lower.includes("clinic") || lower.includes("doctor")) {
    const clinics = businesses.filter((b) => b.category === "clinic" || b.category === "healthcare");
    if (clinics.length > 0) {
      const c = clinics[0];
      return `Welcome to serveQ! For medical and clinic visits, **${c.name}** is active on the platform. You can check available consultation slots or grab a virtual queue token so you don't have to wait in a crowded lobby.`;
    }
  }

  return `Hello! I am your serveQ Assistant. I can help you check live queue lengths, find open appointment slots for salons and clinics, and guide you on booking services. Which venue or service are you interested in today?`;
}

/**
 * Main chat handler: processes customer message using gemini-3.8-flash
 */
export const processMessage = async (message, businessInfo) => {
  try {
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) {
      return {
        reply: "Hello! How can I assist you with serveQ queues and appointments today?",
        intent: "greeting",
        extractedData: {},
        actionRequired: false,
      };
    }

    // 1. Gather live database platform context
    const { businesses, summary: businessSummary } = await getPlatformContext();

    // 2. Compute live slot availability if applicable
    const slotContext = await checkSlotAvailability(cleanMessage, businesses);

    // 3. Fallback immediately if no Gemini API key configured
    if (!genAI) {
      const fallbackReply = getDeterministicResponse(cleanMessage, businesses, slotContext);
      return {
        reply: fallbackReply,
        intent: slotContext ? "query_slots" : "general_faq",
        extractedData: slotContext || {},
        actionRequired: false,
      };
    }

    // 4. Construct fine-tuned domain system prompt
    const systemPrompt = `You are serveQ Assistant, the specialized AI concierge for the serveQ multi-venue virtual queue and appointment booking platform.

CORE KNOWLEDGE BASE & SERVEQ PLATFORM INFO:
1. WHAT IS SERVEQ:
   serveQ is an intelligent SaaS platform for Salons & Hair Studios, and Medical Clinics & Doctors.
   - Customers can view present queues live, join queues from their phone (virtual token), monitor live wait times, and walk straight into the salon/clinic when called.
   - Customers can also book scheduled appointment slots in advance with pre-payment via their in-app wallet.
   - Instant automated wallet refunds if an appointment is cancelled.
   - Live queues sync in real-time (<10ms WebSocket latency).

2. VERIFIED BUSINESSES CURRENTLY ACTIVE ON SERVEQ:
${businessSummary}

${slotContext ? `3. LIVE REAL-TIME APPOINTMENT AVAILABILITY:\n${slotContext.summary}\n` : ""}

STRICT OPERATING GUIDELINES (FINE-TUNING):
1. DOMAIN RESTRICTION: You MUST ONLY answer questions related to serveQ, its verified salons and clinics, services offered, prices, barbers/doctors, live queue tokens, and appointment slot availability.
   If a user asks about anything unrelated (e.g. general coding, trivia, recipes, weather, politics), politely decline: "I am serveQ Assistant and can only help with serveQ venues, live queues, services, and appointment bookings."
2. SLOT AVAILABILITY INQUIRIES:
   - When the customer asks about slot availability for a business, state the exact number of open slots currently available.
   - List specific available slot times (e.g., 9:00 AM, 10:15 AM, 2:30 PM).
   - Ask the customer which of these slot times they prefer, and explain that they can book it under "Book Time Slot" or join the live queue right now.
3. CONVERSATIONAL STYLE:
   - Friendly, professional, concise, and helpful.
   - Do NOT use technical jargon, do NOT mention JSON, schemas, or backend details.
   - Provide direct, formatted text responses with emojis where fitting.`;

    const userPrompt = `Customer Query: "${cleanMessage}"
Provide your direct, friendly response to the customer:`;

    // 5. Try candidate models: primary gemini-3.8-flash, followed by gemini-3.5-flash and gemini-3.7-flash
    let rawReply = null;
    let modelUsed = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });

        const result = await model.generateContent(userPrompt);
        const text = result?.response?.text();
        if (text && text.trim()) {
          rawReply = text.trim();
          modelUsed = modelName;
          break;
        }
      } catch (err) {
        console.warn(`⚠️ Chatbot attempt with ${modelName} failed:`, err.message);
      }
    }

    if (rawReply) {
      return {
        reply: rawReply,
        intent: slotContext ? "query_slots" : "general_faq",
        extractedData: slotContext || {},
        actionRequired: false,
        modelUsed,
      };
    }

    // 6. Graceful deterministic fallback if API models are unresponsive
    const fallbackReply = getDeterministicResponse(cleanMessage, businesses, slotContext);
    return {
      reply: fallbackReply,
      intent: slotContext ? "query_slots" : "general_faq",
      extractedData: slotContext || {},
      actionRequired: false,
    };
  } catch (err) {
    console.error("❌ Chatbot processMessage top-level error:", err);
    return {
      reply: "Hello! I am your serveQ assistant. How can I help you with live queues, salons, clinics, or available booking slots today?",
      intent: "greeting",
      extractedData: {},
      actionRequired: false,
    };
  }
};
