'use strict';

const { fetchOverpass } = require('./overpass');
const { fetchDataGov } = require('./govil');
const { fetchGeoJsonSources } = require('./geojson');
const { fetchArcGIS } = require('./arcgis');
const { fetchTelAviv } = require('./telAviv');
const { fetchPetahTikva } = require('./petahTikva');
const { fetchAshkelon } = require('./ashkelon');
const { fetchRehovot } = require('./rehovot');
const { fetchRishonLeZion } = require('./rishon');
const { fetchYehud } = require('./yehud');
const { STATIC_CITY_DEFS, staticFetchers } = require('./staticCities');

// ─────────────────────────────────────────────
// Data-driven source registry
// Each entry: { name, fetch: (lat, lon, radiusM) => Promise<shelters[]> }
// ─────────────────────────────────────────────
const SOURCE_REGISTRY = [
  // Live API sources
  { name: 'osm',         fetch: fetchOverpass },
  { name: 'gov',         fetch: fetchDataGov },
  { name: 'geojson',     fetch: fetchGeoJsonSources },
  { name: 'arcgis',      fetch: fetchArcGIS },
  { name: 'telAviv',     fetch: fetchTelAviv },
  { name: 'petahTikva',  fetch: fetchPetahTikva },
  { name: 'ashkelon',    fetch: fetchAshkelon },
  { name: 'rehovot',     fetch: fetchRehovot },
  { name: 'rishon',      fetch: fetchRishonLeZion },
  { name: 'yehud',       fetch: fetchYehud },

  // Static JSON cities (generated from factory)
  ...STATIC_CITY_DEFS.map(def => ({
    name: def.file.replace('-shelters.json', ''),
    fetch: staticFetchers[def.file],
  })),
];

// ─────────────────────────────────────────────
// fetchAllSources: runs all sources in parallel, collects results + errors
// Returns { shelters: [], errors: { sourceName: errorMessage } }
// ─────────────────────────────────────────────
async function fetchAllSources(lat, lon, radiusM) {
  const promises = SOURCE_REGISTRY.map(src =>
    src.fetch(lat, lon, radiusM)
      .then(shelters => ({ name: src.name, status: 'ok', shelters }))
      .catch(err => ({ name: src.name, status: 'error', error: err.message }))
  );

  const results = await Promise.all(promises);

  let shelters = [];
  const errors = {};

  for (const r of results) {
    if (r.status === 'ok') {
      shelters.push(...r.shelters);
    } else {
      errors[r.name + 'Error'] = r.error;
    }
  }

  return { shelters, errors };
}

module.exports = { SOURCE_REGISTRY, fetchAllSources };
