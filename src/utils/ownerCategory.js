import { normalizeServiceCategory } from './customerService.js';

export function canAccessOwnerCategory(user, business) {
  if (user?.role === 'admin') return true;
  const category = normalizeServiceCategory(business?.category);
  return Boolean(category && user?.businessCategories?.includes(category));
}

// New locations inherit an enabled category; adding a hub never grants a new industry.
export function resolveOwnerHubCategory(user, requestedCategory) {
  const category = normalizeServiceCategory(requestedCategory);
  if (requestedCategory && !category) return null;
  if (user?.role === 'admin') return category || user.businessCategories?.[0] || 'salon';
  const enabled = user?.businessCategories || [];
  return requestedCategory ? (enabled.includes(category) ? category : null) : enabled[0] || null;
}
