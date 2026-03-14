'use strict';

const fetch = require('node-fetch');
const { TEL_AVIV_SHELTER_URL, TEL_AVIV_CACHE_TTL } = require('../config');
const cache = require('../cache');
const haversine = require('../utils/haversine');

async function loadTelAviv() {
  if (cache.telAvivCache && Date.now() - cache.telAvivCacheTs < TEL_AVIV_CACHE_TTL) return cache.telAvivCache;

  const params = new URLSearchParams({
    where: '1=1',
    outFields: 'Full_Address,t_sug,lat,lon,shetach_mr,pail,opening_times,shem,UniqueId,oid_mitkan',
    outSR: '4326',
    returnGeometry: 'true',
    resultRecordCount: '2000',
    f: 'json',
  });

  const res = await fetch(`${TEL_AVIV_SHELTER_URL}?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 6000,
  });
  if (!res.ok) throw new Error(`Tel Aviv GIS HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Tel Aviv GIS: ${json.error.message}`);

  cache.telAvivCache = (json.features || [])
    .map((feat, i) => {
      const a = feat.attributes || {};
      let fLat = a.lat;
      let fLon = a.lon;
      if ((!fLat || !fLon) && feat.geometry) {
        fLon = feat.geometry.x;
        fLat = feat.geometry.y;
      }
      if (!fLat || !fLon) return null;

      const addr      = a.Full_Address || a.shem || '';
      const type      = a.t_sug || '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9';
      const isParking = type.includes('\u05D7\u05E0\u05D9\u05D5\u05DF');
      const sizeSqm   = a.shetach_mr;
      const readiness = a.pail || '';
      const hours     = a.opening_times || '';

      return {
        id:       `tlv_${a.UniqueId || a.oid_mitkan || i}`,
        lat:      fLat,
        lon:      fLon,
        name:     addr || `\u05DE\u05E7\u05DC\u05D8 \u05EA"\u05D0 #${i + 1}`,
        address:  addr,
        city:     '\u05EA\u05DC \u05D0\u05D1\u05D9\u05D1-\u05D9\u05E4\u05D5',
        capacity: sizeSqm ? `${sizeSqm} \u05DE"\u05E8` : '',
        type,
        hours:    hours || readiness || '',
        source:   'gov',
        category: isParking ? 'parking' : 'public',
      };
    })
    .filter(Boolean);

  cache.telAvivCacheTs = Date.now();
  console.log(`[tel-aviv] Cached ${cache.telAvivCache.length} shelters`);
  return cache.telAvivCache;
}

async function fetchTelAviv(lat, lon, radiusM) {
  const all = await loadTelAviv();
  return all.filter(s => haversine(lat, lon, s.lat, s.lon) * 1000 <= radiusM);
}

module.exports = { loadTelAviv, fetchTelAviv };
