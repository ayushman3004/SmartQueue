import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Predicts service time in minutes using Gemini AI.
 * Falls back to a calculated default if the API fails or returns invalid data.
 */
export const predictServiceTime = async (context) => {
  if (!genAI) return getFallback(context);

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a service time prediction AI for a queue management system.
    
    Predict the estimated service time in minutes for ONE customer based on:
    - Service Type: ${context.serviceType} (Base expected time is ${context.baseDuration} minutes)
    - Customer Type: ${context.userType}
    - Hour of day (24h): ${context.timeOfDay}
    - Current queue length: ${context.queueLength} people

    Return ONLY a single integer number (no text, no units). Example: 12`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const minutes = parseInt(text.match(/\d+/)?.[0]);

    if (!minutes || minutes < 3 || minutes > 120) {
      return getFallback(context);
    }

    return minutes;
  } catch (err) {
    console.warn("⚠️ Gemini AI prediction fallback triggered:", err.message);
    return getFallback(context);
  }
};

/**
 * Intelligent deterministic fallback for service time
 */
const getFallback = (context) => {
  const { timeOfDay, queueLength } = context;
  const baseTimes = {
    banking: 12,
    healthcare: 20,
    restaurant: 15,
    retail: 8,
    salon: 25,
    government: 25,
    general: 10,
  };

  const base = context.baseDuration || baseTimes[context.serviceType?.toLowerCase()] || 10;
  const isPeak = [9, 10, 11, 13, 14, 17, 18].includes(Number(timeOfDay));
  const peakMultiplier = isPeak ? 1.3 : 1.0;
  const queueFactor = Math.min(1 + (queueLength || 0) * 0.05, 1.5);

  return Math.round(base * peakMultiplier * queueFactor);
};

/**
 * AI Analytics: Peak Hours, Cancellation Trends, and Review Analysis
 * Includes reliable deterministic fallback when AI is unavailable.
 */
export const generateBusinessAIAnalytics = async ({ businessName, category, bookingsCount, cancellationCount, averageRating, recentReviews = [] }) => {
  // Deterministic fallback generator
  const getHeuristicAnalytics = () => {
    const cancelRate = bookingsCount > 0 ? Math.round((cancellationCount / bookingsCount) * 100) : 0;
    
    const peakWindows = category === "restaurant"
      ? ["12:30 PM - 2:30 PM", "7:30 PM - 9:30 PM"]
      : category === "salon"
      ? ["11:00 AM - 1:00 PM", "4:00 PM - 7:00 PM"]
      : ["10:00 AM - 1:00 PM", "4:00 PM - 6:00 PM"];

    const sentiment = averageRating >= 4.5
      ? "Exceptional positive customer sentiment with high retention."
      : averageRating >= 3.5
      ? "Generally positive feedback with minor delays noted during peak slots."
      : "Service delays flagged; recommend adjusting staff allocation during busy hours.";

    const recommendations = [
      `Peak traffic observed around ${peakWindows.join(" and ")}.`,
      cancelRate > 15
        ? `Cancellation rate is ${cancelRate}%. Consider sending automated reminders 15 minutes before appointments.`
        : `Healthy cancellation rate (${cancelRate}%). Queue pacing is optimal.`,
      `Customer satisfaction score: ${averageRating ? averageRating.toFixed(1) : "5.0"}/5.0 based on recent visits.`,
    ];

    return {
      peakHours: peakWindows,
      cancellationRate: `${cancelRate}%`,
      sentimentSummary: sentiment,
      recommendations,
      isAiGenerated: false,
    };
  };

  if (!genAI) {
    return getHeuristicAnalytics();
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are a business analytics advisor for a queue management platform.
    Analyze this business:
    - Name: ${businessName}
    - Category: ${category}
    - Total Bookings: ${bookingsCount}
    - Total Cancellations: ${cancellationCount}
    - Average Rating: ${averageRating}/5
    - Recent Customer Comments: ${recentReviews.map((r) => `"${r.comment}" (${r.rating} stars)`).join("; ") || "No written comments yet"}

    Respond ONLY in valid JSON matching this exact structure (no markdown fences, no extra text):
    {
      "peakHours": ["string", "string"],
      "cancellationRate": "string",
      "sentimentSummary": "string",
      "recommendations": ["string", "string", "string"]
    }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return getHeuristicAnalytics();

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ...parsed,
      isAiGenerated: true,
    };
  } catch (err) {
    console.warn("⚠️ Gemini AI analytics fallback triggered:", err.message);
    return getHeuristicAnalytics();
  }
};
