import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHaversineKm } from '../src/modules/business/business.service.js';
import { autocompleteLocations, geocodeAddress, reverseGeocode } from '../src/modules/maps/maps.service.js';

test('Location Proximity - Haversine Distance Calculation', async (t) => {
  await t.test('Calculates exact distance between Jalandhar and Phagwara (~13 km)', () => {
    // Jalandhar: 31.3056, 75.5794
    // Phagwara (LPU): 31.2530, 75.7037
    const dist = calculateHaversineKm(31.3056, 75.5794, 31.2530, 75.7037);
    assert(dist !== null, 'Distance should not be null');
    assert(dist >= 12 && dist <= 15, `Expected distance ~13 km, got ${dist} km`);
  });

  await t.test('Calculates distance between Punjab and Uttar Pradesh (> 800 km)', () => {
    // Jalandhar (Punjab) to Gorakhpur (UP)
    const dist = calculateHaversineKm(31.3056, 75.5794, 26.7606, 83.3732);
    assert(dist !== null, 'Distance should not be null');
    assert(dist > 800, `Expected distance > 800 km, got ${dist} km`);
  });

  await t.test('Returns null for missing, zero, or invalid coordinates without crashing', () => {
    assert.equal(calculateHaversineKm(0, 0, 31.3056, 75.5794), null);
    assert.equal(calculateHaversineKm(31.3056, 75.5794, 0, 0), null);
    assert.equal(calculateHaversineKm(null, undefined, 31.3056, 75.5794), null);
    assert.equal(calculateHaversineKm(NaN, 75.5794, 31.3056, 75.5794), null);
  });
});

test('Location Discovery - Radius and Proximity Filtering Logic', async (t) => {
  const mockBusinesses = [
    {
      name: 'Jalandhar Clinic',
      location: 'Model Town',
      coordinates: { lat: 31.3056, lng: 75.5794 },
    },
    {
      name: 'Bh-9 Salon',
      location: 'LPU',
      coordinates: { lat: 31.2530, lng: 75.7037 },
    },
    {
      name: 'Hair Studio',
      location: 'Gorakhpur',
      coordinates: { lat: 26.7606, lng: 83.3732 },
    },
    {
      name: 'Unpinned Business',
      location: 'Unknown',
      coordinates: { lat: 0, lng: 0 },
    },
  ];

  await t.test('Customer in Jalandhar discovers Punjab venues and strictly excludes UP', () => {
    const customerLat = 31.3056;
    const customerLng = 75.5794;
    const radius = 30; // 30 km radius

    const nearby = mockBusinesses
      .map((b) => ({
        ...b,
        distanceKm: calculateHaversineKm(customerLat, customerLng, b.coordinates.lat, b.coordinates.lng),
      }))
      .filter((b) => b.distanceKm !== null && b.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    assert.equal(nearby.length, 2, 'Should only discover 2 venues in Punjab');
    assert.equal(nearby[0].name, 'Jalandhar Clinic', 'Nearest should be Jalandhar Clinic');
    assert.equal(nearby[1].name, 'Bh-9 Salon', 'Second nearest should be Bh-9 Salon');
    assert(nearby.every((b) => b.name !== 'Hair Studio'), 'Hair Studio (Gorakhpur) must NOT appear in Punjab');
    assert(nearby.every((b) => b.name !== 'Unpinned Business'), 'Unpinned business must NOT appear');
  });

  await t.test('Customer in Gorakhpur discovers Gorakhpur venue and excludes Punjab', () => {
    const customerLat = 26.7606;
    const customerLng = 83.3732;
    const radius = 30;

    const nearby = mockBusinesses
      .map((b) => ({
        ...b,
        distanceKm: calculateHaversineKm(customerLat, customerLng, b.coordinates.lat, b.coordinates.lng),
      }))
      .filter((b) => b.distanceKm !== null && b.distanceKm <= radius);

    assert.equal(nearby.length, 1);
    assert.equal(nearby[0].name, 'Hair Studio');
  });

  await t.test('Customer in unsupported city (e.g. Mumbai) gets 0 results triggering No-Service page', () => {
    const customerLat = 19.0760; // Mumbai
    const customerLng = 72.8777;
    const radius = 30;

    const nearby = mockBusinesses
      .map((b) => ({
        ...b,
        distanceKm: calculateHaversineKm(customerLat, customerLng, b.coordinates.lat, b.coordinates.lng),
      }))
      .filter((b) => b.distanceKm !== null && b.distanceKm <= radius);

    assert.equal(nearby.length, 0, 'No venues should match in Mumbai');
  });
});

test('Maps Service - Autocomplete and Offline Hub Fallbacks', async (t) => {
  await t.test('Returns autocomplete predictions for Jalandhar', async () => {
    const results = await autocompleteLocations('Jalandhar');
    assert(Array.isArray(results), 'Results should be an array');
    assert(results.length > 0, 'Should return at least 1 prediction');
    const matched = results.some((r) => r.description.toLowerCase().includes('jalandhar') || r.mainText.toLowerCase().includes('jalandhar'));
    assert(matched, 'Prediction should match Jalandhar');
  });

  await t.test('Geocodes known hub or city correctly', async () => {
    const geo = await geocodeAddress('Model Town, Jalandhar, Punjab');
    assert(geo !== null, 'Geocode should return coordinates');
    assert(geo.lat >= 30 && geo.lat <= 33, 'Latitude should be in Punjab region');
    assert(geo.lng >= 74 && geo.lng <= 77, 'Longitude should be in Punjab region');
  });

  await t.test('Reverse geocodes coordinates to human-readable address', async () => {
    const rev = await reverseGeocode(31.3056, 75.5794);
    assert(rev !== null, 'Reverse geocode should not be null');
    assert(rev.formattedAddress, 'Should return formatted address');
  });
});

