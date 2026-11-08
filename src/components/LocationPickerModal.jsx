import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Search,
  Navigation,
  X,
  Loader2,
  AlertCircle,
  Building2,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { autocompleteLocations, geocodeAddress, reverseGeocodeCoords } from '../api/maps.api'

const QUICK_HUBS = [
  {
    name: 'Model Town, Jalandhar',
    description: 'Model Town, Jalandhar, Punjab',
    city: 'Jalandhar',
    state: 'Punjab',
    postalCode: '144003',
    lat: 31.3056,
    lng: 75.5794,
  },
  {
    name: 'LPU, Phagwara',
    description: 'Lovely Professional University (LPU), Phagwara, Punjab',
    city: 'Phagwara',
    state: 'Punjab',
    postalCode: '144402',
    lat: 31.2530,
    lng: 75.7037,
  },
  {
    name: 'Gorakhpur, UP',
    description: 'Gorakhpur, Uttar Pradesh',
    city: 'Gorakhpur',
    state: 'Uttar Pradesh',
    postalCode: '273001',
    lat: 26.7606,
    lng: 83.3732,
  },
  {
    name: 'Kolkata, WB',
    description: 'Salt Lake / Kolkata, West Bengal',
    city: 'Kolkata',
    state: 'West Bengal',
    postalCode: '700091',
    lat: 22.5867,
    lng: 88.4178,
  },
]

export default function LocationPickerModal({
  isOpen,
  onClose,
  onSelectLocation,
  currentLocation,
  canClose = true,
}) {
  const [searchInput, setSearchInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const [detectingGps, setDetectingGps] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const searchInputRef = useRef(null)

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('')
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 150)
    }
  }, [isOpen])

  // Debounced autocomplete search
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([])
      setSearching(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await autocompleteLocations(trimmed)
        setSuggestions(results || [])
      } catch (err) {
        console.warn('Location autocomplete error:', err)
      } finally {
        setSearching(false)
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [searchInput])

  // Handle GPS location detection
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser. Please search manually.')
      return
    }

    setDetectingGps(true)
    setErrorMessage('')

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude.toFixed(6))
        const lng = Number(position.coords.longitude.toFixed(6))

        try {
          const rev = await reverseGeocodeCoords(lat, lng)
          const resolvedLocation = {
            name: rev?.city ? `${rev.city}${rev.state ? ', ' + rev.state : ''}` : 'Current Location',
            formattedAddress: rev?.formattedAddress || `Coordinates (${lat}, ${lng})`,
            city: rev?.city || '',
            state: rev?.state || '',
            postalCode: rev?.postalCode || '',
            lat,
            lng,
            isGps: true,
          }

          onSelectLocation(resolvedLocation)
          onClose()
        } catch (err) {
          console.warn('Reverse geocode error, using raw coords:', err)
          onSelectLocation({
            name: 'Current Location',
            formattedAddress: `Near (${lat}, ${lng})`,
            lat,
            lng,
            isGps: true,
          })
          onClose()
        } finally {
          setDetectingGps(false)
        }
      },
      (err) => {
        setDetectingGps(false)
        console.warn('Geolocation permission error:', err)
        let msg = 'Location permission was denied or unavailable. Please type your area or city above.'
        if (err.code === 1) {
          msg = 'Location permission was denied. You can search for your area or city below.'
        } else if (err.code === 2) {
          msg = 'Unable to determine your current location. Please search manually.'
        } else if (err.code === 3) {
          msg = 'Location request timed out. Please try searching for your area.'
        }
        setErrorMessage(msg)
        searchInputRef.current?.focus()
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
    )
  }

  // Handle selection of a suggestion
  const handleSelectSuggestion = async (item) => {
    setErrorMessage('')
    try {
      if (item.lat && item.lng) {
        onSelectLocation({
          name: item.mainText || item.city || item.description.split(',')[0],
          formattedAddress: item.description,
          city: item.city || '',
          state: item.state || '',
          postalCode: item.postalCode || '',
          lat: Number(item.lat),
          lng: Number(item.lng),
          isGps: false,
        })
        onClose()
        return
      }

      setSearching(true)
      const geo = await geocodeAddress({
        address: item.description,
        placeId: item.placeId,
      })

      if (geo && geo.lat && geo.lng) {
        onSelectLocation({
          name: item.mainText || geo.city || item.description.split(',')[0],
          formattedAddress: geo.formattedAddress || item.description,
          city: geo.city || item.city || '',
          state: geo.state || item.state || '',
          postalCode: geo.postalCode || item.postalCode || '',
          lat: Number(geo.lat),
          lng: Number(geo.lng),
          isGps: false,
        })
        onClose()
      } else {
        setErrorMessage('Could not pinpoint coordinates for this address. Please try another search.')
      }
    } catch (err) {
      console.warn('Geocoding error:', err)
      setErrorMessage('Failed to resolve location coordinates. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  const handleSelectHub = (hub) => {
    onSelectLocation({
      name: hub.name,
      formattedAddress: hub.description,
      city: hub.city,
      state: hub.state,
      postalCode: hub.postalCode,
      lat: hub.lat,
      lng: hub.lng,
      isGps: false,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={canClose ? onClose : undefined}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        />

        {/* Modal Dialog Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-zinc-100 overflow-hidden z-10"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-zinc-100 flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#049645]" />
                <span>Select Your Location</span>
              </h2>
              <p className="text-xs text-zinc-500">
                Discover clinics and salons serving your exact area
              </p>
            </div>
            {canClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close location picker"
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Primary Action: Use Current Location (GPS) */}
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={detectingGps}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl border-2 border-emerald-500/20 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-950 hover:border-emerald-500/40 transition-all cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#049645] text-white flex items-center justify-center shadow-xs">
                  {detectingGps ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Navigation className="w-5 h-5 group-hover:scale-105 transition-transform" />
                  )}
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                    <span>Use my current location</span>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#049645]/10 text-[#049645] uppercase tracking-wide">
                      GPS
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {detectingGps ? 'Pinpointing your device coordinates...' : 'Auto-detect using device location'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-700 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Error or Denied State Notice */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-zinc-200" />
              <span className="absolute bg-white px-3 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Or search manually
              </span>
            </div>

            {/* Search Input Box */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search area, landmark, street, or postal code..."
                className="w-full pl-10 pr-10 py-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 focus:bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#049645] focus:ring-2 focus:ring-[#049645]/10 transition-all"
              />
              {searching ? (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#049645] animate-spin" />
              ) : searchInput ? (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Clear location search"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
            </div>

            {/* Autocomplete Suggestions List */}
            {suggestions.length > 0 && (
              <div className="border border-zinc-200 rounded-2xl divide-y divide-zinc-100 overflow-hidden bg-white shadow-xs max-h-56 overflow-y-auto">
                {suggestions.map((item, idx) => (
                  <button
                    key={item.placeId || idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className="w-full px-4 py-2.5 text-left flex items-start gap-3 hover:bg-zinc-50 transition-colors cursor-pointer group"
                  >
                    <MapPin className="w-4 h-4 text-zinc-400 group-hover:text-[#049645] mt-1 shrink-0 transition-colors" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {item.mainText || item.description}
                      </p>
                      {item.secondaryText && (
                        <p className="text-xs text-zinc-500 truncate">{item.secondaryText}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Popular Hubs */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Popular Service Hubs
              </span>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_HUBS.map((hub) => (
                  <button
                    key={hub.name}
                    type="button"
                    onClick={() => handleSelectHub(hub)}
                    className="p-2.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 hover:bg-emerald-50/60 hover:border-emerald-300 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 group-hover:text-emerald-900">
                      <Building2 className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-600 shrink-0" />
                      <span className="truncate">{hub.name}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">{hub.state}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Current Selected Location Indicator */}
            {currentLocation && (
              <div className="pt-2 text-center border-t border-zinc-100">
                <span className="text-xs text-zinc-400">
                  Currently viewing: <strong className="text-zinc-700 font-semibold">{currentLocation.name || currentLocation.formattedAddress}</strong>
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

