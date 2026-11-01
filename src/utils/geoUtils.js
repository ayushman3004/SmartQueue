/**
 * Geolocation & Distance Calculation Utilities
 */

export const KNOWN_CITY_COORDINATES = {
  'kolkata': { lat: 22.5726, lng: 88.3639, name: 'Kolkata, West Bengal' },
  'salt lake': { lat: 22.5867, lng: 88.4178, name: 'Salt Lake, Kolkata' },
  'new town': { lat: 22.5958, lng: 88.4796, name: 'New Town, Kolkata' },
  'park street': { lat: 22.5516, lng: 88.3524, name: 'Park Street, Kolkata' },
  'jadavpur': { lat: 22.4988, lng: 88.3718, name: 'Jadavpur, Kolkata' },
  'howrah': { lat: 22.5958, lng: 88.2636, name: 'Howrah, West Bengal' },
  'bardhaman': { lat: 23.2324, lng: 87.8615, name: 'Bardhaman, West Bengal' },
  'burdwan': { lat: 23.2324, lng: 87.8615, name: 'Bardhaman, West Bengal' },
  'durgapur': { lat: 23.5204, lng: 87.3119, name: 'Durgapur, West Bengal' },
  'siliguri': { lat: 26.7271, lng: 88.3953, name: 'Siliguri, West Bengal' },
  'bangalore': { lat: 12.9716, lng: 77.5946, name: 'Bangalore, Karnataka' },
  'bengaluru': { lat: 12.9716, lng: 77.5946, name: 'Bangalore, Karnataka' },
  'indiranagar': { lat: 12.9784, lng: 77.6408, name: 'Indiranagar, Bangalore' },
  'koramangala': { lat: 12.9352, lng: 77.6245, name: 'Koramangala, Bangalore' },
  'whitefield': { lat: 12.9698, lng: 77.7500, name: 'Whitefield, Bangalore' },
  'mumbai': { lat: 19.0760, lng: 72.8777, name: 'Mumbai, Maharashtra' },
  'bandra': { lat: 19.0596, lng: 72.8295, name: 'Bandra, Mumbai' },
  'delhi': { lat: 28.6139, lng: 77.2090, name: 'Delhi, NCR' },
  'new delhi': { lat: 28.6139, lng: 77.2090, name: 'New Delhi' },
  'noida': { lat: 28.5355, lng: 77.3910, name: 'Noida, UP' },
  'gurgaon': { lat: 28.4595, lng: 77.0266, name: 'Gurgaon, Haryana' },
  'gurugram': { lat: 28.4595, lng: 77.0266, name: 'Gurugram, Haryana' },
  'hyderabad': { lat: 17.3850, lng: 78.4867, name: 'Hyderabad, Telangana' },
  'chennai': { lat: 13.0827, lng: 80.2707, name: 'Chennai, Tamil Nadu' },
  'pune': { lat: 18.5204, lng: 73.8567, name: 'Pune, Maharashtra' },
}

/**
 * Resolve coordinates from a text address / city query
 */
export function getCoordinatesForLocation(query = '') {
  if (!query) return null
  const clean = String(query).toLowerCase().trim()
  
  for (const [key, coords] of Object.entries(KNOWN_CITY_COORDINATES)) {
    if (clean.includes(key)) {
      return { lat: coords.lat, lng: coords.lng }
    }
  }
  
  // Default fallback if totally unknown (Kolkata Center)
  return null
}

/**
 * Calculate distance between two coordinates using Haversine formula (in km)
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const nLat1 = Number(lat1)
  const nLon1 = Number(lon1)
  const nLat2 = Number(lat2)
  const nLon2 = Number(lon2)

  if (!nLat1 || !nLon1 || !nLat2 || !nLon2) return null
  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null
  if (nLat1 === 0 && nLon1 === 0) return null
  if (nLat2 === 0 && nLon2 === 0) return null

  const R = 6371 // Earth radius in kilometers
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Format distance into a human-readable string (e.g. "450 m" or "1.2 km")
 */
export function formatDistance(km) {
  if (km === null || km === undefined || isNaN(km)) return null
  if (km < 1) {
    const meters = Math.max(50, Math.round(km * 1000 / 50) * 50)
    return `${meters} m`
  }
  return `${km.toFixed(1)} km`
}

