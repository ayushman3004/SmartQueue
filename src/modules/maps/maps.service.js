/**
 * Google Maps Platform & Geocoding Service
 * Secure server-side wrapper for Google Places Autocomplete and Geocoding APIs,
 * with resilient offline and OpenStreetMap (Nominatim) fallbacks.
 */

// Popular Indian cities and hubs for instant offline lookup
const POPULAR_HUBS = [
  {
    placeId: "hub-jalandhar-model-town",
    description: "Model Town, Jalandhar, Punjab, India",
    mainText: "Model Town",
    secondaryText: "Jalandhar, Punjab, India",
    lat: 31.3056,
    lng: 75.5794,
    city: "Jalandhar",
    state: "Punjab",
    postalCode: "144003",
  },
  {
    placeId: "hub-phagwara-lpu",
    description: "Lovely Professional University (LPU), Phagwara, Punjab, India",
    mainText: "Lovely Professional University (LPU)",
    secondaryText: "Phagwara, Punjab, India",
    lat: 31.2530,
    lng: 75.7037,
    city: "Phagwara",
    state: "Punjab",
    postalCode: "144402",
  },
  {
    placeId: "hub-gorakhpur-city",
    description: "Gorakhpur, Uttar Pradesh, India",
    mainText: "Gorakhpur",
    secondaryText: "Uttar Pradesh, India",
    lat: 26.7606,
    lng: 83.3732,
    city: "Gorakhpur",
    state: "Uttar Pradesh",
    postalCode: "273001",
  },
  {
    placeId: "hub-kolkata-center",
    description: "Kolkata, West Bengal, India",
    mainText: "Kolkata",
    secondaryText: "West Bengal, India",
    lat: 22.5726,
    lng: 88.3639,
    city: "Kolkata",
    state: "West Bengal",
    postalCode: "700001",
  },
  {
    placeId: "hub-salt-lake-kolkata",
    description: "Salt Lake Sector V, Bidhannagar, Kolkata, West Bengal, India",
    mainText: "Salt Lake Sector V",
    secondaryText: "Bidhannagar, Kolkata, West Bengal",
    lat: 22.5867,
    lng: 88.4178,
    city: "Kolkata",
    state: "West Bengal",
    postalCode: "700091",
  },
  {
    placeId: "hub-new-town-kolkata",
    description: "New Town, Action Area I, Kolkata, West Bengal, India",
    mainText: "New Town",
    secondaryText: "Kolkata, West Bengal",
    lat: 22.5958,
    lng: 88.4796,
    city: "Kolkata",
    state: "West Bengal",
    postalCode: "700156",
  },
  {
    placeId: "hub-bengaluru-indiranagar",
    description: "Indiranagar, Bengaluru, Karnataka, India",
    mainText: "Indiranagar",
    secondaryText: "Bengaluru, Karnataka, India",
    lat: 12.9784,
    lng: 77.6408,
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560038",
  },
  {
    placeId: "hub-bengaluru-koramangala",
    description: "Koramangala, Bengaluru, Karnataka, India",
    mainText: "Koramangala",
    secondaryText: "Bengaluru, Karnataka, India",
    lat: 12.9352,
    lng: 77.6245,
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560034",
  },
  {
    placeId: "hub-mumbai-bandra",
    description: "Bandra West, Mumbai, Maharashtra, India",
    mainText: "Bandra West",
    secondaryText: "Mumbai, Maharashtra, India",
    lat: 19.0596,
    lng: 72.8295,
    city: "Mumbai",
    state: "Maharashtra",
    postalCode: "400050",
  },
  {
    placeId: "hub-delhi-connaught",
    description: "Connaught Place, New Delhi, Delhi, India",
    mainText: "Connaught Place",
    secondaryText: "New Delhi, Delhi, India",
    lat: 28.6315,
    lng: 77.2167,
    city: "New Delhi",
    state: "Delhi",
    postalCode: "110001",
  },
  {
    placeId: "hub-chandigarh-sector-17",
    description: "Sector 17, Chandigarh, India",
    mainText: "Sector 17",
    secondaryText: "Chandigarh, India",
    lat: 30.7415,
    lng: 76.7794,
    city: "Chandigarh",
    state: "Punjab",
    postalCode: "160017",
  },
  {
    placeId: "hub-ludhiana-model-town",
    description: "Model Town, Ludhiana, Punjab, India",
    mainText: "Model Town",
    secondaryText: "Ludhiana, Punjab, India",
    lat: 30.8872,
    lng: 75.8364,
    city: "Ludhiana",
    state: "Punjab",
    postalCode: "141002",
  },
  {
    placeId: "hub-amritsar-golden-temple",
    description: "Amritsar, Punjab, India",
    mainText: "Amritsar",
    secondaryText: "Punjab, India",
    lat: 31.6340,
    lng: 74.8723,
    city: "Amritsar",
    state: "Punjab",
    postalCode: "143001",
  },
];

/**
 * Autocomplete addresses/locations using Google Places API with Nominatim fallback
 */
export async function autocompleteLocations(input, sessionToken = "") {
  const cleanInput = String(input || "").trim();
  if (!cleanInput || cleanInput.length < 2) {
    return POPULAR_HUBS.slice(0, 6);
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // 1. Try Google Places Autocomplete API if key configured
  if (apiKey && !apiKey.includes("your_google_maps")) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
      url.searchParams.set("input", cleanInput);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("components", "country:in");
      url.searchParams.set("types", "geocode|establishment");
      if (sessionToken) url.searchParams.set("sessiontoken", sessionToken);

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "OK" && Array.isArray(data.predictions)) {
          return data.predictions.map((p) => ({
            placeId: p.place_id,
            description: p.description,
            mainText: p.structured_formatting?.main_text || p.description,
            secondaryText: p.structured_formatting?.secondary_text || "",
          }));
        }
      }
    } catch (err) {
      console.warn("Google Places Autocomplete failed, falling back to alternative source:", err.message);
    }
  }

  // 2. Try Nominatim (OpenStreetMap) geocoding for open-source autocomplete
  try {
    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
    nominatimUrl.searchParams.set("format", "json");
    nominatimUrl.searchParams.set("q", cleanInput);
    nominatimUrl.searchParams.set("countrycodes", "in");
    nominatimUrl.searchParams.set("limit", "7");
    nominatimUrl.searchParams.set("addressdetails", "1");

    const res = await fetch(nominatimUrl.toString(), {
      headers: { "User-Agent": "ServeQ-Platform/1.0 (contact@serveq.tech)" },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        return items.map((item) => {
          const main =
            item.address?.suburb ||
            item.address?.neighbourhood ||
            item.address?.city ||
            item.address?.town ||
            item.display_name.split(",")[0];
          return {
            placeId: `osm-${item.place_id}`,
            description: item.display_name,
            mainText: main || item.display_name.split(",")[0],
            secondaryText: item.display_name.replace(main + ",", "").trim(),
            lat: Number(item.lat),
            lng: Number(item.lon),
            city: item.address?.city || item.address?.town || item.address?.state_district || "",
            state: item.address?.state || "",
            postalCode: item.address?.postcode || "",
          };
        });
      }
    }
  } catch (err) {
    // Ignore external fetch timeout
  }

  // 3. Resilient Local Hub / In-Memory Matching
  const lower = cleanInput.toLowerCase();
  const matched = POPULAR_HUBS.filter(
    (h) =>
      h.description.toLowerCase().includes(lower) ||
      h.mainText.toLowerCase().includes(lower) ||
      h.city.toLowerCase().includes(lower) ||
      h.state.toLowerCase().includes(lower) ||
      h.postalCode.includes(lower)
  );

  return matched.length > 0 ? matched : POPULAR_HUBS.slice(0, 5);
}

/**
 * Geocode text address into coordinates and structured address components
 */
export async function geocodeAddress(address) {
  const cleanAddress = String(address || "").trim();
  if (!cleanAddress) return null;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // 1. Try Google Geocoding API if key configured
  if (apiKey && !apiKey.includes("your_google_maps")) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", cleanAddress);
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "OK" && data.results?.[0]) {
          const r = data.results[0];
          const lat = r.geometry?.location?.lat;
          const lng = r.geometry?.location?.lng;

          let city = "";
          let state = "";
          let postalCode = "";
          let area = "";

          for (const c of r.address_components || []) {
            if (c.types.includes("locality")) city = c.long_name;
            else if (!city && c.types.includes("administrative_area_level_2")) city = c.long_name;
            if (c.types.includes("administrative_area_level_1")) state = c.long_name;
            if (c.types.includes("postal_code")) postalCode = c.long_name;
            if (c.types.includes("sublocality") || c.types.includes("neighborhood")) area = c.long_name;
          }

          return {
            lat: Number(Number(lat).toFixed(6)),
            lng: Number(Number(lng).toFixed(6)),
            formattedAddress: r.formatted_address,
            area: area || city,
            city,
            state,
            postalCode,
          };
        }
      }
    } catch (err) {
      console.warn("Google Geocoding failed, trying fallback:", err.message);
    }
  }

  // 2. OpenStreetMap / Nominatim Fallback
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("q", cleanAddress);
    url.searchParams.set("countrycodes", "in");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "ServeQ-Platform/1.0 (contact@serveq.tech)" },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const items = await res.json();
      if (items?.[0]) {
        const item = items[0];
        const addr = item.address || {};
        const city = addr.city || addr.town || addr.municipality || addr.state_district || "";
        const state = addr.state || "";
        const area = addr.suburb || addr.neighbourhood || addr.residential || city;
        return {
          lat: Number(Number(item.lat).toFixed(6)),
          lng: Number(Number(item.lon).toFixed(6)),
          formattedAddress: item.display_name,
          area,
          city,
          state,
          postalCode: addr.postcode || "",
        };
      }
    }
  } catch (err) {
    // Non-fatal fallback
  }

  // 3. Fallback to Known Hubs matching
  const lower = cleanAddress.toLowerCase();
  for (const hub of POPULAR_HUBS) {
    if (lower.includes(hub.city.toLowerCase()) || lower.includes(hub.mainText.toLowerCase())) {
      return {
        lat: hub.lat,
        lng: hub.lng,
        formattedAddress: hub.description,
        area: hub.mainText,
        city: hub.city,
        state: hub.state,
        postalCode: hub.postalCode,
      };
    }
  }

  return null;
}

/**
 * Reverse geocode coordinates (lat, lng) to human-readable address
 */
export async function reverseGeocode(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (isNaN(nLat) || isNaN(nLng) || (nLat === 0 && nLng === 0)) return null;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // 1. Google Geocoding API if key configured
  if (apiKey && !apiKey.includes("your_google_maps")) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("latlng", `${nLat},${nLng}`);
      url.searchParams.set("key", apiKey);

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "OK" && data.results?.[0]) {
          const r = data.results[0];
          let city = "";
          let state = "";
          let postalCode = "";
          let area = "";

          for (const c of r.address_components || []) {
            if (c.types.includes("locality")) city = c.long_name;
            else if (!city && c.types.includes("administrative_area_level_2")) city = c.long_name;
            if (c.types.includes("administrative_area_level_1")) state = c.long_name;
            if (c.types.includes("postal_code")) postalCode = c.long_name;
            if (c.types.includes("sublocality") || c.types.includes("neighborhood")) area = c.long_name;
          }

          const readableLabel = area && city && area !== city ? `${area}, ${city}` : city ? `${city}, ${state}` : r.formatted_address;

          return {
            lat: Number(nLat.toFixed(6)),
            lng: Number(nLng.toFixed(6)),
            formattedAddress: r.formatted_address,
            displayName: readableLabel,
            area: area || city,
            city,
            state,
            postalCode,
          };
        }
      }
    } catch (err) {
      console.warn("Google Reverse Geocoding failed, trying fallback:", err.message);
    }
  }

  // 2. OpenStreetMap / Nominatim Fallback
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "json");
    url.searchParams.set("lat", String(nLat));
    url.searchParams.set("lon", String(nLng));
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "ServeQ-Platform/1.0 (contact@serveq.tech)" },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.address) {
        const a = data.address;
        const city = a.city || a.town || a.municipality || a.county || a.state_district || "";
        const state = a.state || "";
        const area = a.suburb || a.neighbourhood || a.residential || a.village || city;
        const readableLabel = area && city && area !== city ? `${area}, ${city}` : city ? `${city}, ${state}` : data.display_name.split(",").slice(0, 2).join(",");

        return {
          lat: Number(nLat.toFixed(6)),
          lng: Number(nLng.toFixed(6)),
          formattedAddress: data.display_name,
          displayName: readableLabel,
          area,
          city,
          state,
          postalCode: a.postcode || "",
        };
      }
    }
  } catch (err) {
    // Non-critical fallback
  }

  // 3. Distance match to known hubs
  let closestHub = null;
  let minDistance = Infinity;

  for (const hub of POPULAR_HUBS) {
    const dLat = ((hub.lat - nLat) * Math.PI) / 180;
    const dLng = ((hub.lng - nLng) * Math.PI) / 180;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng) * 6371;
    if (dist < minDistance) {
      minDistance = dist;
      closestHub = hub;
    }
  }

  if (closestHub && minDistance <= 30) {
    return {
      lat: nLat,
      lng: nLng,
      formattedAddress: closestHub.description,
      displayName: closestHub.description.split(",").slice(0, 2).join(","),
      area: closestHub.mainText,
      city: closestHub.city,
      state: closestHub.state,
      postalCode: closestHub.postalCode,
    };
  }

  return {
    lat: nLat,
    lng: nLng,
    formattedAddress: `${nLat.toFixed(4)}, ${nLng.toFixed(4)}`,
    displayName: `Location (${nLat.toFixed(2)}, ${nLng.toFixed(2)})`,
    area: "",
    city: "",
    state: "",
    postalCode: "",
  };
}

