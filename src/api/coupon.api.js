import api from "./axios.js";

export const validateCoupon    = (code, businessId) => api.post("/coupons/validate", { code, businessId });
export const getAvailableCoupons = (businessId) => api.get("/coupons/available", { params: { businessId } });
export const createCoupon      = (data) => api.post("/coupons", data);
