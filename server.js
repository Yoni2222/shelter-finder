'use strict';

const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
// Known data.gov.il shelter resources (CSV/tabular via CKAN API)
// ─────────────────────────────────────────────
const GOV_RESOURCES = [
  {
    id: 'e191d913-11e4-4d87-a4b2-91587aab6611',
    city: 'באר שבע',
    latField: 'lat',
    lonField: 'lon',
    nameField: 'name',
  },
];

// ─────────────────────────────────────────────
// GeoJSON shelter sources
// ─────────────────────────────────────────────
const GEOJSON_RESOURCES = [
  {
    url: 'https://jerusalem.datacity.org.il/dataset/3e97d0fc-4268-4aea-844d-12588f55d809/resource/b9bd9575-d431-4f9d-af4b-1413d3c13590/download/data.geojson',
    city: 'ירושלים',
    nameField: 'מספר מקלט',
  },
];

// ─────────────────────────────────────────────
// Petah Tikva Municipality GIS — ArcGIS FeatureServer
// "מרחבים מוגנים ציבוריים" — 132 features with real WGS84 coordinates.
// No Nominatim needed: coordinates come directly from the service.
// Discovered via: arcgis.com org tfeLX7LFVABzD11G (muni-petah-tikva.opendata.arcgis.com)
// Fields: Address, PlaceName, SUG (type), complex (1=public/4=institution),
//         Neigborhood, Activated (1=active), Accessable (0/1), OBJECTID
// ─────────────────────────────────────────────
const PETAH_TIKVA_URL =
  'https://services9.arcgis.com/tfeLX7LFVABzD11G/arcgis/rest/services/' +
  '%D7%9E%D7%A8%D7%97%D7%91%D7%99%D7%9D/FeatureServer/0/query';

// ─────────────────────────────────────────────
// Yehud-Monosson — ArcGIS embedded feature collection (30 shelters)
// Item: https://www.arcgis.com/home/item.html?id=5ea507fd44a049dd9c9b4babf2ab0e3f
// Data: operationalLayers[0].featureCollection.featureSet.features[]
// Fields: appld (shelter #), ld (address), latitude, longitude, type, title
// Coordinates: attributes.latitude / attributes.longitude (WGS84) — no projection needed
// ─────────────────────────────────────────────
const YEHUD_ITEM_URL =
  'https://www.arcgis.com/sharing/rest/content/items/5ea507fd44a049dd9c9b4babf2ab0e3f/data?f=json';

async function loadYehud() {
  if (_yehudCache && Date.now() - _yehudCacheTs < GOV_CACHE_TTL) return _yehudCache;

  const res = await fetch(YEHUD_ITEM_URL, { headers: { 'User-Agent': 'ShelterFinderApp/1.0' }, timeout: 15000 });
  if (!res.ok) throw new Error(`Yehud ArcGIS item HTTP ${res.status}`);
  const json = await res.json();

  // Navigate into the embedded feature collection
  const layer = (json.operationalLayers || [])[0];
  const features = layer?.featureCollection?.featureSet?.features || [];

  _yehudCache = features
    .map((feat, i) => {
      const a    = feat.attributes || {};
      const fLat = parseFloat(a.latitude  ?? a.Latitude  ?? '');
      const fLon = parseFloat(a.longitude ?? a.Longitude ?? '');
      if (!fLat || !fLon || isNaN(fLat) || isNaN(fLon)) return null;

      const addr  = a.ld      || a.Address || '';
      const title = a.appld   || a.title   || '';
      const type  = a.type    || 'מקלט ציבורי';

      return {
        id:       `yehud_${a.__OBJECTID || i}`,
        lat:      fLat,
        lon:      fLon,
        name:     title || (addr ? `מקלט – ${addr}` : `מקלט יהוד #${i + 1}`),
        address:  addr,
        city:     'יהוד-מונוסון',
        capacity: '',
        type,
        source:   'gov',
        category: 'public',
      };
    })
    .filter(Boolean);

  _yehudCacheTs = Date.now();
  console.log(`[yehud] Cached ${_yehudCache.length} shelters`);
  return _yehudCache;
}

async function fetchYehud(lat, lon, radiusM) {
  const all = await loadYehud();
  return all.filter(s => haversine(lat, lon, s.lat, s.lon) * 1000 <= radiusM);
}

// ─────────────────────────────────────────────
// Rishon LeZion Municipality — HTML table of public shelters
// Page: https://www.rishonlezion.muni.il/Residents/SecurityEmergency/pages/publicshelter.aspx
// Columns: כותרת | כתובת | שכונה | תיאור | נגישות | מרחב מוגן
// Address field already contains city name e.g. "מאיר אבנר 22 ראשון לציון"
// ─────────────────────────────────────────────
const RISHON_URL =
  'https://www.rishonlezion.muni.il/Residents/SecurityEmergency/pages/publicshelter.aspx';

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
    // Only keep actual shelter rows (מקלט N or מרחב מוגן) — skip news/event rows
    if (!title || (!title.includes('מקלט') && !title.includes('מרחב מוגן'))) continue;
    if (!address || address.length < 3) continue;
    rows.push({ title, address, neighborhood: neighborhood || '', description: description || '' });
  }
  return rows;
}

// Load Rishon LeZion shelters: fetch HTML → parse → geocode via Nominatim (NOM_LOW) → cache.
// Uses Nominatim instead of Photon: Photon (photon.komoot.io) times out (ETIMEDOUT) on this
// machine for any number of concurrent connections. Nominatim is reliable.
// NOM_LOW priority means user searches (NOM_HIGH) always jump to the front of the queue.
// Run fire-and-forget at startup (~44s total at 1.2s/address); server stays responsive.
async function loadRishonLeZion() {
  if (_rishonCache && Date.now() - _rishonCacheTs < GOV_CACHE_TTL) return _rishonCache;

  const res = await fetch(RISHON_URL, { headers: { 'User-Agent': 'ShelterFinderApp/1.0' }, timeout: 15000 });
  if (!res.ok) throw new Error(`Rishon HTML HTTP ${res.status}`);
  const html = await res.text();
  const rows = parseRishonTable(html);
  console.log(`[rishon] Parsed ${rows.length} shelter rows from HTML, geocoding via Nominatim…`);

  const shelters = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // NOM_LOW: user searches (NOM_HIGH=10) always jump ahead in the rate-limiter queue
      const r = await nominatimFetch(row.address, { priority: NOM_LOW });
      if (!r.ok) { console.warn(`[rishon] Nominatim HTTP ${r.status} for "${row.address}"`); continue; }
      const arr = await r.json();
      if (!arr || !arr[0]) { console.warn(`[rishon] No result for "${row.address}"`); continue; }
      const fLat = parseFloat(arr[0].lat);
      const fLon = parseFloat(arr[0].lon);
      if (!fLat || !fLon || isNaN(fLat) || isNaN(fLon)) continue;

      // Parse area/capacity from description: "שטח 68 מ²... כמות אנשים - 136"
      const areaMatch = row.description.match(/שטח\s+(\d+)/);
      const capMatch  = row.description.match(/כמות אנשים\s*[-–]\s*(\d+)/);
      const area      = areaMatch ? areaMatch[1] : '';
      const capacity  = capMatch  ? capMatch[1]  : '';

      shelters.push({
        id:       `rishon_${i}`,
        lat:      fLat,
        lon:      fLon,
        name:     row.title,
        address:  row.address.replace(/\s*ראשון לציון\s*$/i, '').trim(),
        city:     'ראשון לציון',
        capacity: capacity ? `${capacity} אנשים` : (area ? `${area} מ"ר` : ''),
        type:     'מקלט ציבורי',
        source:   'gov',
        category: 'public',
      });
    } catch (e) {
      console.warn(`[rishon] geocode error for "${row.address}": ${e.message}`);
    }
    // No explicit delay needed — Nominatim rate limiter enforces 1.2s between all requests
  }

  // Sort by shelter number for consistent ordering
  shelters.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  _rishonCache   = shelters;
  _rishonCacheTs = Date.now();
  console.log(`[rishon] Geocoded ${shelters.length}/${rows.length} shelters via Nominatim`);
  return shelters;
}

async function fetchRishonLeZion(lat, lon, radiusM) {
  if (!_rishonCache) return []; // not loaded yet — startup geocoding in progress
  return _rishonCache.filter(s => haversine(lat, lon, s.lat, s.lon) * 1000 <= radiusM);
}

// ─────────────────────────────────────────────
// Herzliya Municipality GIS (ArcGIS FeatureServer)
// "מקלטים_2025" — 125 features, WGS84 (inSR=4326 works)
// Types: Public shelter, School shelter, Protective room, Accessible shelter
// ─────────────────────────────────────────────
const HERZLIYA_URL =
  'https://services3.arcgis.com/9qGhZGtb39XMVQyR/arcgis/rest/services/' +
  '%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D_2025/FeatureServer/0/query';

// ─────────────────────────────────────────────
// Ashkelon Municipality GIS (ArcGIS FeatureServer)
// "PUBLIC_SHELTER" — 175 features, WGS84 via outSR=4326
// Fields: כתובת (address), שכונה, NAME_HEB, גודל_ (m²), מצב, פתוח
// ─────────────────────────────────────────────
const ASHKELON_URL =
  'https://services2.arcgis.com/5gNmRQS5QY72VLq4/ArcGIS/rest/services/' +
  'PUBLIC_SHELTER/FeatureServer/0/query';

// ─────────────────────────────────────────────
// Holon Municipality GIS (ArcGIS FeatureServer)
// "מקלטים" — 67 features, native WGS84 (WKID 4326)
// Fields: OBJECTID, Miklat_Num, ADDRESS, PLACE, USAGE_, area, x, y
// ─────────────────────────────────────────────
const HOLON_URL =
  'https://services2.arcgis.com/cjDo9oPmimdHxumn/arcgis/rest/services/' +
  '%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D/FeatureServer/0/query';

// ─────────────────────────────────────────────
// Kfar Saba Municipality GIS (ArcGIS FeatureServer)
// "HlsFacilities" (מקלטים_ציבוריים) — 63 features, WGS84
// Fields: NAME, PLACE, KIND, AREA1 (m²), PEOPLE (capacity), STR_NAME, SUG, NAME_1
// ─────────────────────────────────────────────
const KFAR_SABA_URL =
  'https://services2.arcgis.com/CrAWtmFzBf9b3nM0/arcgis/rest/services/' +
  'HlsFacilities/FeatureServer/0/query';

// ─────────────────────────────────────────────
// Rehovot Municipality GIS (ArcGIS FeatureServer view)
// "מקלטים עם כלביא view" — 145 open shelters, Web Mercator → outSR=4326
// Fields: MIKLAT_ID, NAME, STREET, HOUSE_N, area, sug
// ─────────────────────────────────────────────
const REHOVOT_URL =
  'https://services6.arcgis.com/U71MeVnZSuYULYvK/arcgis/rest/services/' +
  '%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D_%D7%A2%D7%9D_%D7%9B%D7%9C%D7%91%D7%99%D7%90_view/FeatureServer/0/query';

// ─────────────────────────────────────────────
// National ArcGIS shelter FeatureServer (Israel nationwide)
// Discovered via: arcgis.com/apps/instant/nearby/?appid=95254f2f07d74a1eab51254851cb2fb0
// ─────────────────────────────────────────────
const ARCGIS_SHELTER_URL =
  'https://services-eu1.arcgis.com/1SaThKhnIOL6Cfhz/arcgis/rest/services/miklatim/FeatureServer/0';

// ─────────────────────────────────────────────
// In-memory caches
// ─────────────────────────────────────────────
const govCache     = {};
const geojsonCache = {};
const municipalityListCache = {};
const geocodeCache = {};
const GOV_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MUNI_LIST_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const GEOCODE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Tel Aviv: load all shelters once and cache (bbox inSR=4326 is ignored by WKID-2039 MapServer)
let _telAvivCache   = null;
let _telAvivCacheTs = 0;
const TEL_AVIV_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Rishon LeZion: HTML table page, geocoded with Nominatim at startup
let _rishonCache   = null;
let _rishonCacheTs = 0;

// Yehud: ArcGIS embedded feature collection (not a live FeatureServer)
let _yehudCache   = null;
let _yehudCacheTs = 0;

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
function nominatimFetch(q, { limit = 1, addressdetails = 0, priority = NOM_LOW, dropType } = {}) {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    format: 'json',
    q: q.includes('ישראל') ? q : q + ', ישראל',
    limit,
    addressdetails,
  })}`;

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
      resolve(await fetch(url, { headers: _NOM_HDR, timeout: 15000 }));
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
async function photonFetch(q, limit = 5) {
  const query = q.includes('ישראל') ? q : q + ' ישראל';
  const params = new URLSearchParams({
    q: query, limit: String(limit),
    lat: '31.5', lon: '34.8',  // location bias: centre of Israel
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
// Helpers
// ─────────────────────────────────────────────
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

// Deduplicate shelters within a single list (prefer gov/arcgis over OSM)
function deduplicate(shelters, thresholdKm = 0.03) {
  const out = [];
  for (const s of shelters) {
    const dup = out.find(x => haversine(x.lat, x.lon, s.lat, s.lon) < thresholdKm);
    if (!dup) {
      out.push(s);
    } else if (s.source === 'gov' || s.source === 'arcgis') {
      Object.assign(dup, { ...s, id: dup.id });
    }
  }
  return out;
}

// Deduplicate per category independently (schools ≠ shelters ≠ parking)
function deduplicateAll(shelters, thresholdKm = 0.03) {
  const byCategory = {};
  for (const s of shelters) {
    const cat = s.category || 'public';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(s);
  }
  const result = [];
  for (const list of Object.values(byCategory)) {
    result.push(...deduplicate(list, thresholdKm));
  }
  return result;
}

// ─────────────────────────────────────────────
// Fetch from OpenStreetMap Overpass API
// Single query covers: public shelters + schools + covered/multi-storey parking
// ─────────────────────────────────────────────
async function fetchOverpass(lat, lon, radiusM) {
  const query = `
[out:json][timeout:30];
(
  node["amenity"="shelter"]["shelter_type"!="public_transport"]["shelter_type"!="weather"](around:${radiusM},${lat},${lon});
  way["amenity"="shelter"]["shelter_type"!="public_transport"]["shelter_type"!="weather"](around:${radiusM},${lat},${lon});
  node["building"="shelter"](around:${radiusM},${lat},${lon});
  way["building"="shelter"](around:${radiusM},${lat},${lon});
  node["emergency"="shelter"](around:${radiusM},${lat},${lon});
  way["emergency"="shelter"](around:${radiusM},${lat},${lon});
  node["shelter_type"="public_shelter"](around:${radiusM},${lat},${lon});
  node["shelter_type"="bomb_shelter"](around:${radiusM},${lat},${lon});
  node["amenity"="public_shelter"](around:${radiusM},${lat},${lon});
  node["miklat"="yes"](around:${radiusM},${lat},${lon});
  node["shelter"="yes"](around:${radiusM},${lat},${lon});
  node["amenity"="school"](around:${radiusM},${lat},${lon});
  way["amenity"="school"](around:${radiusM},${lat},${lon});
  node["amenity"="kindergarten"](around:${radiusM},${lat},${lon});
  way["amenity"="kindergarten"](around:${radiusM},${lat},${lon});
  node["amenity"="parking"]["parking"="multi-storey"](around:${radiusM},${lat},${lon});
  way["amenity"="parking"]["parking"="multi-storey"](around:${radiusM},${lat},${lon});
  node["amenity"="parking"]["covered"="yes"](around:${radiusM},${lat},${lon});
  way["amenity"="parking"]["covered"="yes"](around:${radiusM},${lat},${lon});
);
out center meta;`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
    timeout: 25000,
  });

  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = await res.json();

  return json.elements
    .map(el => {
      const sLat = el.type === 'way' ? el.center?.lat : el.lat;
      const sLon = el.type === 'way' ? el.center?.lon : el.lon;
      if (!sLat || !sLon) return null;

      const t = el.tags || {};
      let category, name, type;

      if (t.amenity === 'school' || t.amenity === 'kindergarten') {
        category = 'school';
        name = t.name || t['name:he'] || t['name:en'] ||
               (t.amenity === 'kindergarten' ? 'גן ילדים' : 'בית ספר');
        type = t.amenity === 'kindergarten' ? 'גן ילדים' : 'בית ספר';
      } else if (t.amenity === 'parking') {
        category = 'parking';
        name = t.name || t['name:he'] || t['name:en'] ||
               (t.parking === 'multi-storey' ? 'חניון קומות' : 'חניון מקורה');
        type = t.parking === 'multi-storey' ? 'חניון קומות' : 'חניון מקורה';
      } else {
        category = 'public';
        name = t.name || t['name:he'] || t['name:en'] || osmDefaultName(t);
        type = t['shelter_type'] || t['emergency'] || 'מקלט';
      }

      return {
        id: `osm_${el.id}`,
        lat: sLat,
        lon: sLon,
        name,
        address: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '),
        city: t['addr:city'] || t['addr:suburb'] || t['addr:quarter'] || '',
        capacity: t.capacity || t['max_capacity'] || '',
        type,
        source: 'osm',
        category,
      };
    })
    .filter(Boolean);
}

function osmDefaultName(t) {
  if (t['shelter_type'] === 'bomb_shelter')   return 'מקלט פצצות';
  if (t['shelter_type'] === 'public_shelter') return 'מקלט ציבורי';
  if (t['building']      === 'shelter')       return 'מקלט';
  if (t['emergency']     === 'shelter')       return 'מקלט חירום';
  return 'מקלט ציבורי';
}

// ─────────────────────────────────────────────
// Fetch from Tel Aviv Municipality GIS (MapServer layer 592: מקלטים)
// https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/592
// Fields: Full_Address, t_sug (type), lat, lon, shetach_mr (m²), pail (readiness), opening_times
// ─────────────────────────────────────────────
const TEL_AVIV_SHELTER_URL =
  'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/592/query';

// Load ALL Tel Aviv shelters once and cache them.
// Fix for WKID-2039 MapServer that ignores inSR=4326 bbox — returns 0 features with bbox query.
// Solution: fetch everything with where=1=1, cache for 1 hour, filter by haversine per request.
async function loadTelAviv() {
  if (_telAvivCache && Date.now() - _telAvivCacheTs < TEL_AVIV_CACHE_TTL) return _telAvivCache;

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
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`Tel Aviv GIS HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Tel Aviv GIS: ${json.error.message}`);

  _telAvivCache = (json.features || [])
    .map((feat, i) => {
      const a = feat.attributes || {};
      // Prefer attribute lat/lon (WGS84) over geometry (may be ITM-projected)
      let fLat = a.lat;
      let fLon = a.lon;
      if ((!fLat || !fLon) && feat.geometry) {
        fLon = feat.geometry.x;
        fLat = feat.geometry.y;
      }
      if (!fLat || !fLon) return null;

      const addr      = a.Full_Address || a.shem || '';
      const type      = a.t_sug || 'מקלט ציבורי';
      const isParking = type.includes('חניון');
      const sizeSqm   = a.shetach_mr;
      const readiness = a.pail || '';
      const hours     = a.opening_times || '';

      return {
        id:       `tlv_${a.UniqueId || a.oid_mitkan || i}`,
        lat:      fLat,
        lon:      fLon,
        name:     addr || `מקלט ת"א #${i + 1}`,
        address:  addr,
        city:     'תל אביב-יפו',
        capacity: sizeSqm ? `${sizeSqm} מ"ר` : '',
        type,
        hours:    hours || readiness || '',
        source:   'gov',
        category: isParking ? 'parking' : 'public',
      };
    })
    .filter(Boolean);

  _telAvivCacheTs = Date.now();
  console.log(`[tel-aviv] Cached ${_telAvivCache.length} shelters`);
  return _telAvivCache;
}

async function fetchTelAviv(lat, lon, radiusM) {
  const all = await loadTelAviv();
  return all.filter(s => haversine(lat, lon, s.lat, s.lon) * 1000 <= radiusM);
}

// ─────────────────────────────────────────────
// Fetch from Haifa Municipality GIS (MapServer layer 1: מקומות מיגון)
// https://gisserver.haifa.muni.il/arcgiswebadaptor/rest/services/PublicSite/Haifa_Sec_Public/MapServer/1
// Fields: Migun_FullAddress, Migun_Name, Migun_Type, QtyPeople, Migun_Area, Neighborhood
// Migun_Type values: מקלט ציבורי, מקלט בית ספרי, בית ספר - מתקן קליטה, חניון תת-קרקעי, מיגונית
// ─────────────────────────────────────────────
const HAIFA_SHELTER_URL =
  'https://gisserver.haifa.muni.il/arcgiswebadaptor/rest/services/PublicSite/Haifa_Sec_Public/MapServer/1/query';

async function fetchHaifa(lat, lon, radiusM) {
  const latDelta = (radiusM / 1000) / 111;
  const lonDelta = (radiusM / 1000) / (111 * Math.cos(lat * Math.PI / 180));
  const bbox = `${lon - lonDelta},${lat - latDelta},${lon + lonDelta},${lat + latDelta}`;

  const params = new URLSearchParams({
    geometry:      bbox,
    geometryType:  'esriGeometryEnvelope',
    spatialRel:    'esriSpatialRelIntersects',
    inSR:          '4326',
    outSR:         '4326',
    outFields:     'Migun_FullAddress,Migun_Name,Migun_Type,QtyPeople,Migun_Area,Neighborhood,OBJECTID',
    returnGeometry:'true',
    f:             'json',
  });

  const res = await fetch(`${HAIFA_SHELTER_URL}?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`Haifa GIS HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Haifa GIS: ${json.error.message}`);

  return (json.features || [])
    .map((feat, i) => {
      const a   = feat.attributes || {};
      const g   = feat.geometry   || {};
      const fLon = g.x;
      const fLat = g.y;
      if (!fLat || !fLon) return null;
      if (haversine(lat, lon, fLat, fLon) * 1000 > radiusM) return null;

      const migunType = a.Migun_Type || '';
      const isParking = migunType.includes('חניון');
      const isSchool  = migunType.includes('ספר'); // מקלט בית ספרי / בית ספר - מתקן קליטה

      const addr    = a.Migun_FullAddress || '';
      const rawName = a.Migun_Name || '';
      // Migun_Name is sometimes just a number (shelter ID) — not useful as a display name
      const isNumericOnly = /^\d+$/.test(rawName.trim());
      let name;
      if (rawName && !isNumericOnly) name = rawName;     // real name (e.g. school name)
      else if (addr)                 name = `מקלט חיפה – ${addr}`;
      else                           name = `מקלט חיפה #${i + 1}`;

      return {
        id:       `haifa_${a.OBJECTID || i}`,
        lat:      fLat,
        lon:      fLon,
        name,
        address:  addr,
        city:     'חיפה',
        capacity: a.QtyPeople
          ? `${a.QtyPeople} אנשים`
          : (a.Migun_Area ? `${a.Migun_Area} מ"ר` : ''),
        type:     migunType || 'מקלט ציבורי',
        source:   'gov',
        category: isParking ? 'parking' : (isSchool ? 'school' : 'public'),
      };
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────
// Fetch from Petah Tikva Municipality GIS (ArcGIS FeatureServer)
// "מרחבים מוגנים ציבוריים" — 132 shelters/protected spaces with real coordinates.
// complex: 1=ציבורי (public shelter), 4=מוסד (institution/school)
// SUG: 2=תת קרקעי (underground), 1=other, null=general
// ─────────────────────────────────────────────
async function fetchPetahTikva(lat, lon, radiusM) {
  const latDelta = (radiusM / 1000) / 111;
  const lonDelta = (radiusM / 1000) / (111 * Math.cos(lat * Math.PI / 180));
  const bbox = `${lon - lonDelta},${lat - latDelta},${lon + lonDelta},${lat + latDelta}`;

  const params = new URLSearchParams({
    geometry:       bbox,
    geometryType:   'esriGeometryEnvelope',
    spatialRel:     'esriSpatialRelIntersects',
    inSR:           '4326',
    outSR:          '4326',
    outFields:      'Address,PlaceName,MERHAV,SUG,complex,Neigborhood,Activated,Accessable,OBJECTID',
    returnGeometry: 'true',
    f:              'json',
  });

  const res = await fetch(`${PETAH_TIKVA_URL}?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`Petah Tikva GIS HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Petah Tikva GIS: ${json.error.message}`);

  return (json.features || [])
    .map((feat, i) => {
      const a    = feat.attributes || {};
      const g    = feat.geometry   || {};
      const fLon = g.x;
      const fLat = g.y;
      if (!fLat || !fLon) return null;
      if (haversine(lat, lon, fLat, fLon) * 1000 > radiusM) return null;

      const addr      = a.Address   || '';
      const placeName = a.PlaceName || '';
      const isSchool  = a.complex === 4;  // מוסד (institution / school)
      const typeLabel = a.SUG === 2 ? 'מקלט תת-קרקעי'
                      : isSchool    ? 'מרחב מוגן – מוסד'
                      :              'מרחב מוגן ציבורי';

      const name = placeName
        ? `${placeName}${addr ? ' – ' + addr : ''}`
        : addr
          ? `מרחב מוגן – ${addr}`
          : `מרחב מוגן פ"ת #${i + 1}`;

      return {
        id:       `ptikva_${a.OBJECTID || i}`,
        lat:      fLat,
        lon:      fLon,
        name,
        address:  addr,
        city:     'פתח תקווה',
        capacity: '',
        type:     typeLabel,
        source:   'gov',
        category: isSchool ? 'school' : 'public',
      };
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────
// Fetch from Herzliya Municipality GIS (ArcGIS FeatureServer)
// "מקלטים_2025" — 125 features, WGS84 (inSR=4326 bbox works)
// Types (English): Public shelter, School shelter, Protective room, Accessible shelter
// Fields: OBJECTID, כתובת, type, number_mik, negishot
// ─────────────────────────────────────────────
async function fetchHerzliya(lat, lon, radiusM) {
  const latDelta = (radiusM / 1000) / 111;
  const lonDelta = (radiusM / 1000) / (111 * Math.cos(lat * Math.PI / 180));
  const bbox = `${lon - lonDelta},${lat - latDelta},${lon + lonDelta},${lat + latDelta}`;

  const params = new URLSearchParams({
    geometry:       bbox,
    geometryType:   'esriGeometryEnvelope',
    spatialRel:     'esriSpatialRelIntersects',
    inSR:           '4326',
    outSR:          '4326',
    outFields:      'OBJECTID,כתובת,type,number_mik,negishot',
    returnGeometry: 'true',
    f:              'json',
  });

  const res = await fetch(`${HERZLIYA_URL}?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`Herzliya GIS HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Herzliya GIS: ${json.error.message}`);

  return (json.features || [])
    .map((feat, i) => {
      const a    = feat.attributes || {};
      const g    = feat.geometry   || {};
      const fLon = g.x;
      const fLat = g.y;
      if (!fLat || !fLon) return null;
      if (haversine(lat, lon, fLat, fLon) * 1000 > radiusM) return null;

      const addr        = a['כתובת'] || '';
      const shelterType = a.type || '';
      const isSchool    = shelterType.toLowerCase().includes('school');

      let typeHe = 'מקלט ציבורי';
      if      (shelterType === 'School shelter')     typeHe = 'מקלט בית ספרי';
      else if (shelterType === 'Protective room')    typeHe = 'מרחב מוגן';
      else if (shelterType === 'Accessible shelter') typeHe = 'מקלט נגיש';

      return {
        id:       `herzliya_${a.OBJECTID || i}`,
        lat:      fLat,
        lon:      fLon,
        name:     addr ? `מקלט – ${addr}` : `מקלט הרצליה #${i + 1}`,
        address:  addr,
        city:     'הרצליה',
        capacity: '',
        type:     typeHe,
        source:   'gov',
        category: isSchool ? 'school' : 'public',
      };
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────
// Fetch from Ashkelon Municipality GIS (ArcGIS FeatureServer)
// "PUBLIC_SHELTER" — 175 features, WGS84 via outSR=4326
// Fields: כתובת (address), שכונה, NAME_HEB, גודל_ (m²), מצב (פתוח/סגור), פתוח (1/0)
// ─────────────────────────────────────────────
async function fetchAshkelon(lat, lon, radiusM) {
  const latDelta = (radiusM / 1000) / 111;
  const lonDelta = (radiusM / 1000) / (111 * Math.cos(lat * Math.PI / 180));
  const bbox = `${lon - lonDelta},${lat - latDelta},${lon + lonDelta},${lat + latDelta}`;

  const params = new URLSearchParams({
    geometry:       bbox,
    geometryType:   'esriGeometryEnvelope',
    spatialRel:     'esriSpatialRelIntersects',
    inSR:           '4326',
    outSR:          '4326',
    outFields:      '*',   // Hebrew field names in outFields → 400 outside Ashkelon bbox
    returnGeometry: 'true',
    f:              'json',
  });

  const res = await fetch(`${ASHKELON_URL}?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`Ashkelon GIS HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Ashkelon GIS: ${json.error.message}`);

  return (json.features || [])
    .map((feat, i) => {
      const a    = feat.attributes || {};
      const g    = feat.geometry   || {};
      const fLon = g.x;
      const fLat = g.y;
      if (!fLat || !fLon) return null;
      if (haversine(lat, lon, fLat, fLon) * 1000 > radiusM) return null;

      const addr     = a['כתובת'] || '';
      const nameHeb  = a.NAME_HEB || '';
      const hood     = a['שכונה'] || '';
      const sizeSqm  = a['גודל_'];
      const name     = nameHeb || (addr ? `מקלט – ${addr}` : `מקלט אשקלון #${i + 1}`);

      return {
        id:       `ashkelon_${a.OBJECTID || i}`,
        lat:      fLat,
        lon:      fLon,
        name,
        address:  addr,
        city:     'אשקלון',
        capacity: sizeSqm ? `${sizeSqm} מ"ר` : '',
        type:     'מקלט ציבורי',
        source:   'gov',
        category: 'public',
      };
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────
// Fetch from Holon Municipality GIS (ArcGIS FeatureServer)
// "מקלטים" — 67 features, native WGS84 (WKID 4326)
// Fields: OBJECTID, Miklat_Num, ADDRESS, PLACE, USAGE_, area, x (lon), y (lat)
// ─────────────────────────────────────────────
async function fetchHolon(lat, lon, radiusM) {
  const latDelta = (radiusM / 1000) / 111;
  const lonDelta = (radiusM / 1000) / (111 * Math.cos(lat * Math.PI / 180));
  const bbox = `${lon - lonDelta},${lat - latDelta},${lon + lonDelta},${lat + latDelta}`;

  const params = new URLSearchParams({
    geometry:       bbox,
    geometryType:   'esriGeometryEnvelope',
    spatialRel:     'esriSpatialRelIntersects',
    inSR:           '4326',
    outSR:          '4326',
    outFields:      'OBJECTID,Miklat_Num,ADDRESS,PLACE,USAGE_,area',
    returnGeometry: 'true',
    f:              'json',
  });

  const res = await fetch(`${HOLON_URL}?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`Holon GIS HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Holon GIS: ${json.error.message}`);

  return (json.features || [])
    .map((feat, i) => {
      const a    = feat.attributes || {};
      const g    = feat.geometry   || {};
      const fLon = g.x;
      const fLat = g.y;
      if (!fLat || !fLon) return null;
      if (haversine(lat, lon, fLat, fLon) * 1000 > radiusM) return null;

      const addr  = a.ADDRESS || '';
      const place = a.PLACE   || '';
      const usage = a.USAGE_  || '';
      const name  = place || (addr ? `מקלט – ${addr}` : `מקלט חולון #${i + 1}`);

      return {
        id:       `holon_${a.OBJECTID || i}`,
        lat:      fLat,
        lon:      fLon,
        name,
        address:  addr,
        city:     'חולון',
        capacity: a.area ? `${a.area} מ"ר` : '',
        type:     usage || 'מקלט ציבורי',
        source:   'gov',
        category: 'public',
      };
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────
// Fetch from Kfar Saba Municipality GIS (ArcGIS FeatureServer)
// "HlsFacilities" (מקלטים_ציבוריים) — 63 features, WGS84
// Fields: NAME (shelter #), PLACE, KIND, AREA1 (m²), PEOPLE (capacity), STR_NAME, SUG, NAME_1
// SUG: תחתי = underground shelter
// ─────────────────────────────────────────────
async function fetchKfarSaba(lat, lon, radiusM) {
  const latDelta = (radiusM / 1000) / 111;
  const lonDelta = (radiusM / 1000) / (111 * Math.cos(lat * Math.PI / 180));
  const bbox = `${lon - lonDelta},${lat - latDelta},${lon + lonDelta},${lat + latDelta}`;

  const params = new URLSearchParams({
    geometry:       bbox,
    geometryType:   'esriGeometryEnvelope',
    spatialRel:     'esriSpatialRelIntersects',
    inSR:           '4326',
    outSR:          '4326',
    outFields:      'OBJECTID,NAME,PLACE,KIND,AREA1,PEOPLE,STR_NAME,SUG,NAME_1',
    returnGeometry: 'true',
    f:              'json',
  });

  const res = await fetch(`${KFAR_SABA_URL}?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`Kfar Saba GIS HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Kfar Saba GIS: ${json.error.message}`);

  return (json.features || [])
    .map((feat, i) => {
      const a    = feat.attributes || {};
      const g    = feat.geometry   || {};
      const fLon = g.x;
      const fLat = g.y;
      if (!fLat || !fLon) return null;
      if (haversine(lat, lon, fLat, fLon) * 1000 > radiusM) return null;

      const street = a.STR_NAME || '';
      const place  = a.NAME_1   || a.PLACE || '';
      const sug    = a.SUG      || '';
      const kind   = a.KIND     || '';
      const isSchool = kind.includes('בית ספר') || kind.includes('ספר') || place.includes('בית ספר');
      const typeLabel = sug.includes('תחתי') ? 'מקלט תת-קרקעי' : 'מקלט ציבורי';
      const name = place || (street ? `מקלט – ${street}` : `מקלט כפר סבא #${i + 1}`);

      return {
        id:       `kfarsaba_${a.OBJECTID || i}`,
        lat:      fLat,
        lon:      fLon,
        name,
        address:  street,
        city:     'כפר סבא',
        capacity: a.PEOPLE ? `${a.PEOPLE} אנשים` : (a.AREA1 ? `${a.AREA1} מ"ר` : ''),
        type:     typeLabel,
        source:   'gov',
        category: isSchool ? 'school' : 'public',
      };
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────
// Fetch from Rehovot Municipality GIS (ArcGIS FeatureServer view)
// "מקלטים עם כלביא view" (מקלטים פתוחים) — 145 open shelters
// Spatial ref: Web Mercator (102100) → outSR=4326 for WGS84 output
// Fields: MIKLAT_ID, NAME, STREET, HOUSE_N, area, sug
// ─────────────────────────────────────────────
async function fetchRehovot(lat, lon, radiusM) {
  const latDelta = (radiusM / 1000) / 111;
  const lonDelta = (radiusM / 1000) / (111 * Math.cos(lat * Math.PI / 180));
  const bbox = `${lon - lonDelta},${lat - latDelta},${lon + lonDelta},${lat + latDelta}`;

  const params = new URLSearchParams({
    geometry:       bbox,
    geometryType:   'esriGeometryEnvelope',
    spatialRel:     'esriSpatialRelIntersects',
    inSR:           '4326',
    outSR:          '4326',
    outFields:      'OBJECTID,MIKLAT_ID,NAME,STREET,HOUSE_N,area,sug',
    returnGeometry: 'true',
    f:              'json',
  });

  const res = await fetch(`${REHOVOT_URL}?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`Rehovot GIS HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Rehovot GIS: ${json.error.message}`);

  return (json.features || [])
    .map((feat, i) => {
      const a    = feat.attributes || {};
      const g    = feat.geometry   || {};
      const fLon = g.x;
      const fLat = g.y;
      if (!fLat || !fLon) return null;
      if (haversine(lat, lon, fLat, fLon) * 1000 > radiusM) return null;

      const street = a.STREET  || '';
      const houseN = a.HOUSE_N != null ? String(a.HOUSE_N) : '';
      const addr   = [street, houseN].filter(Boolean).join(' ');
      const sug    = a.sug     || '';
      const isSchool = sug.includes('בית ספר') || sug.includes('ספר');
      const name   = a.NAME || (addr ? `מקלט – ${addr}` : `מקלט רחובות #${i + 1}`);

      return {
        id:       `rehovot_${a.OBJECTID || a.MIKLAT_ID || i}`,
        lat:      fLat,
        lon:      fLon,
        name,
        address:  addr,
        city:     'רחובות',
        capacity: a.area ? `${a.area} מ"ר` : '',
        type:     isSchool ? 'מקלט בית ספרי' : 'מקלט ציבורי',
        source:   'gov',
        category: isSchool ? 'school' : 'public',
      };
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────
// Fetch from national ArcGIS shelter FeatureServer
// ─────────────────────────────────────────────
async function fetchArcGIS(lat, lon, radiusM) {
  const latDelta = (radiusM / 1000) / 111;
  const lonDelta = (radiusM / 1000) / (111 * Math.cos(lat * Math.PI / 180));
  const bbox = `${lon - lonDelta},${lat - latDelta},${lon + lonDelta},${lat + latDelta}`;

  const params = new URLSearchParams({
    geometry: bbox,
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '4326',
    outSR: '4326',
    outFields: 'כתובת,שימוש,גודל_מר',
    returnGeometry: 'true',
    f: 'geojson',
  });

  const res = await fetch(`${ARCGIS_SHELTER_URL}/query?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`ArcGIS HTTP ${res.status}`);
  const json = await res.json();

  return (json.features || [])
    .map((feat, i) => {
      const [fLon, fLat] = feat.geometry?.coordinates || [];
      if (!fLat || !fLon) return null;
      if (haversine(lat, lon, fLat, fLon) * 1000 > radiusM) return null;

      const props  = feat.properties || {};
      const addr   = props['כתובת'] || '';
      const sizeSqm = props['גודל_מר'];
      return {
        id: `arcgis_${feat.id ?? i}`,
        lat: fLat,
        lon: fLon,
        name: addr ? `מקלט – ${addr}` : 'מקלט ציבורי',
        address: addr,
        city: '',
        capacity: sizeSqm ? `${sizeSqm} מ"ר` : '',
        type: 'מקלט ציבורי',
        source: 'arcgis',
        category: 'public',
      };
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────
// Geocode a single address (Nominatim), with cache.
// Uses the global rate limiter — safe to call from any context.
// ─────────────────────────────────────────────
async function geocodeAddress(addressStr) {
  const key = addressStr.trim();
  if (!key) return null;
  const cached = geocodeCache[key];
  if (cached && Date.now() - cached.ts < GEOCODE_CACHE_TTL) return cached;

  try {
    const r = await nominatimFetch(key);
    if (!r.ok) return null;
    const arr = await r.json();
    if (!arr || !arr[0]) return null;
    const entry = { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon), ts: Date.now() };
    geocodeCache[key] = entry;
    return entry;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Municipality HTML list sources (geocoded at startup via Nominatim)
// Add entries here for cities whose shelter data is only available as HTML tables.
// Each entry: { id, city, url, centerLat, centerLon, maxRadiusKm, listUrlLabel }
// ─────────────────────────────────────────────
const MUNICIPALITY_LIST_SOURCES = [];

// ─────────────────────────────────────────────
// Parse municipality HTML table (Petah Tikva style: שכונה | רחוב | מבנה | סוג מקלט | שם מקום | מס' מקלט | רובע | פתוח/סגור)
// ─────────────────────────────────────────────
function parseMunicipalityTable(html, cityName) {
  const rows = [];
  const strip = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  let skipHeader = true;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const cells = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(strip(tdMatch[1]));
    }
    if (cells.length >= 6) {
      if (skipHeader) {
        const first = (cells[0] + cells[1]).replace(/\s/g, '');
        if (first.includes('שכונה') || first.includes('רחוב') || first.includes('מבנה')) {
          skipHeader = false;
          continue;
        }
      }
      const [neighborhood, street, buildingType, shelterType, placeName, shelterNum, district, openClosed] = cells;
      if (!street && !placeName) continue;
      const addressPart = street || placeName || neighborhood || '';
      if (!addressPart) continue;
      const fullAddress = `${addressPart}, ${cityName}`;
      rows.push({
        neighborhood: neighborhood || '',
        street: street || '',
        buildingType: buildingType || '',
        shelterType: shelterType || '',
        placeName: placeName || '',
        shelterNum: shelterNum || '',
        district: district || '',
        openClosed: openClosed || '',
        fullAddress,
        displayName: placeName ? (buildingType ? `${placeName} (${buildingType})` : placeName) : (street ? `מקלט – ${street}` : `מקלט ${cityName}`),
      });
    }
  }
  return rows;
}

// ─────────────────────────────────────────────
// Fetch municipality list page, parse table, return shelters using CACHED geocode only.
// No on-demand Nominatim calls here — geocoding is done by preGeocodeAllMunicipalities()
// at startup so it never blocks or rate-limits user requests.
// ─────────────────────────────────────────────
async function fetchMunicipalityListSource(source, userLat, userLon, radiusM) {
  if (haversine(userLat, userLon, source.centerLat, source.centerLon) > source.maxRadiusKm) {
    return [];
  }

  const rows = municipalityListCache[source.id] || [];
  const shelters = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cached = geocodeCache[row.fullAddress];
    if (!cached) continue; // not yet geocoded — skip (background task will fill this in)
    const coord = { lat: cached.lat, lon: cached.lon };
    if (haversine(userLat, userLon, coord.lat, coord.lon) * 1000 > radiusM) continue;

    shelters.push({
      id: `muni_${source.id}_${i}_${(row.shelterNum || row.street || i).toString().replace(/\s/g, '_')}`,
      lat: coord.lat,
      lon: coord.lon,
      name: row.displayName,
      address: row.street ? `${row.street}${row.neighborhood ? ', ' + row.neighborhood : ''}` : row.placeName,
      city: source.city,
      capacity: '',
      type: row.shelterType || 'מקלט ציבורי',
      source: 'gov',
      category: row.buildingType && (row.buildingType.includes('בית ספר') || row.buildingType.includes('גן')) ? 'school' : 'public',
      openClosed: row.openClosed,
    });
  }
  return shelters;
}

// ─────────────────────────────────────────────
// Background startup: fetch municipality HTML + geocode all addresses (rate-limited).
// Runs once after server starts; fills geocodeCache so fetchMunicipalityListSource
// can serve results without touching Nominatim at request time.
// ─────────────────────────────────────────────
async function preGeocodeAllMunicipalities() {
  for (const source of MUNICIPALITY_LIST_SOURCES) {
    try {
      // 1. Fetch & parse the HTML table (if not already cached)
      if (!municipalityListCache[source.id]) {
        const res = await fetch(source.url, {
          headers: { 'User-Agent': 'ShelterFinderApp/1.0', 'Accept': 'text/html' },
          timeout: 15000,
        });
        if (!res.ok) {
          console.warn(`[municipality] ${source.city}: HTTP ${res.status} — skipping`);
          continue;
        }
        const html = await res.text();
        const rows = parseMunicipalityTable(html, source.city);
        municipalityListCache[source.id] = rows;
        municipalityListCache[source.id + '_ts'] = Date.now();
        console.log(`[municipality] Parsed ${rows.length} rows from ${source.city}`);
      }

      // 2. Geocode each address via the rate limiter (1.2s between calls)
      const rows = municipalityListCache[source.id] || [];
      let geocoded = 0;
      for (const row of rows) {
        if (geocodeCache[row.fullAddress]) continue; // already in cache
        const result = await geocodeAddress(row.fullAddress); // uses rate limiter
        if (result) geocoded++;
      }
      console.log(`[municipality] Pre-geocoded ${geocoded} new addresses for ${source.city}`);
    } catch (e) {
      console.warn(`[municipality] Pre-geocode failed for ${source.city}:`, e.message);
    }
  }
}

async function fetchMunicipalityLists(userLat, userLon, radiusM) {
  const results = [];
  for (const source of MUNICIPALITY_LIST_SOURCES) {
    if (haversine(userLat, userLon, source.centerLat, source.centerLon) > source.maxRadiusKm) continue;
    try {
      const list = await fetchMunicipalityListSource(source, userLat, userLon, radiusM);
      results.push(...list);
    } catch (e) {
      console.warn(`[municipality] ${source.city} failed:`, e.message);
    }
  }
  return results;
}

function getMunicipalityListUrlForArea(userLat, userLon) {
  const source = MUNICIPALITY_LIST_SOURCES.find(
    (s) => haversine(userLat, userLon, s.centerLat, s.centerLon) <= s.maxRadiusKm
  );
  return source ? { url: source.url, city: source.city, label: source.listUrlLabel } : null;
}

// ─────────────────────────────────────────────
// Fetch from data.gov.il (with caching)
// ─────────────────────────────────────────────
async function loadGovResource(resource) {
  const cached = govCache[resource.id];
  if (cached && Date.now() - cached.ts < GOV_CACHE_TTL) return cached.data;

  console.log(`[gov] Loading resource ${resource.id} (${resource.city})...`);
  const res = await fetch(
    `https://data.gov.il/api/3/action/datastore_search?resource_id=${resource.id}&limit=10000`,
    { timeout: 20000 }
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
        ? (rawName.startsWith('מקלט') ? rawName : `מקלט ${rawName}`)
        : `מקלט #${rec._id}`;

      return {
        id: `gov_${resource.id}_${rec._id}`,
        lat, lon, name,
        address: rec.address || rec.ADDRESS || rec['כתובת'] || rec.street || '',
        city: rec.city || rec.CITY || rec['עיר'] || resource.city,
        capacity: rec.capacity || rec.CAPACITY || rec['קיבולת'] || '',
        type: 'מקלט ציבורי',
        source: 'gov',
        category: 'public',
      };
    })
    .filter(Boolean);

  console.log(`[gov] Loaded ${shelters.length} shelters for ${resource.city}`);
  govCache[resource.id] = { data: shelters, ts: Date.now() };
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

// ─────────────────────────────────────────────
// GeoJSON sources
// ─────────────────────────────────────────────
async function loadGeoJsonResource(resource) {
  const cached = geojsonCache[resource.url];
  if (cached && Date.now() - cached.ts < GOV_CACHE_TTL) return cached.data;

  console.log(`[geojson] Loading ${resource.city}...`);
  const res = await fetch(resource.url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`GeoJSON HTTP ${res.status}`);
  const json = await res.json();

  const shelters = (json.features || [])
    .map((feat, i) => {
      const [lon, lat] = feat.geometry?.coordinates || [];
      if (!lat || !lon) return null;
      const props   = feat.properties || {};
      const rawName = props[resource.nameField];
      const name    = rawName ? `מקלט ${rawName}` : `מקלט ${resource.city} #${i + 1}`;
      return {
        id: `geojson_${resource.city}_${props.OBJECTID || i}`,
        lat, lon, name,
        address:  props['כתובת'] || props.address || props.ADDRESS || '',
        city:     resource.city,
        capacity: props['קיבולת'] || props.capacity || '',
        type:     'מקלט ציבורי',
        source:   'gov',
        category: 'public',
      };
    })
    .filter(Boolean);

  console.log(`[geojson] Loaded ${shelters.length} shelters for ${resource.city}`);
  geojsonCache[resource.url] = { data: shelters, ts: Date.now() };
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

// ─────────────────────────────────────────────
// Pre-warm caches on startup
// ─────────────────────────────────────────────
(async () => {
  // 1. Warm data.gov.il + GeoJSON caches immediately (no rate limit needed)
  for (const resource of GOV_RESOURCES) {
    try { await loadGovResource(resource); }
    catch (e) { console.warn('[gov] pre-warm failed for', resource.city, '–', e.message); }
  }
  for (const resource of GEOJSON_RESOURCES) {
    try { await loadGeoJsonResource(resource); }
    catch (e) { console.warn('[geojson] pre-warm failed for', resource.city, '–', e.message); }
  }

  // 2. Pre-warm Tel Aviv cache (fetches all 502 shelters once, cached for 1 hour)
  try { await loadTelAviv(); }
  catch (e) { console.warn('[tel-aviv] pre-warm failed –', e.message); }

  // 3. Load & geocode Rishon LeZion shelters (Nominatim NOM_LOW, ~44s — fire-and-forget)
  // Do NOT await: geocoding takes ~44s; user searches (NOM_HIGH) jump ahead in the queue.
  loadRishonLeZion().catch(e => console.warn('[rishon] startup load failed –', e.message));

  // 4. Pre-warm Yehud cache (ArcGIS embedded feature collection, fast)
  try { await loadYehud(); }
  catch (e) { console.warn('[yehud] pre-warm failed –', e.message); }

  // NOTE: Background geocoding of municipality HTML lists is disabled.
  // Geocoding 200+ addresses via Nominatim at startup reliably triggers rate-limiting (429),
  // which breaks user geocode searches. These cities need a proper GIS/ArcGIS endpoint
  // instead of Nominatim-geocoded HTML scraping.
})();

// ─────────────────────────────────────────────
// API: GET /api/geocode?q=<address>
// ─────────────────────────────────────────────
app.get('/api/geocode', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query parameter q' });

  const isSuggest = req.query.suggest === '1';

  // ── Autocomplete (suggest=1): try Photon (fast, no rate-limit), fall back to Nominatim ──
  if (isSuggest) {
    try {
      return res.json(await photonFetch(q, 5));  // 5s timeout — fails fast if unreachable
    } catch (photonErr) {
      console.warn('[geocode/suggest] Photon failed, using Nominatim:', photonErr.message);
    }
    // Photon failed — fall back to Nominatim with NOM_HIGH so user isn't blocked
    try {
      const r = await nominatimFetch(q, { limit: 5, priority: NOM_HIGH, dropType: 'autocomplete' });
      if (!r.ok) return res.status(503).json({ error: 'geocode_busy' });
      return res.json(await r.json());
    } catch (e) {
      if (e.superseded) return res.status(204).end();
      return res.status(503).json({ error: 'geocode_busy' });
    }
  }

  // ── Explicit search: Nominatim first (best Hebrew quality), Photon fallback on 429 ──
  try {
    const r = await nominatimFetch(q, { limit: 6, addressdetails: 1, priority: NOM_HIGH });
    if (r.status === 429) {
      console.warn('[geocode] Nominatim 429 → Photon fallback');
      try {
        return res.json(await photonFetch(q, 6));
      } catch (pe) {
        console.error('[geocode] Photon fallback failed:', pe.message);
        return res.status(503).json({ error: 'geocode_busy' });
      }
    }
    if (!r.ok) throw new Error(`Nominatim HTTP ${r.status}`);
    res.json(await r.json());
  } catch (e) {
    console.error('[geocode]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// API: GET /api/shelters?lat=&lon=&radius=
// ─────────────────────────────────────────────
app.get('/api/shelters', async (req, res) => {
  const { lat, lon, radius = 2000 } = req.query;

  if (!lat || !lon) return res.status(400).json({ error: 'Missing lat and/or lon' });

  const userLat = parseFloat(lat);
  const userLon = parseFloat(lon);
  const radiusM = Math.min(Math.max(parseInt(radius, 10) || 2000, 100), 10000);

  if (isNaN(userLat) || isNaN(userLon))
    return res.status(400).json({ error: 'Invalid lat/lon values' });

  try {
    const [
      osmResult, govResult, geojsonResult, arcgisResult,
      telAvivResult, haifaResult, petahTikvaResult,
      herzliyaResult, ashkelonResult, holonResult, kfarSabaResult, rehovotResult,
      rishonResult, yehudResult,
    ] = await Promise.allSettled([
      fetchOverpass(userLat, userLon, radiusM),
      fetchDataGov(userLat, userLon, radiusM),
      fetchGeoJsonSources(userLat, userLon, radiusM),
      fetchArcGIS(userLat, userLon, radiusM),
      fetchTelAviv(userLat, userLon, radiusM),
      fetchHaifa(userLat, userLon, radiusM),
      fetchPetahTikva(userLat, userLon, radiusM),
      fetchHerzliya(userLat, userLon, radiusM),
      fetchAshkelon(userLat, userLon, radiusM),
      fetchHolon(userLat, userLon, radiusM),
      fetchKfarSaba(userLat, userLon, radiusM),
      fetchRehovot(userLat, userLon, radiusM),
      fetchRishonLeZion(userLat, userLon, radiusM),
      fetchYehud(userLat, userLon, radiusM),
    ]);

    let shelters = [];
    if (osmResult.status        === 'fulfilled') shelters.push(...osmResult.value);
    if (govResult.status        === 'fulfilled') shelters.push(...govResult.value);
    if (geojsonResult.status    === 'fulfilled') shelters.push(...geojsonResult.value);
    if (arcgisResult.status     === 'fulfilled') shelters.push(...arcgisResult.value);
    if (telAvivResult.status    === 'fulfilled') shelters.push(...telAvivResult.value);
    if (haifaResult.status      === 'fulfilled') shelters.push(...haifaResult.value);
    if (petahTikvaResult.status === 'fulfilled') shelters.push(...petahTikvaResult.value);
    if (herzliyaResult.status   === 'fulfilled') shelters.push(...herzliyaResult.value);
    if (ashkelonResult.status   === 'fulfilled') shelters.push(...ashkelonResult.value);
    if (holonResult.status      === 'fulfilled') shelters.push(...holonResult.value);
    if (kfarSabaResult.status   === 'fulfilled') shelters.push(...kfarSabaResult.value);
    if (rehovotResult.status    === 'fulfilled') shelters.push(...rehovotResult.value);
    if (rishonResult.status     === 'fulfilled') shelters.push(...rishonResult.value);
    if (yehudResult.status      === 'fulfilled') shelters.push(...yehudResult.value);

    shelters = deduplicateAll(shelters);
    shelters = shelters
      .map(s => ({ ...s, dist: haversine(userLat, userLon, s.lat, s.lon) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 150);

    // Count by category and source
    const catCounts = { public: 0, school: 0, parking: 0 };
    const srcCounts = { osm: 0, gov: 0, arcgis: 0 };
    for (const s of shelters) {
      catCounts[s.category] = (catCounts[s.category] || 0) + 1;
      srcCounts[s.source]   = (srcCounts[s.source]   || 0) + 1;
    }

    console.log(
      `[shelters] lat=${userLat} lon=${userLon} r=${radiusM}m → ` +
      `public:${catCounts.public} school:${catCounts.school} parking:${catCounts.parking}`
    );

    res.json({
      shelters,
      total: shelters.length,
      radius: radiusM,
      sources: {
        ...srcCounts,
        ...catCounts,
        osmError:        osmResult.status        === 'rejected' ? osmResult.reason?.message        : null,
        govError:        govResult.status        === 'rejected' ? govResult.reason?.message        : null,
        arcgisError:     arcgisResult.status     === 'rejected' ? arcgisResult.reason?.message     : null,
        telAvivError:    telAvivResult.status    === 'rejected' ? telAvivResult.reason?.message    : null,
        haifaError:      haifaResult.status      === 'rejected' ? haifaResult.reason?.message      : null,
        petahTikvaError: petahTikvaResult.status === 'rejected' ? petahTikvaResult.reason?.message : null,
        herzliyaError:   herzliyaResult.status   === 'rejected' ? herzliyaResult.reason?.message   : null,
        ashkelonError:   ashkelonResult.status   === 'rejected' ? ashkelonResult.reason?.message   : null,
        holonError:      holonResult.status      === 'rejected' ? holonResult.reason?.message      : null,
        kfarSabaError:   kfarSabaResult.status   === 'rejected' ? kfarSabaResult.reason?.message   : null,
        rehovotError:    rehovotResult.status    === 'rejected' ? rehovotResult.reason?.message    : null,
        rishonError:     rishonResult.status     === 'rejected' ? rishonResult.reason?.message     : null,
        yehudError:      yehudResult.status      === 'rejected' ? yehudResult.reason?.message      : null,
      },
    });
  } catch (e) {
    console.error('[shelters]', e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    dataSources: [
      'osm', 'data.gov.il', 'geojson', 'arcgis-national',
      'haifa-gis', 'tel-aviv-gis', 'petah-tikva-gis',
      'herzliya-gis', 'ashkelon-gis', 'holon-gis', 'kfar-saba-gis', 'rehovot-gis',
      'rishon-lezion-html',
    ],
    cities: [
      ...GOV_RESOURCES.map(r => r.city),
      ...GEOJSON_RESOURCES.map(r => r.city),
      'חיפה', 'תל אביב-יפו', 'פתח תקווה',
      'הרצליה', 'אשקלון', 'חולון', 'כפר סבא', 'רחובות', 'ראשון לציון', 'יהוד-מונוסון',
    ],
    cacheStatus: {
      ...Object.fromEntries(GOV_RESOURCES.map(r => [
        r.city,
        govCache[r.id] ? `${govCache[r.id].data.length} shelters` : 'not loaded',
      ])),
      ...Object.fromEntries(GEOJSON_RESOURCES.map(r => [
        r.city,
        geojsonCache[r.url] ? `${geojsonCache[r.url].data.length} shelters` : 'not loaded',
      ])),
    },
  });
});

// ─────────────────────────────────────────────
// Production: serve built React app for all non-API routes
// ─────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app', 'index.html'));
});

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏚️  Shelter Finder running on http://localhost:${PORT}\n`);
});
