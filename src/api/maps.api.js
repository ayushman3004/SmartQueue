import api from "./axios.js";

/**
 * Autocomplete address or area query via server-side proxy
 */
export const autocompleteLocations = async (input, sessionToken = "") => {
  const res = await api.get("/maps/autocomplete", {
    params: { input, sessionToken },
  });
  return res.data?.data?.suggestions || [];
};

/**
 * Geocode address or place ID to coordinates and structured location components
 */
export const geocodeAddress = async ({ address = "", placeId = "" } = {}) => {
  const res = await api.get("/maps/geocode", {
    params: { address, placeId },
  });
  return res.data?.data || null;
};

/**
 * Reverse geocode latitude and longitude to readable address and area
 */
export const reverseGeocodeCoords = async (lat, lng) => {
  const res = await api.get("/maps/reverse-geocode", {
    params: { lat, lng },
  });
  return res.data?.data || null;
};

