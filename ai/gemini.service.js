import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Predicts service time in minutes using Gemini AI.
 * Falls back to a calculated default if the API fails or returns invalid data.
 */
export const predictServiceTime = async (context) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a service time prediction AI for a queue management management system.
    
    Predict the estimated service time in minutes for ONE customer based on:
    - Service Type: ${context.serviceType} (Base expected time is ${context.baseDuration} minutes)
    - Customer Type: ${context.userType}
    - Hour of day (24h): ${context.timeOfDay}
    - Current queue length: ${context.queueLength} people

    Consider: peak hours (9-11am, 1-3pm, 5-7pm) increase times, complex service types take longer, larger queues may mean tired staff.

    Return ONLY a single integer number (no text, no units). Example: 12`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const minutes = parseInt(text.match(/\d+/)?.[0]);

    // Sanity check
    if (!minutes || minutes < 3 || minutes > 120) {
      console.log(
        `🧠 Gemini AI raw response: "${text}" → invalid, using fallback`,
      );
      return getFallback(context);
    }

    console.log(
      `🧠 Gemini AI prediction: ${minutes} min (service: ${context.serviceType}, hour: ${context.timeOfDay}, queue: ${context.queueLength})`,
    );
    return minutes;
  } catch (err) {
    console.error("⚠️ Gemini AI fallback triggered:", err.message);
    return getFallback(context);
  }
};

/**
 * Intelligent fallback when Gemini API fails
 */
const getFallback = (context) => {
  const { serviceType, timeOfDay, queueLength } = context;
  const baseTimes = {
    banking: 12,
    healthcare: 20,
    restaurant: 15,
    retail: 8,
    government: 25,
    general: 10,
  };

  const base = context.baseDuration || baseTimes[context.serviceType?.toLowerCase()] || 10;

  // Peak hour multiplier
  const isPeak = [9, 10, 11, 13, 14, 17, 18].includes(Number(timeOfDay));
  const peakMultiplier = isPeak ? 1.3 : 1.0;

  // Queue pressure
  const queueFactor = Math.min(1 + (queueLength || 0) * 0.05, 1.5);

  return Math.round(base * peakMultiplier * queueFactor);
};
