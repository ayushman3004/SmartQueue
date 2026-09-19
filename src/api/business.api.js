import api from "./axios.js";

export const getAllBusinesses = (params = {}) => api.get("/businesses", { params });
export const getMyBusinesses  = () => api.get("/businesses/mine");
export const getBusiness      = (id) => api.get(`/businesses/${id}`);
export const createBusiness   = (data) => api.post("/businesses", data);
export const updateBusiness   = (id, data) => api.put(`/businesses/${id}`, data);
export const toggleBusiness   = (id) => api.patch(`/businesses/${id}/toggle`);
