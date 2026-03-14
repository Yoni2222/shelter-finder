'use strict';

const fetch = require('node-fetch');
const { RISHON_URL, GOV_CACHE_TTL } = require('../config');
const cache = require('../cache');
const haversine = require('../utils/haversine');
const { nominatimFetch, NOM_LOW } = require('../services/geocoding');

function parseRishonTable(html) {
  const strip = s => (s || '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
  const rows = [];
  const trRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRx.exec(html)) !== null) {
    const cells = [];
    const tdRx = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRx.exec(trMatch[1])) !== null) cells.push(strip(tdMatch[1]));
    if (cells.length < 2) continue;
    const [title, address, neighborhood, description] = cells;
    if (!title || (!title.includes('\u05DE\u05E7\u05DC\u05D8') && !title.includes('\u05DE\u05E8\u05D7\u05D1 \u05DE\u05D5\u05D2\u05DF'))) continue;
    if (!address || address.length < 3) continue;
    rows.push({ title, address, neighborhood: neighborhood || '', description: description || '' });
  }
  return rows;
}

async function loadRishonLeZion() {
  if (cache.rishonCache && Date.now() - cache.rishonCacheTs < GOV_CACHE_TTL) return cache.rishonCache;

  const res = await fetch(RISHON_URL, { headers: { 'User-Agent': 'ShelterFinderApp/1.0' }, timeout: 6000 });
  if (!res.ok) throw new Error(`Rishon HTML HTTP ${res.status}`);
  const html = await res.text();
  const rows = parseRishonTable(html);
  console.log(`[rishon] Parsed ${rows.length} shelter rows from HTML, geocoding via Nominatim\u2026`);

  const shelters = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const r = await nominatimFetch(row.address, { priority: NOM_LOW });
      if (!r.ok) { console.warn(`[rishon] Nominatim HTTP ${r.status} for "${row.address}"`); continue; }
      const arr = await r.json();
      if (!arr || !arr[0]) { console.warn(`[rishon] No result for "${row.address}"`); continue; }
      const fLat = parseFloat(arr[0].lat);
      const fLon = parseFloat(arr[0].lon);
      if (!fLat || !fLon || isNaN(fLat) || isNaN(fLon)) continue;

      const areaMatch = row.description.match(/\u05E9\u05D8\u05D7\s+(\d+)/);
      const capMatch  = row.description.match(/\u05DB\u05DE\u05D5\u05EA \u05D0\u05E0\u05E9\u05D9\u05DD\s*[-\u2013]\s*(\d+)/);
      const area      = areaMatch ? areaMatch[1] : '';
      const capacity  = capMatch  ? capMatch[1]  : '';

      shelters.push({
        id:       `rishon_${i}`,
        lat:      fLat,
        lon:      fLon,
        name:     row.title,
        address:  row.address.replace(/\s*\u05E8\u05D0\u05E9\u05D5\u05DF \u05DC\u05E6\u05D9\u05D5\u05DF\s*$/i, '').trim(),
        city:     '\u05E8\u05D0\u05E9\u05D5\u05DF \u05DC\u05E6\u05D9\u05D5\u05DF',
        capacity: capacity ? `${capacity} \u05D0\u05E0\u05E9\u05D9\u05DD` : (area ? `${area} \u05DE"\u05E8` : ''),
        type:     '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9',
        source:   'gov',
        category: 'public',
      });
    } catch (e) {
      console.warn(`[rishon] geocode error for "${row.address}": ${e.message}`);
    }
  }

  shelters.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  cache.rishonCache   = shelters;
  cache.rishonCacheTs = Date.now();
  console.log(`[rishon] Geocoded ${shelters.length}/${rows.length} shelters via Nominatim`);
  return shelters;
}

async function fetchRishonLeZion(lat, lon, radiusM) {
  if (!cache.rishonCache) return [];
  return cache.rishonCache.filter(s => haversine(lat, lon, s.lat, s.lon) * 1000 <= radiusM);
}

module.exports = { loadRishonLeZion, fetchRishonLeZion };
