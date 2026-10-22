import api from "./axios";

export const sendSupportMessage = (payload) => api.post("/support", payload);
