import api from "./axios.js";

export const signup = (data) => api.post("/auth/signup", data);
export const signin = (data) => api.post("/auth/signin", data);
export const logout  = () => api.post("/auth/logout");
export const getMe   = () => api.get("/auth/me");
