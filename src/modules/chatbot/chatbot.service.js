import mongoose from "mongoose";
import {
  executeOpenRouterChat,
  getOpenRouterApiKeys,
} from "../../../ai/openrouter.client.js";
import Business from "../business/business.model.js";
import Queue from "../../queue/queue.model.js";
import { getAvailableSlots } from "../../booking/booking.service.js";

/**
 * Removes all emojis and asterisks from assistant text to ensure clean professional formatting
 */
function cleanAssistantText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/[*_~`]/g, "") // Strip asterisks, underscores, and backticks
    .replace(
      /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu,
      ""
    ) // Strip emojis
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Format active businesses into compact knowledge context
 */
async function getPlatformContext() {
  try {
    if (mongoose.connection.readyState !== 1) {
      return { businesses: [], summary: "Multiple verified salons and clinics active on serveQ." };
    }
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
        .map((s) => `${s.name} (Rs. ${s.price}, ${s.duration} mins)`)
        .join("; ");

      const staffList = (b.staff || [])
        .map((s) => `${s.name} (${s.role || (b.category === "salon" ? "Barber" : "Doctor")})`)
        .join("; ");

      return `- ${b.name} [ID: ${b._id}]:
    Category: ${b.category === "salon" ? "Salon and Hair Studio" : "Medical Clinic and Healthcare"}
    Status: ${b.isOpen ? "OPEN NOW" : "CLOSED"}
    Location: ${b.address || b.location || "Local Hub"} | Phone: ${b.phone || "N/A"}
    Operating Timings: ${b.timings?.open || "09:00"} to ${b.timings?.close || "18:00"}
    Live Queue: ${qUsers.length} waiting | Serving Token: ${servingToken ? "#" + servingToken : "Idle"}
    Catalog Services: ${servicesList || "General Service"}
    Active Staff: ${staffList || "Verified Team"}`;
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
    try {
      const today = new Date();
      const summaries = [];
      for (const b of businesses.slice(0, 3)) {
        const slotData = await getAvailableSlots(b._id, today);
        const open = (slotData.slots || []).filter((s) => s.available);
        summaries.push(`- ${b.name}: ${open.length} slots available today`);
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
 * Deterministic fallback response if OpenRouter / AI is unreachable
 */
function getDeterministicResponse(message, businesses, slotContext) {
  const lower = message.toLowerCase();

  if (slotContext?.businessName) {
    if (slotContext.availableCount === 0) {
      return `Currently, there are no open appointment slots remaining today for ${slotContext.businessName}. You can join their live virtual queue from the dashboard or choose an appointment for tomorrow.`;
    }
    const sampleTimes = slotContext.availableTimes.slice(0, 6).join(", ");
    return `We currently have ${slotContext.availableCount} available slots for ${slotContext.businessName} today. Available times include: ${sampleTimes}. Which time would you prefer to reserve?`;
  }

  if (lower.includes("salon") || lower.includes("haircut") || lower.includes("barber")) {
    const salons = businesses.filter((b) => b.category === "salon");
    if (salons.length > 0) {
      const s = salons[0];
      return `Welcome to serveQ. For salon and grooming services, ${s.name} is active with live virtual queues and services including haircut, beard styling, and coloring. You can join the queue online and walk in when called.`;
    }
  }

  if (lower.includes("clinic") || lower.includes("doctor")) {
    const clinics = businesses.filter((b) => b.category === "clinic" || b.category === "healthcare");
    if (clinics.length > 0) {
      const c = clinics[0];
      return `Welcome to serveQ. For medical and clinic visits, ${c.name} is active on the platform. You can check available consultation slots or join a virtual queue to avoid waiting in the lobby.`;
    }
  }

  return `Hello. I am the serveQ assistant. I can help you check live queue lengths, find open appointment slots for salons and clinics, and guide you on booking services. Which venue or service are you interested in today?`;
}

/**
 * Main chat handler: processes customer message using OpenAI SDK via OpenRouter
 */
export const processMessage = async (message, businessInfo) => {
  try {
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) {
      return {
        reply: "Hello. How can I assist you with serveQ queues and appointments today?",
        intent: "greeting",
        extractedData: {},
        actionRequired: false,
      };
    }

    // Instant response for casual greetings to eliminate network and LLM latency
    const isPureGreeting =
      /^(hi|hello|hey|heyy|heya|hola|namaste|good\s*(morning|afternoon|evening)|greetings)[\s!.]*$/i.test(
        cleanMessage
      );
    if (isPureGreeting) {
      return {
        reply:
          "Hello. Welcome to serveQ. I am your virtual concierge. I can help you check live queue wait times, view service prices, see available doctors or stylists, or find open appointment slots. Which salon or clinic can I help you with today?",
        intent: "greeting",
        extractedData: {},
        actionRequired: false,
      };
    }

    // 1. Gather live database platform context
    const { businesses, summary: businessSummary } = await getPlatformContext();

    // 2. Compute live slot availability if applicable
    const slotContext = await checkSlotAvailability(cleanMessage, businesses);

    // 3. Fallback immediately if no OpenRouter API key configured
    const keys = getOpenRouterApiKeys();
    if (keys.length === 0) {
      const fallbackReply = cleanAssistantText(
        getDeterministicResponse(cleanMessage, businesses, slotContext)
      );
      return {
        reply: fallbackReply,
        intent: slotContext ? "query_slots" : "general_faq",
        extractedData: slotContext || {},
        actionRequired: false,
      };
    }

    // 4. Construct fine-tuned domain system prompt with strict formatting rules
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

STRICT OPERATING & FORMATTING GUIDELINES:
1. NO EMOJIS: Do not include any emojis, symbols, or pictograms in your response under any circumstances.
2. NO ASTERISKS: Do not use asterisks (*) or double asterisks (**) anywhere in your response. Do not use markdown bold or italic markers.
3. PROFESSIONAL STRUCTURE: Write in clear, professional English. Use line breaks between paragraphs. For lists, use a plain hyphen (-) or numbered lists (1., 2.).
4. DOMAIN RESTRICTION: Answer strictly about serveQ, verified salons and clinics, services, prices, staff, live queue tokens, and appointment slot availability. If a user asks about anything unrelated, politely decline.
5. SLOT AVAILABILITY INQUIRIES: State the number of open slots and list specific available times clearly.`;

    const userPrompt = `Customer Query: "${cleanMessage}"
Provide your direct, professional response without using any emojis or asterisks:`;

    // 5. Execute chat completion via OpenRouter with OpenAI SDK
    const result = await executeOpenRouterChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      maxTokens: 500,
      timeoutMs: 12000,
    });

    if (result.success && result.content) {
      const sanitizedReply = cleanAssistantText(result.content);
      return {
        reply: sanitizedReply,
        intent: slotContext ? "query_slots" : "general_faq",
        extractedData: slotContext || {},
        actionRequired: false,
        modelUsed: result.modelUsed,
        keyMasked: result.keyMasked,
      };
    }

    // 6. Graceful deterministic fallback if API models are unresponsive or quota exhausted
    const fallbackReply = cleanAssistantText(
      getDeterministicResponse(cleanMessage, businesses, slotContext)
    );
    return {
      reply: fallbackReply,
      intent: slotContext ? "query_slots" : "general_faq",
      extractedData: slotContext || {},
      actionRequired: false,
    };
  } catch (err) {
    console.error("Chatbot processMessage top-level error:", err);
    return {
      reply:
        "Hello. I am the serveQ assistant. How can I help you with live queues, salons, clinics, or available booking slots today?",
      intent: "greeting",
      extractedData: {},
      actionRequired: false,
    };
  }
};
