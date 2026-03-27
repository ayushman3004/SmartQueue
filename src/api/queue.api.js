import api from "./axios.js";

export const getQueue  = (businessId) => api.get(`/queue/${businessId}`);
export const joinQueue = (businessId, data) => api.post(`/queue/${businessId}/join`, data);
export const leaveQueue = (businessId) => api.delete(`/queue/${businessId}/leave`);
export const callNext  = (businessId) => api.post(`/queue/${businessId}/next`);
export const getWaitEstimate = (businessId) => api.get(`/queue/estimate/${businessId}`);
export const extendUserTime = (businessId, userId, minutes) => api.post(`/queue/${businessId}/extend`, { userId, minutes });
