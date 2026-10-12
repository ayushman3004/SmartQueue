import api from "./axios.js";

export const getBusinessAnalytics = (businessId, params = {}) => api.get(`/analytics/${businessId}`, { params });
export const generateAIAnalyticsReview = (businessId) => api.get(`/analytics/${businessId}?refresh=true`);
