import { useId, useRef } from 'react'
import { ChevronDown, MapPin, Search, X } from 'lucide-react'
import '../styles/customer-search.css'

export default function CustomerSearchTools({ selectedCity, onChangeLocation, search, onSearchChange, placeholder = 'Search venues...' }) {
  const inputId = useId()
  const inputRef = useRef(null)

  return (
    <div className="customer-search-tools">
      <button type="button" onClick={onChangeLocation} className="customer-search-location" aria-label={`Change location: ${selectedCity}`}>
        <MapPin size={18} aria-hidden="true" />
        <span title={selectedCity}>{selectedCity}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <div className="customer-search-field" role="search" aria-label="Find a venue">
        <label htmlFor={inputId} className="sr-only">{placeholder.replace(/\.+$/, '')}</label>
        <Search size={20} className="customer-search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder={placeholder}
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          className="customer-search-input"
        />
        {search && (
          <button type="button" className="customer-search-clear" aria-label="Clear search" onClick={() => {
            onSearchChange('')
            inputRef.current?.focus()
          }}>
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
