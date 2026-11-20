import { normalizeServiceCategory } from './customerService.js';

export function canAccessOwnerCategory(user, business) {
  if (user?.role === 'admin') return true;
  const category = normalizeServiceCategory(business?.category);
  return Boolean(category && user?.businessCategories?.includes(category));
}
