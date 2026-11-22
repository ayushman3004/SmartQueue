import api from './axios';

export const getNotifications = (params = {}, signal) => api.get('/notifications', { params, signal });
export const markNotificationRead = id => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all');
