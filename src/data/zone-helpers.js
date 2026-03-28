'use strict';

const zoneData = require('./zone-city-map.json');

/**
 * Haversine distance in km between two lat/lon points.
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find the best matching zone for given GPS coordinates.
 * Returns the zone object with topic, timeToShelter, etc., or null if outside Israel.
 * Uses a two-pass approach: first checks if within any zone's radius,
 * then falls back to closest zone center if within Israel.
 */
function findZoneByCoords(lat, lon) {
  const scored = [];

  for (const [name, zone] of Object.entries(zoneData.zones)) {
    const dist = haversine(lat, lon, zone.center.lat, zone.center.lon);
    scored.push({ name, zone, dist });
  }

  scored.sort((a, b) => a.dist - b.dist);

  if (scored.length === 0) return null;

  // Reject if clearly outside Israel (more than 100km from any zone center)
  if (scored[0].dist > 100) return null;

  // First pass: find zones where point is within the zone radius
  const inRadius = scored.filter(s => s.dist <= s.zone.radius);
  if (inRadius.length > 0) {
    // Pick the smallest zone that contains the point (most specific match)
    inRadius.sort((a, b) => a.zone.radius - b.zone.radius);
    const best = inRadius[0];
    return { ...best.zone, name: best.name, distance: Math.round(best.dist * 10) / 10 };
  }

  // Fallback: return the closest zone center
  const best = scored[0];
  return { ...best.zone, name: best.name, distance: Math.round(best.dist * 10) / 10 };
}

/**
 * Get neighbor topic strings for a given zone topic.
 * Returns an array of topic strings, or empty array if not found.
 */
function getNeighborTopics(zoneTopic) {
  for (const zone of Object.values(zoneData.zones)) {
    if (zone.topic === zoneTopic) {
      return zone.neighbors || [];
    }
  }
  return [];
}

/**
 * Look up a zone by its Hebrew name (exact match against zones or alertNameToZone).
 * Returns the zone object with topic and metadata, or null.
 */
function getZoneByName(hebrewName) {
  // Direct zone name match
  if (zoneData.zones[hebrewName]) {
    return { ...zoneData.zones[hebrewName], name: hebrewName };
  }

  // Alert area name match (e.g. "תל אביב - מרכז העיר")
  const topic = zoneData.alertNameToZone[hebrewName];
  if (topic) {
    // Find the parent zone with this topic
    for (const [name, zone] of Object.entries(zoneData.zones)) {
      if (zone.topic === topic) {
        return { ...zone, name, alertArea: hebrewName };
      }
    }
  }

  return null;
}

/**
 * Get zone topic for a city name (from our 86-city list).
 * Returns array of zone topic strings, or empty array.
 */
function getZonesForCity(cityName) {
  return zoneData.cityToZones[cityName] || [];
}

/**
 * Get the time-to-shelter in seconds for a given zone topic.
 * Returns the countdown value, or null if zone not found.
 */
function getTimeToShelter(zoneTopic) {
  for (const zone of Object.values(zoneData.zones)) {
    if (zone.topic === zoneTopic) {
      return zone.timeToShelter;
    }
  }
  return null;
}

/**
 * Get all zone topics (for subscribing to all alerts).
 * Returns array of all topic strings.
 */
function getAllTopics() {
  return Object.values(zoneData.zones).map(z => z.topic);
}

/**
 * Get zone topic plus all neighbor topics for a given zone.
 * Useful for subscribing users to their zone + nearby zones.
 */
function getTopicsWithNeighbors(zoneTopic) {
  const neighbors = getNeighborTopics(zoneTopic);
  return [zoneTopic, ...neighbors];
}

module.exports = {
  findZoneByCoords,
  getNeighborTopics,
  getZoneByName,
  getZonesForCity,
  getTimeToShelter,
  getAllTopics,
  getTopicsWithNeighbors,
  haversine,
};
