const coordinateLabel = /^(?:(?:coordinates|near|location)\s*[:(]?\s*|\(\s*)?[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?\s*\)?$/i

function addressText(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  return coordinateLabel.test(text) || /^(?:current|selected) location$/i.test(text) ? '' : text
}

export function getLocationAddress(location) {
  if (!location || location.approximate) return ''
  const parts = [location.area, location.city, location.state].map(addressText).filter(Boolean)
  return addressText(location.formattedAddress) || addressText(location.displayName) || [...new Set(parts)].join(', ')
}

export function getLocationLabel(location) {
  if (!location) return 'Select Location'
  const address = getLocationAddress(location)
  if (location.isGps) return address || addressText(location.name) || 'Address unavailable'
  return addressText(location.name) || address || 'Selected Location'
}

export function resolveGpsLocation(result, lat, lng) {
  const address = getLocationAddress(result)
  if (!address) return null
  return {
    name: address,
    formattedAddress: address,
    city: result.city || '',
    state: result.state || '',
    postalCode: result.postalCode || '',
    lat,
    lng,
    isGps: true,
  }
}
