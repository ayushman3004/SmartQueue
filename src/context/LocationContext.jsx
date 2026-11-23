import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import LocationPickerModal from '../components/LocationPickerModal'
import { useAuth } from './AuthContext'
import { reverseGeocodeCoords } from '../api/maps.api'
import { getLocationAddress, getLocationLabel, resolveGpsLocation } from '../utils/locationAddress'

export const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  const { user, loading: authLoading } = useAuth()
  const [currentLocation, setCurrentLocation] = useState(() => {
    try {
      const saved = localStorage.getItem('serveq_selected_location')
      if (saved) return JSON.parse(saved)
    } catch {
      // Invalid or unavailable storage falls back to no selected location.
    }
    return null
  })

  const [locationModalRequested, setLocationModalRequested] = useState(false)
  const showLocationModal = !authLoading && user?.role === 'customer' &&
    (locationModalRequested || !currentLocation)

  const selectedCity = getLocationLabel(currentLocation)

  const [userCoords, setUserCoords] = useState(() => {
    try {
      const savedLoc = localStorage.getItem('serveq_selected_location')
      if (savedLoc) {
        const parsed = JSON.parse(savedLoc)
        if (parsed.lat && parsed.lng) {
          return { lat: Number(parsed.lat), lng: Number(parsed.lng) }
        }
      }
      const savedCoords = localStorage.getItem('serveq_user_coords')
      if (savedCoords) return JSON.parse(savedCoords)
    } catch {
      // Coordinates are optional when storage is unavailable or invalid.
    }
    return null
  })

  const updateLocation = useCallback((loc) => {
    if (!loc) return
    setCurrentLocation(loc)

    let coords = null
    if (loc.lat && loc.lng) {
      coords = { lat: Number(loc.lat), lng: Number(loc.lng) }
      setUserCoords(coords)
    }

    try {
      localStorage.setItem('serveq_selected_location', JSON.stringify(loc))
      if (coords) {
        localStorage.setItem('serveq_user_coords', JSON.stringify(coords))
      }
      // Broadcast location change to all tabs and same-window components
      window.dispatchEvent(new CustomEvent('serveq:location_change', { detail: loc }))
    } catch (err) {
      console.warn('Failed to save selected location:', err)
    }

    setLocationModalRequested(false)
  }, [])

  // Repair GPS selections saved by clients that persisted coordinates as an address.
  useEffect(() => {
    if (authLoading || locationModalRequested || user?.role !== 'customer' ||
        !currentLocation?.isGps || getLocationAddress(currentLocation)) return
    const { lat, lng } = currentLocation
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    let cancelled = false
    reverseGeocodeCoords(lat, lng).then(result => {
      const resolved = resolveGpsLocation(result, lat, lng)
      if (!cancelled && resolved) updateLocation(resolved)
    }).catch(() => {
      // Leave the saved proximity pin in place and let the user retry in the picker.
    })
    return () => { cancelled = true }
  }, [authLoading, locationModalRequested, user?.role, currentLocation, updateLocation])

  const openLocationModal = useCallback(() => {
    setLocationModalRequested(true)
  }, [])

  const closeLocationModal = useCallback(() => {
    setLocationModalRequested(false)
  }, [])

  // Synchronize location changes across storage and window events
  useEffect(() => {
    const handleSync = (e) => {
      try {
        let loc = e?.detail
        if (!loc && e?.key === 'serveq_selected_location') {
          loc = e.newValue ? JSON.parse(e.newValue) : null
        }
        if (loc) {
          setCurrentLocation(loc)
          if (loc.lat && loc.lng) {
            setUserCoords({ lat: Number(loc.lat), lng: Number(loc.lng) })
          }
        }
      } catch {
        // Ignore malformed cross-tab updates and retain the current location.
      }
    }

    window.addEventListener('storage', handleSync)
    window.addEventListener('serveq:location_change', handleSync)
    return () => {
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('serveq:location_change', handleSync)
    }
  }, [])

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        selectedCity,
        userCoords,
        updateLocation,
        openLocationModal,
        closeLocationModal,
        showLocationModal,
      }}
    >
      {children}
      <LocationPickerModal
        isOpen={showLocationModal}
        onClose={closeLocationModal}
        onSelectLocation={updateLocation}
        currentLocation={currentLocation}
        canClose={Boolean(currentLocation)}
      />
    </LocationContext.Provider>
  )
}

export function useCustomerLocation() {
  const context = useContext(LocationContext)
  if (!context) {
    throw new Error('useCustomerLocation must be used within a LocationProvider')
  }
  return context
}

