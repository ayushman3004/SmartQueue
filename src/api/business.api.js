import api from "./axios.js";

export const getAllBusinesses = async (params = {}) => {
  const response = await api.get("/businesses", { params });
  if (params.page !== undefined || !response.data.data.nextPage) return response;

  const businesses = new Map(response.data.data.businesses.map(business => [business._id, business]));
  let page = response.data.data.nextPage;
  while (page) {
    const next = await api.get("/businesses", { params: { ...params, page } });
    for (const business of next.data.data.businesses) businesses.set(business._id, business);
    page = next.data.data.nextPage;
  }
  response.data.data.businesses = [...businesses.values()];
  response.data.data.nextPage = null;
  return response;
};
export const getMyBusinesses  = () => api.get("/businesses/mine");
export const getBusiness      = (id) => api.get(`/businesses/${id}`);
export const createBusiness   = (data) => api.post("/businesses", data);
export const updateBusiness   = (id, data) => api.put(`/businesses/${id}`, data);
export const toggleBusiness   = (id) => api.patch(`/businesses/${id}/toggle`);

// Onboarding API endpoints
export const getOnboardingDraft = (businessId) =>
  api.get("/businesses/onboarding/draft", { params: businessId ? { businessId } : {} });

export const initOnboarding = (data = {}) =>
  api.post("/businesses/onboarding/init", data);

export const saveOnboardingStep = (id, step, data) =>
  api.put(`/businesses/${id}/onboarding/step`, { step, data });

export const launchBusiness = (id) =>
  api.post(`/businesses/${id}/onboarding/launch`);


export const selectBusinessCategory = (id, category) => api.post(`/businesses/${id}/category`, { category });

export const getOwnerCategories = () => api.get('/businesses/owner-category');
export const chooseOwnerCategory = (category) => api.post('/businesses/owner-category', { category });
export const getAccessibleBusinesses = () => api.get('/businesses/accessible');
