import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import LocationPickerModal from '../components/LocationPickerModal'

export const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  const [currentLocation, setCurrentLocation] = useState(() => {
    try {
      const saved = localStorage.getItem('serveq_selected_location')
      if (saved) return JSON.parse(saved)
    } catch {}
    return null
  })

  const [showLocationModal, setShowLocationModal] = useState(() => {
    try {
      const saved = localStorage.getItem('serveq_selected_location')
      return !saved
    } catch {
      return false
    }
  })

  const [selectedCity, setSelectedCity] = useState(() => {
    try {
      const saved = localStorage.getItem('serveq_selected_location')
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.name || parsed.city || parsed.formattedAddress || 'Select Location'
      }
    } catch {}
    return 'Select Location'
  })

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
    } catch {}
    return null
  })

  const updateLocation = useCallback((loc) => {
    if (!loc) return
    setCurrentLocation(loc)
    const label = loc.name || loc.city || loc.formattedAddress || 'Selected Location'
    setSelectedCity(label)

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

    setShowLocationModal(false)
  }, [])

  const openLocationModal = useCallback(() => {
    setShowLocationModal(true)
  }, [])

  const closeLocationModal = useCallback(() => {
    setShowLocationModal(false)
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
          setSelectedCity(loc.name || loc.city || loc.formattedAddress || 'Selected Location')
          if (loc.lat && loc.lng) {
            setUserCoords({ lat: Number(loc.lat), lng: Number(loc.lng) })
          }
        }
      } catch {}
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

