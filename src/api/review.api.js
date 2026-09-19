import api from "./axios.js";

export const getBusinessReviews = (businessId) => api.get(`/reviews/business/${businessId}`);
export const submitReview       = (data) => api.post("/reviews", data);
export const getMyReviews       = () => api.get("/reviews/mine");
