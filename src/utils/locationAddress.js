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

export function getLocationCityLabel(location) {
  if (!location) return ''
  const parts = [location.city, location.state].map(addressText).filter(Boolean)
  return [...new Set(parts)].join(', ') || getLocationLabel(location)
}

export function getLocationCoordinates(location) {
  const lat = location?.lat
  const lng = location?.lng
  if (![lat, lng].every(value =>
    typeof value === 'number' || (typeof value === 'string' && value.trim())
  )) return null
  const coordinates = { lat: Number(lat), lng: Number(lng) }
  if (!Number.isFinite(coordinates.lat) || Math.abs(coordinates.lat) > 90 ||
      !Number.isFinite(coordinates.lng) || Math.abs(coordinates.lng) > 180 ||
      (coordinates.lat === 0 && coordinates.lng === 0)) return null
  return coordinates
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
