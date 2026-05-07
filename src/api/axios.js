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
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
    }
    return Promise.reject(err);
  }
);

export default api;
