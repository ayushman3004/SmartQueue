import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const processMessage = async (message, businessInfo) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are an AI assistant for the serveQ platform.
      Platform Context: A multi-industry queue and booking management SaaS.
      
      Current Business: ${JSON.stringify(businessInfo)}
      
      The customer is asking: "${message}"
      
      Tasks:
      1. Identify the intent (book_slot, join_queue, query_service, query_status).
      2. Extract relevant details (service name, preferred time, guest count).
      3. Respond in a friendly, professional way.
      4. If the intent is booking, suggest a mock slot or ask for missing details.
      
      Format your response as a JSON object:
      {
        "reply": "friendly message here",
        "intent": "intent_here",
        "extractedData": { "service": "...", "time": "...", "guests": 1 },
        "actionRequired": true/false
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    try {
      const text = response.text();
      const cleanText = text.replace(/```json|```|```javascript/g, "").trim();
      return JSON.parse(cleanText);
    } catch (err) {
      console.error("❌ Chatbot JSON parse failed:", err.message);
      return {
        reply: response.text(),
        intent: "query_service",
        extractedData: {},
        actionRequired: false
      };
    }
  } catch (err) {
    console.error("❌ Gemini API error:", err.message);
    return {
      reply: "I'm currently experiencing connection issues. Please try again in a moment!",
      intent: "error",
      extractedData: {},
      actionRequired: false
    };
  }
};
