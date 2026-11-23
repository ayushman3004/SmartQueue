export const serviceCategories = {
  clinic: ['clinic', 'healthcare', 'doctor'],
}

export function normalizeServiceCategory(value) {
  const category = typeof value === 'string' ? value.toLowerCase().trim() : ''
  return Object.keys(serviceCategories).find(service => serviceCategories[service].includes(category)) || null
}

export function matchesCustomerService(venue, service) {
  const category = normalizeServiceCategory(service)
  return Boolean(category && normalizeServiceCategory(venue?.category) === category)
}

export function filterServiceVenues(venues, service) {
  return venues.filter(venue => matchesCustomerService(venue, service))
}

export function filterServiceBookings(bookings, venues, service) {
  const byId = new Map(venues.map(venue => [String(venue._id), venue]))
  return bookings.filter(booking => matchesCustomerService(
    booking.businessId?.category ? booking.businessId : byId.get(String(booking.businessId?._id || booking.businessId)), service
  ))
}

export function customerServicePath(path, service) {
  const category = normalizeServiceCategory(service)
  if (!category || typeof path !== 'string' || !/^\/(customers|booking|queue|history)(\/|\?|#|$)/.test(path)) return path
  const url = new URL(path, 'https://www.serveq.tech')
  if (!normalizeServiceCategory(url.searchParams.get('category'))) url.searchParams.set('category', category)
  return `${url.pathname}${url.search}${url.hash}`
}
