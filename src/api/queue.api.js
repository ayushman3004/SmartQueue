import api from "./axios.js";

export const getQueue  = (businessId) => api.get(`/queue/${businessId}`);
export const joinQueue = (businessId, data) => api.post(`/queue/${businessId}/join`, data);
export const leaveQueue = (businessId) => api.delete(`/queue/${businessId}/leave`);
export const callNext  = (businessId) => api.post(`/queue/${businessId}/next`);
export const getWaitEstimate = (businessId) => api.get(`/queue/estimate/${businessId}`);
export const extendUserTime = (businessId, userId, minutes) => api.post(`/queue/${businessId}/extend`, { userId, minutes });
export const cancelDelay = (businessId) => api.post(`/queue/${businessId}/cancel-delay`);
export const assignQueueStaff = (businessId, userId, staffName) => api.post(`/queue/${businessId}/assign-staff`, { userId, staffName });
export const collectQueuePayment = (businessId, userId) => api.post(`/queue/${businessId}/users/${userId}/collect-payment`);


export function subscribeToQueueChanges(socket, onQueue, businessId) {
  const pending = new Map();
  const onChange = ({ businessId: id } = {}) => {
    const key = String(id ?? "");
    if (!key || (businessId && key !== String(businessId))) return;
    const previous = pending.get(key);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(async () => {
      try {
        const response = await getQueue(key);
        if (pending.get(key) === timer) onQueue(response.data.data.queue);
      } catch {
        // Keep the last authorized queue if a refresh fails.
      } finally {
        if (pending.get(key) === timer) pending.delete(key);
      }
    }, 100);
    pending.set(key, timer);
  };
  socket.on("queue:updated", onChange);
  return () => {
    socket.off("queue:updated", onChange);
    for (const timer of pending.values()) clearTimeout(timer);
    pending.clear();
  };
}
