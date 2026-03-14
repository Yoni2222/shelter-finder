'use strict';

const fetch = require('node-fetch');
const { YEHUD_ITEM_URL, GOV_CACHE_TTL } = require('../config');
const cache = require('../cache');
const haversine = require('../utils/haversine');

async function loadYehud() {
  if (cache.yehudCache && Date.now() - cache.yehudCacheTs < GOV_CACHE_TTL) return cache.yehudCache;

  const res = await fetch(YEHUD_ITEM_URL, { headers: { 'User-Agent': 'ShelterFinderApp/1.0' }, timeout: 6000 });
  if (!res.ok) throw new Error(`Yehud ArcGIS item HTTP ${res.status}`);
  const json = await res.json();

  const layer = (json.operationalLayers || [])[0];
  const features = layer?.featureCollection?.featureSet?.features || [];

  cache.yehudCache = features
    .map((feat, i) => {
      const a    = feat.attributes || {};
      const fLat = parseFloat(a.latitude  ?? a.Latitude  ?? '');
      const fLon = parseFloat(a.longitude ?? a.Longitude ?? '');
      if (!fLat || !fLon || isNaN(fLat) || isNaN(fLon)) return null;

      const addr  = a.ld      || a.Address || '';
      const title = a.appld   || a.title   || '';
      const type  = a.type    || '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9';

      return {
        id:       `yehud_${a.__OBJECTID || i}`,
        lat:      fLat,
        lon:      fLon,
        name:     title || (addr ? `\u05DE\u05E7\u05DC\u05D8 - ${addr}` : `\u05DE\u05E7\u05DC\u05D8 \u05D9\u05D4\u05D5\u05D3 #${i + 1}`),
        address:  addr,
        city:     '\u05D9\u05D4\u05D5\u05D3-\u05DE\u05D5\u05E0\u05D5\u05E1\u05D5\u05DF',
        capacity: '',
        type,
        source:   'gov',
        category: 'public',
      };
    })
    .filter(Boolean);

  cache.yehudCacheTs = Date.now();
  console.log(`[yehud] Cached ${cache.yehudCache.length} shelters`);
  return cache.yehudCache;
}

async function fetchYehud(lat, lon, radiusM) {
  const all = await loadYehud();
  return all.filter(s => haversine(lat, lon, s.lat, s.lon) * 1000 <= radiusM);
}

module.exports = { loadYehud, fetchYehud };
