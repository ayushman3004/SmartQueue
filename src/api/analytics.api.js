import api from "./axios.js";

export const getBusinessAnalytics = (businessId) => api.get(`/analytics/${businessId}`);
