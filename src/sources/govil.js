'use strict';

const fetch = require('node-fetch');
const { GOV_RESOURCES, GOV_CACHE_TTL } = require('../config');
const cache = require('../cache');
const haversine = require('../utils/haversine');

async function loadGovResource(resource) {
  const cached = cache.govCache[resource.id];
  if (cached && Date.now() - cached.ts < GOV_CACHE_TTL) return cached.data;

  console.log(`[gov] Loading resource ${resource.id} (${resource.city})...`);
  const res = await fetch(
    `https://data.gov.il/api/3/action/datastore_search?resource_id=${resource.id}&limit=10000`,
    { timeout: 7000 }
  );
  if (!res.ok) throw new Error(`data.gov.il HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error('data.gov.il: success=false');

  const shelters = json.result.records
    .map(rec => {
      const lat = parseFloat(rec[resource.latField]);
      const lon = parseFloat(rec[resource.lonField]);
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) return null;

      const rawName = rec[resource.nameField];
      const name = rawName
        ? (rawName.startsWith('\u05DE\u05E7\u05DC\u05D8') ? rawName : `\u05DE\u05E7\u05DC\u05D8 ${rawName}`)
        : `\u05DE\u05E7\u05DC\u05D8 #${rec._id}`;

      return {
        id: `gov_${resource.id}_${rec._id}`,
        lat, lon, name,
        address: rec.address || rec.ADDRESS || rec['\u05DB\u05EA\u05D5\u05D1\u05EA'] || rec.street || '',
        city: rec.city || rec.CITY || rec['\u05E2\u05D9\u05E8'] || resource.city,
        capacity: rec.capacity || rec.CAPACITY || rec['\u05E7\u05D9\u05D1\u05D5\u05DC\u05EA'] || '',
        type: '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9',
        source: 'gov',
        category: 'public',
      };
    })
    .filter(Boolean);

  console.log(`[gov] Loaded ${shelters.length} shelters for ${resource.city}`);
  cache.govCache[resource.id] = { data: shelters, ts: Date.now() };
  return shelters;
}

async function fetchDataGov(userLat, userLon, radiusM) {
  const results = [];
  for (const resource of GOV_RESOURCES) {
    try {
      const all    = await loadGovResource(resource);
      const nearby = all.filter(s => haversine(userLat, userLon, s.lat, s.lon) * 1000 <= radiusM);
      results.push(...nearby);
    } catch (e) {
      console.warn(`[gov] resource ${resource.id} failed:`, e.message);
    }
  }
  return results;
}

module.exports = { loadGovResource, fetchDataGov };
