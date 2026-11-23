import { normalizeServiceCategory } from './customerService.js';

export function canAccessOwnerCategory(user, business) {
  const category = normalizeServiceCategory(business?.category);
  return Boolean(category && (user?.role === 'admin' || user?.businessCategories?.includes(category)));
}

// Owners must have clinic access before registering a new location.
export function resolveOwnerHubCategory(user, requestedCategory) {
  if (requestedCategory && !normalizeServiceCategory(requestedCategory)) return null;
  return canAccessOwnerCategory(user, { category: 'clinic' }) ? 'clinic' : null;
}
