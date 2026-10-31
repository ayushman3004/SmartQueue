import axios from "axios";

/**
 * Axios instance for API calls.
 * 
 * In production: VITE_API_URL = "https://smartqueue-p629.onrender.com"
 *                baseURL becomes "https://smartqueue-p629.onrender.com/api"
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

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    if (config.headers && typeof config.headers.set === "function") {
      config.headers.set("Authorization", `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
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
      url.includes("/auth/me");

    // Don't hijack login/signup errors or initial profile fetch
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem("token");
      localStorage.removeItem("serveq_last_active");
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        if (path !== "/login" && path !== "/" && !path.startsWith("/auth")) {
          if (path.startsWith("/admin")) {
            window.location.reload();
          } else if (path.startsWith("/business")) {
            window.location.href = "/business";
          } else {
            window.location.href = "/login";
          }
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
