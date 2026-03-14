'use strict';

const { GOV_RESOURCES, GEOJSON_RESOURCES } = require('./config');
const { loadGovResource } = require('./sources/govil');
const { loadGeoJsonResource } = require('./sources/geojson');
const { loadTelAviv } = require('./sources/telAviv');
const { loadRishonLeZion } = require('./sources/rishon');
const { loadYehud } = require('./sources/yehud');

// ─────────────────────────────────────────────
// Pre-warm caches on startup
// ─────────────────────────────────────────────
async function warmCaches() {
  // 1. Warm data.gov.il + GeoJSON caches immediately (no rate limit needed)
  for (const resource of GOV_RESOURCES) {
    try { await loadGovResource(resource); }
    catch (e) { console.warn('[gov] pre-warm failed for', resource.city, '-', e.message); }
  }
  for (const resource of GEOJSON_RESOURCES) {
    try { await loadGeoJsonResource(resource); }
    catch (e) { console.warn('[geojson] pre-warm failed for', resource.city, '-', e.message); }
  }

  // 2. Pre-warm Tel Aviv cache (fetches all 502 shelters once, cached for 1 hour)
  try { await loadTelAviv(); }
  catch (e) { console.warn('[tel-aviv] pre-warm failed -', e.message); }

  // 3. Load & geocode Rishon LeZion shelters (Nominatim NOM_LOW, ~44s \u2014 fire-and-forget)
  // Do NOT await: geocoding takes ~44s; user searches (NOM_HIGH) jump ahead in the queue.
  loadRishonLeZion().catch(e => console.warn('[rishon] startup load failed -', e.message));

  // 4. Pre-warm Yehud cache (ArcGIS embedded feature collection, fast)
  try { await loadYehud(); }
  catch (e) { console.warn('[yehud] pre-warm failed -', e.message); }

  // NOTE: Background geocoding of municipality HTML lists is disabled.
  // Geocoding 200+ addresses via Nominatim at startup reliably triggers rate-limiting (429),
  // which breaks user geocode searches. These cities need a proper GIS/ArcGIS endpoint
  // instead of Nominatim-geocoded HTML scraping.
}

module.exports = { warmCaches };
