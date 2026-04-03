import twilio from "twilio";

let client = null;

const initTwilio = () => {
  if (!client) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (accountSid && authToken) {
      client = twilio(accountSid, authToken);
    } else {
      console.warn("Twilio credentials are not set in environment variables.");
    }
  }
  return client;
};

export const sendSMS = async (to, body) => {
  try {
    const twilioClient = initTwilio();
    if (!twilioClient) {
      throw new Error("Twilio is not configured");
    }

    const from = process.env.TWILIO_PHONE_NUMBER;
    const response = await twilioClient.messages.create({
      body,
      from,
      to,
    });
    return response;
  } catch (error) {
    console.error("Twilio sendSMS error:", error);
    throw error;
  }
};
