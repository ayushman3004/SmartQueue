import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import LocationPickerModal from '../components/LocationPickerModal'
import { useAuth } from './AuthContext'
import { reverseGeocodeCoords } from '../api/maps.api'
import { getLocationAddress, getLocationCoordinates, getLocationLabel, resolveGpsLocation } from '../utils/locationAddress'

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

  const userCoords = useMemo(() => getLocationCoordinates(currentLocation), [currentLocation])

  const updateLocation = useCallback((loc) => {
    setCurrentLocation(loc)
    setLocationModalRequested(false)

    try {
      if (loc) localStorage.setItem('serveq_selected_location', JSON.stringify(loc))
      else localStorage.removeItem('serveq_selected_location')
      localStorage.removeItem('serveq_user_coords')
    } catch {
      // The selection still applies in this tab when browser storage is unavailable.
    }
  }, [])

  // Repair GPS selections saved by clients that persisted coordinates as an address.
  useEffect(() => {
    if (authLoading || locationModalRequested || user?.role !== 'customer' ||
        !currentLocation?.isGps || getLocationAddress(currentLocation)) return
    if (!userCoords) return
    const { lat, lng } = userCoords
    let cancelled = false
    reverseGeocodeCoords(lat, lng).then(result => {
      const resolved = resolveGpsLocation(result, lat, lng)
      if (!cancelled && resolved) updateLocation(resolved)
    }).catch(() => {
      // Leave the saved proximity pin in place and let the user retry in the picker.
    })
    return () => { cancelled = true }
  }, [authLoading, locationModalRequested, user?.role, currentLocation, updateLocation, userCoords])

  const openLocationModal = useCallback(() => {
    setLocationModalRequested(true)
  }, [])

  const closeLocationModal = useCallback(() => {
    setLocationModalRequested(false)
  }, [])

  useEffect(() => {
    const handleSync = (event) => {
      if (event.key !== 'serveq_selected_location' && event.key !== null) return
      try {
        setCurrentLocation(event.newValue ? JSON.parse(event.newValue) : null)
      } catch {
        // Ignore malformed cross-tab updates.
      }
    }

    window.addEventListener('storage', handleSync)
    return () => window.removeEventListener('storage', handleSync)
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

