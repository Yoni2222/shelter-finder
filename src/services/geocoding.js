'use strict';

const fetch = require('node-fetch');
const { GEOCODE_CACHE_TTL } = require('../config');
const cache = require('../cache');

// ─────────────────────────────────────────────
// Nominatim rate limiter — priority queue, 1.2s gap between ALL requests.
//
// Two priority levels:
//   NOM_HIGH (10) — user-facing /api/geocode: jumps to front of queue
//   NOM_LOW  (0)  — background municipality geocoding: waits at back
//
// The gap wait happens BEFORE dequeueing, so a high-priority request
// that arrives mid-sleep will be picked up as soon as the gap expires.
// ─────────────────────────────────────────────
const NOMINATIM_GAP_MS = 1200;
const NOM_HIGH = 10;   // user searches
const NOM_LOW  = 0;    // background pre-geocoding

let _nomLastMs   = 0;
let _nomDraining = false;
const _nomQueue  = []; // [{ priority, url, resolve, reject }, ...]
const _NOM_HDR   = { 'Accept-Language': 'he,en', 'User-Agent': 'ShelterFinderApp/1.0' };

// dropType: if set, any previously queued item with the SAME dropType is cancelled
// before the new item is inserted. This keeps at most 1 autocomplete request in
// the queue at any time, no matter how fast the user types.
function nominatimFetch(q, { limit = 1, addressdetails = 0, priority = NOM_LOW, dropType, lang = 'he' } = {}) {
  const params = {
    format: 'json',
    q: q.includes('\u05D9\u05E9\u05E8\u05D0\u05DC') || q.toLowerCase().includes('israel') ? q : q + (lang === 'en' ? ', Israel' : ', \u05D9\u05E9\u05E8\u05D0\u05DC'),
    limit,
    addressdetails,
    'accept-language': lang,
  };
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams(params)}`;

  return new Promise((resolve, reject) => {
    // Drop stale items of the same type (e.g. previous autocomplete requests)
    if (dropType) {
      for (let i = _nomQueue.length - 1; i >= 0; i--) {
        if (_nomQueue[i].dropType === dropType) {
          const [dropped] = _nomQueue.splice(i, 1);
          dropped.reject(Object.assign(new Error('superseded'), { superseded: true }));
        }
      }
    }

    // Insert in priority order — highest priority first
    let i = 0;
    while (i < _nomQueue.length && _nomQueue[i].priority >= priority) i++;
    _nomQueue.splice(i, 0, { priority, url, resolve, reject, dropType });
    if (!_nomDraining) _nomDrain();
  });
}

async function _nomDrain() {
  _nomDraining = true;
  while (_nomQueue.length > 0) {
    // Wait for rate-limit gap BEFORE dequeueing so high-priority items can jump in
    const gap = NOMINATIM_GAP_MS - (Date.now() - _nomLastMs);
    if (gap > 0) await new Promise(r => setTimeout(r, gap));
    if (_nomQueue.length === 0) break; // queue may have drained while sleeping

    const { url, resolve, reject } = _nomQueue.shift(); // highest priority first
    _nomLastMs = Date.now();
    try {
      resolve(await fetch(url, { headers: _NOM_HDR, timeout: 6000 }));
    } catch (e) {
      reject(e);
    }
  }
  _nomDraining = false;
}

// ─────────────────────────────────────────────
// Photon geocoder (Komoot) — used as fallback when Nominatim is rate-limited.
// Free, no API key, OSM-based, returns GeoJSON FeatureCollection.
// We convert it to a Nominatim-compatible array so the frontend stays unchanged.
// ─────────────────────────────────────────────
async function photonFetch(q, limit = 5, lang = 'he') {
  const query = q.includes('\u05D9\u05E9\u05E8\u05D0\u05DC') || q.toLowerCase().includes('israel') ? q : q + (lang === 'en' ? ' Israel' : ' \u05D9\u05E9\u05E8\u05D0\u05DC');
  const params = new URLSearchParams({
    q: query, limit: String(limit),
    lat: '31.5', lon: '34.8',  // location bias: centre of Israel
    lang: lang === 'en' ? 'en' : 'default',
  });
  const r = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 5000,  // fail fast (5s) if Photon is unreachable — don't block autocomplete
  });
  if (!r.ok) throw new Error(`Photon HTTP ${r.status}`);
  const json = await r.json();
  return (json.features || []).map(f => {
    const [fLon, fLat] = f.geometry.coordinates;
    const p = f.properties;
    const parts = [];
    if (p.name)   parts.push(p.name);
    if (p.street) parts.push(p.housenumber ? `${p.street} ${p.housenumber}` : p.street);
    const city = p.city || p.town || p.village;
    if (city)     parts.push(city);
    if (p.state)  parts.push(p.state);
    return { lat: String(fLat), lon: String(fLon), display_name: parts.filter(Boolean).join(', ') || q };
  }).filter(f => f.lat && f.lon);
}

// ─────────────────────────────────────────────
// Geocode a single address (Nominatim), with cache.
// Uses the global rate limiter — safe to call from any context.
// ─────────────────────────────────────────────
async function geocodeAddress(addressStr) {
  const key = addressStr.trim();
  if (!key) return null;
  const cached = cache.geocodeCache[key];
  if (cached && Date.now() - cached.ts < GEOCODE_CACHE_TTL) return cached;

  try {
    const r = await nominatimFetch(key);
    if (!r.ok) return null;
    const arr = await r.json();
    if (!arr || !arr[0]) return null;
    const entry = { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon), ts: Date.now() };
    cache.geocodeCache[key] = entry;
    return entry;
  } catch {
    return null;
  }
}

module.exports = {
  nominatimFetch,
  photonFetch,
  geocodeAddress,
  NOM_HIGH,
  NOM_LOW,
};
