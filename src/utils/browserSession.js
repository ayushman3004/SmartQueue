let pendingLogout = Promise.resolve(true);

export const clearBrowserBearer = (api, storage) => {
  storage.removeItem('token');
  delete api.defaults.headers.common.Authorization;
};

// OAuth sessions stay in the API's HttpOnly cookie, including after reloads.
export const restoreOAuthSession = async (api, storage) => {
  clearBrowserBearer(api, storage);
  const response = await api.get('/auth/me');
  return response.data.data.user;
};

export const logoutBrowserSession = (api, storage) => {
  clearBrowserBearer(api, storage);
  pendingLogout = api.post('/auth/logout').then(() => true, () => false);
  return pendingLogout;
};

export const waitForBrowserLogout = () => pendingLogout;
