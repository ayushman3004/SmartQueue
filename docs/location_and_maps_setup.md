# Location-Based Discovery & Google Maps Platform Setup

This document describes the location discovery architecture, Google Maps Platform configuration, server-side proxy security, and database migration steps for ServeQ.

---

## 1. Google Maps Platform Setup

ServeQ uses Google Maps Platform for address autocomplete, forward geocoding, and reverse geocoding.

### Required Google Cloud APIs

Enable the following APIs in the Google Cloud Console:

1. **Places API** (or Places API New) - for address autocomplete suggestions.
2. **Geocoding API** - for resolving addresses to latitude and longitude coordinates, and reverse geocoding GPS coordinates to human-readable street/city names.

### Setting Up Your API Key

1. Navigate to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an API Key.
3. Under **API Restrictions**, restrict the key to:
   - Places API
   - Geocoding API
4. Under **Application Restrictions**, choose **IP addresses** (for your production server/Render IP) or leave unrestricted for private backend environments.
5. Save the key in your server environment variables as `GOOGLE_MAPS_API_KEY`.

---

## 2. Environment Variables

Add the following to your backend `.env` file:

```env
# Google Maps Platform (Server-Side Proxy)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Discovery search radius in kilometers (default: 30)
DISCOVERY_SEARCH_RADIUS_KM=30
```

### Security Architecture

- The `GOOGLE_MAPS_API_KEY` is kept strictly server-side.
- The frontend calls ServeQ's proxy endpoints (`/api/maps/autocomplete`, `/api/maps/geocode`, `/api/maps/reverse-geocode`).
- The API key is never bundled into client JavaScript or exposed in browser network requests.

---

## 3. Fallback Hierarchy

To ensure uninterrupted development and testing without paid API keys, the Maps service features a three-tier fallback architecture:

1. **Tier 1 - Google Maps Platform**: Active whenever a valid `GOOGLE_MAPS_API_KEY` is present.
2. **Tier 2 - OpenStreetMap (Nominatim)**: Seamless fallback when no Google API key is set or external rate limits occur.
3. **Tier 3 - In-Memory Popular Hubs**: Instant offline matching for major Indian hubs (Jalandhar, Phagwara/LPU, Gorakhpur, Kolkata, Delhi, Bangalore, Mumbai, etc.).

---

## 4. Database Migration

Initial seed data may have default or placeholder coordinates. To update all businesses to their real geographic coordinates, run:

```bash
node scripts/migrate-business-coordinates.js
```

### Updated Venue Coordinates

- **Jalandhar Clinic**: `[31.3056, 75.5794]` (Model Town, Jalandhar, Punjab)
- **Bh-9 Salon**: `[31.2530, 75.7037]` (Lovely Professional University, Phagwara, Punjab)
- **Hair Studio**: `[26.7606, 83.3732]` (Gorakhpur, Uttar Pradesh)

---

## 5. Customer Discovery Flow (Domino's / Zomato Pattern)

1. **First-Visit Prompt**: When a customer opens ServeQ without a stored location, `LocationPickerModal` opens automatically.
2. **Use My Current Location**:
   - Fetches device coordinates via `navigator.geolocation`.
   - Resolves to readable area and city name via `/api/maps/reverse-geocode`.
   - Saves to `localStorage.setItem('serveq_selected_location', ...)`.
3. **Manual Search Autocomplete**:
   - Customer types any street, area, or postal code.
   - Suggestions resolve to latitude and longitude.
4. **Proximity Filtering & Nearest-First Sort**:
   - Queries `GET /api/businesses?lat=...&lng=...&radius=30`.
   - Calculates distance using the Haversine formula.
   - Businesses with missing or invalid coordinates (0, 0) are excluded.
   - Results are sorted nearest first.
5. **No-Service State**:
   - If no clinics or salons operate within the search radius of the customer's selected location, the dedicated coverage page renders:
     "We aren’t currently serving in this location."
   - Includes quick-switch buttons for active hubs.

