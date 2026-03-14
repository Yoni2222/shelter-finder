'use strict';

// ─────────────────────────────────────────────
// Shared mutable cache state (CommonJS singleton)
// ─────────────────────────────────────────────

const govCache     = {};
const geojsonCache = {};
const municipalityListCache = {};
const geocodeCache = {};

// Tel Aviv: load all shelters once and cache
let _telAvivCache   = null;
let _telAvivCacheTs = 0;

// Rishon LeZion: HTML table page, geocoded with Nominatim at startup
let _rishonCache   = null;
let _rishonCacheTs = 0;

// Yehud: ArcGIS embedded feature collection
let _yehudCache   = null;
let _yehudCacheTs = 0;

module.exports = {
  govCache,
  geojsonCache,
  municipalityListCache,
  geocodeCache,

  // Tel Aviv
  get telAvivCache()   { return _telAvivCache; },
  set telAvivCache(v)  { _telAvivCache = v; },
  get telAvivCacheTs() { return _telAvivCacheTs; },
  set telAvivCacheTs(v){ _telAvivCacheTs = v; },

  // Rishon LeZion
  get rishonCache()    { return _rishonCache; },
  set rishonCache(v)   { _rishonCache = v; },
  get rishonCacheTs()  { return _rishonCacheTs; },
  set rishonCacheTs(v) { _rishonCacheTs = v; },

  // Yehud
  get yehudCache()     { return _yehudCache; },
  set yehudCache(v)    { _yehudCache = v; },
  get yehudCacheTs()   { return _yehudCacheTs; },
  set yehudCacheTs(v)  { _yehudCacheTs = v; },
};
