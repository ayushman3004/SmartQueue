import * as mapsService from "./maps.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";

/**
 * Autocomplete address predictions
 * GET /api/maps/autocomplete?input=...
 */
export const autocomplete = asyncHandler(async (req, res) => {
  const { input, sessionToken } = req.query;
  const predictions = await mapsService.autocompleteLocations(input, sessionToken);
  res.json(new ApiResponse(200, { predictions }, "Location suggestions retrieved"));
});

/**
 * Geocode text address to coordinates and structured location components
 * GET /api/maps/geocode?address=...
 */
export const geocode = asyncHandler(async (req, res) => {
  const { address } = req.query;
  if (!address) {
    throw new ApiError(400, "Address query parameter is required for geocoding");
  }
  const result = await mapsService.geocodeAddress(address);
  if (!result) {
    throw new ApiError(404, "Could not resolve coordinates for the provided address");
  }
  res.json(new ApiResponse(200, { location: result }, "Address geocoded successfully"));
});

/**
 * Reverse geocode latitude/longitude to a human-readable area & address
 * GET /api/maps/reverse-geocode?lat=...&lng=...
 */
export const reverseGeocode = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    throw new ApiError(400, "Both 'lat' and 'lng' parameters are required for reverse geocoding");
  }
  const result = await mapsService.reverseGeocode(Number(lat), Number(lng));
  if (!result) {
    throw new ApiError(404, "Could not resolve address for coordinates");
  }
  res.json(new ApiResponse(200, { location: result }, "Location resolved successfully"));
});

