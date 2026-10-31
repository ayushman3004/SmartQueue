export const allowedOrigins = [
  "http://localhost:5173",
  "https://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "https://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:4173",
  "https://serveq.tech",
  "https://www.serveq.tech",
  "https://smart-queue-blond.vercel.app",
  "https://smart-queue-git-main-ayushman3004s-projects.vercel.app",
  "https://smartqueue-p629.onrender.com",
  process.env.CLIENT_URL,
].filter(Boolean);

export const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow server-to-server / mobile / curl
  if (allowedOrigins.includes(origin)) return true;
  // Allow all local dev and Docker container ports on localhost or 127.0.0.1
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true;
  if (origin.endsWith(".onrender.com")) return true;
  return false;
};

export const corsOptions = {
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    console.warn(`🚫 CORS rejected origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
};

export default {
  allowedOrigins,
  isOriginAllowed,
  corsOptions,
};

