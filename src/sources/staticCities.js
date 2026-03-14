'use strict';

const path = require('path');
const haversine = require('../utils/haversine');

// ─────────────────────────────────────────────
// Static JSON city definitions
// Each entry: { file, city } where file is the JSON filename in data/
// ─────────────────────────────────────────────
const STATIC_CITY_DEFS = [
  { file: 'haifa-shelters.json',       city: '\u05D7\u05D9\u05E4\u05D4' },
  { file: 'netanya-shelters.json',     city: '\u05E0\u05EA\u05E0\u05D9\u05D4' },
  { file: 'bat-yam-shelters.json',     city: '\u05D1\u05EA \u05D9\u05DD' },
  { file: 'ashdod-shelters.json',      city: '\u05D0\u05E9\u05D3\u05D5\u05D3' },
  { file: 'or-yehuda-shelters.json',   city: '\u05D0\u05D5\u05E8 \u05D9\u05D4\u05D5\u05D3\u05D4' },
  { file: 'kfar-yona-shelters.json',   city: '\u05DB\u05E4\u05E8 \u05D9\u05D5\u05E0\u05D4' },
  { file: 'kiryat-ono-shelters.json',  city: '\u05E7\u05E8\u05D9\u05EA \u05D0\u05D5\u05E0\u05D5' },
  { file: 'dimona-shelters.json',      city: '\u05D3\u05D9\u05DE\u05D5\u05E0\u05D4' },
  { file: 'givatayim-shelters.json',   city: '\u05D2\u05D1\u05E2\u05EA\u05D9\u05D9\u05DD' },
  { file: 'bnei-brak-shelters.json',   city: '\u05D1\u05E0\u05D9 \u05D1\u05E8\u05E7' },
  { file: 'nesher-shelters.json',      city: '\u05E0\u05E9\u05E8' },
  { file: 'ramat-gan-shelters.json',   city: '\u05E8\u05DE\u05EA \u05D2\u05DF' },
  { file: 'herzliya-shelters.json',    city: '\u05D4\u05E8\u05E6\u05DC\u05D9\u05D4' },
  { file: 'holon-shelters.json',       city: '\u05D7\u05D5\u05DC\u05D5\u05DF' },
  { file: 'kfar-saba-shelters.json',   city: '\u05DB\u05E4\u05E8 \u05E1\u05D1\u05D0' },
];

// Load all static JSON files and build caches
const dataDir = path.join(__dirname, '..', '..', 'data');
const staticCaches = {};
const allStaticShelters = [];

for (const def of STATIC_CITY_DEFS) {
  const data = require(path.join(dataDir, def.file));
  staticCaches[def.file] = data;
  allStaticShelters.push(...data);
}

console.log(`[startup] Master shelter index: ${allStaticShelters.length} shelters from static JSON`);

// Factory: create a fetch function for a static city
function makeStaticFetcher(jsonFile) {
  const data = staticCaches[jsonFile];
  return function fetchStatic(lat, lon, radiusM) {
    return Promise.resolve(
      data.filter(s => haversine(lat, lon, s.lat, s.lon) * 1000 <= radiusM)
    );
  };
}

// Build fetcher map: { 'haifa-shelters.json': fetchFn, ... }
const staticFetchers = {};
for (const def of STATIC_CITY_DEFS) {
  staticFetchers[def.file] = makeStaticFetcher(def.file);
}

module.exports = {
  STATIC_CITY_DEFS,
  staticCaches,
  allStaticShelters,
  staticFetchers,
  makeStaticFetcher,
};
