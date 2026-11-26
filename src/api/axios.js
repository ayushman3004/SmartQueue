import axios from "axios";

/**
 * Axios instance for API calls.
 * 
 * In production: VITE_API_URL = "https://api.serveq.tech"
 *                baseURL becomes "https://api.serveq.tech/api"
 * 
 * In development: VITE_API_URL can be empty/undefined — baseURL becomes "/api"
 *                 which works with the Vite dev proxy.
 */
const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api`;
  }
  if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    return "https://api.serveq.tech/api";
  }
  return "/api";
};

const baseURL = getBaseUrl();

const api = axios.create({
  baseURL,
  withCredentials: true,
});

const cookieSessionEndpoints = new Set([
  "/auth/signup", "/auth/signin", "/auth/change-password", "/auth/email/verify-otp", "/doctors/password",
  '/auth/phone/signin/verify-otp',
]);
api.interceptors.request.use((config) => {
  if (config.method === "post" && cookieSessionEndpoints.has(config.url)) {
    config.headers.set("X-ServeQ-Session", "cookie");
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    const isAuthEndpoint =
      url.includes("/auth/signin") ||
      url.includes("/auth/signup") ||
      url.includes("/auth/me") ||
      url === "/admin/signin" || url === "/admin/access";

    // Don't hijack login/signup errors or initial profile fetch
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem("serveq_last_active");
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (path !== "/login" && path !== "/" && !path.startsWith("/auth")) {
          if (path.startsWith("/admin")) {
            window.location.reload();
          } else if ((path.startsWith("/business") || path.startsWith("/hub"))) {
            window.location.href = "/hub/login";
          } else {
            window.location.href = "/login";
          }
        }
      }
    }
    if (err.response?.status === 403 && err.response?.data?.message?.startsWith("Password change required")) window.location.href = "/hub/change-password";
    return Promise.reject(err);
  }
);

export default api;
