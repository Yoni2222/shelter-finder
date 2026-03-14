'use strict';

const fetch = require('node-fetch');
const { GEOJSON_RESOURCES, GOV_CACHE_TTL } = require('../config');
const cache = require('../cache');
const haversine = require('../utils/haversine');

async function loadGeoJsonResource(resource) {
  const cached = cache.geojsonCache[resource.url];
  if (cached && Date.now() - cached.ts < GOV_CACHE_TTL) return cached.data;

  console.log(`[geojson] Loading ${resource.city}...`);
  const res = await fetch(resource.url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 6000,
  });
  if (!res.ok) throw new Error(`GeoJSON HTTP ${res.status}`);
  const json = await res.json();

  const shelters = (json.features || [])
    .map((feat, i) => {
      const [lon, lat] = feat.geometry?.coordinates || [];
      if (!lat || !lon) return null;
      const props   = feat.properties || {};
      const rawName = props[resource.nameField];
      const name    = rawName ? `\u05DE\u05E7\u05DC\u05D8 ${rawName}` : `\u05DE\u05E7\u05DC\u05D8 ${resource.city} #${i + 1}`;
      return {
        id: `geojson_${resource.city}_${props.OBJECTID || i}`,
        lat, lon, name,
        address:  props['\u05DB\u05EA\u05D5\u05D1\u05EA'] || props.address || props.ADDRESS || '',
        city:     resource.city,
        capacity: props['\u05E7\u05D9\u05D1\u05D5\u05DC\u05EA'] || props.capacity || '',
        type:     '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9',
        source:   'gov',
        category: 'public',
      };
    })
    .filter(Boolean);

  console.log(`[geojson] Loaded ${shelters.length} shelters for ${resource.city}`);
  cache.geojsonCache[resource.url] = { data: shelters, ts: Date.now() };
  return shelters;
}

async function fetchGeoJsonSources(userLat, userLon, radiusM) {
  const results = [];
  for (const resource of GEOJSON_RESOURCES) {
    try {
      const all    = await loadGeoJsonResource(resource);
      const nearby = all.filter(s => haversine(userLat, userLon, s.lat, s.lon) * 1000 <= radiusM);
      results.push(...nearby);
    } catch (e) {
      console.warn(`[geojson] ${resource.city} failed:`, e.message);
    }
  }
  return results;
}

module.exports = { loadGeoJsonResource, fetchGeoJsonSources };
