import api from "./axios.js";

export const getAvailableSlots   = (businessId, date) => api.get(`/bookings/slots/${businessId}`, { params: { date } });
export const createBooking       = (data) => api.post("/bookings", data);
export const getMyBookings       = () => api.get("/bookings/mine");
export const getBusinessBookings = (businessId) => api.get(`/bookings/${businessId}/all`);
export const cancelBooking       = (id) => api.patch(`/bookings/${id}/cancel`);
export const extendBooking       = (id, extraMinutes) => api.post(`/bookings/extend/${id}`, { extraMinutes });
export const respondToDelay      = (id, accept) => api.post(`/bookings/${id}/respond`, { accept });
export const startBookingService = (id) => api.patch(`/bookings/${id}/start`);
export const completeBookingService = (id) => api.patch(`/bookings/${id}/complete`);
