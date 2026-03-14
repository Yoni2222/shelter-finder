'use strict';

const fetch = require('node-fetch');
const { MUNICIPALITY_LIST_SOURCES, GOV_CACHE_TTL } = require('../config');
const cache = require('../cache');
const haversine = require('../utils/haversine');
const { geocodeAddress } = require('../services/geocoding');

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
        if (first.includes('\u05E9\u05DB\u05D5\u05E0\u05D4') || first.includes('\u05E8\u05D7\u05D5\u05D1') || first.includes('\u05DE\u05D1\u05E0\u05D4')) {
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
        displayName: placeName ? (buildingType ? `${placeName} (${buildingType})` : placeName) : (street ? `\u05DE\u05E7\u05DC\u05D8 - ${street}` : `\u05DE\u05E7\u05DC\u05D8 ${cityName}`),
      });
    }
  }
  return rows;
}

async function preGeocodeAllMunicipalities() {
  for (const source of MUNICIPALITY_LIST_SOURCES) {
    try {
      if (!cache.municipalityListCache[source.id]) {
        const res = await fetch(source.url, {
          headers: { 'User-Agent': 'ShelterFinderApp/1.0', 'Accept': 'text/html' },
          timeout: 6000,
        });
        if (!res.ok) {
          console.warn(`[municipality] ${source.city}: HTTP ${res.status} \u2014 skipping`);
          continue;
        }
        const html = await res.text();
        const rows = parseMunicipalityTable(html, source.city);
        cache.municipalityListCache[source.id] = rows;
        cache.municipalityListCache[source.id + '_ts'] = Date.now();
        console.log(`[municipality] Parsed ${rows.length} rows from ${source.city}`);
      }

      const rows = cache.municipalityListCache[source.id] || [];
      let geocoded = 0;
      for (const row of rows) {
        if (cache.geocodeCache[row.fullAddress]) continue;
        const result = await geocodeAddress(row.fullAddress);
        if (result) geocoded++;
      }
      console.log(`[municipality] Pre-geocoded ${geocoded} new addresses for ${source.city}`);
    } catch (e) {
      console.warn(`[municipality] Pre-geocode failed for ${source.city}:`, e.message);
    }
  }
}

async function fetchMunicipalityListSource(source, userLat, userLon, radiusM) {
  if (haversine(userLat, userLon, source.centerLat, source.centerLon) > source.maxRadiusKm) {
    return [];
  }

  const rows = cache.municipalityListCache[source.id] || [];
  const shelters = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cached = cache.geocodeCache[row.fullAddress];
    if (!cached) continue;
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
      type: row.shelterType || '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9',
      source: 'gov',
      category: row.buildingType && (row.buildingType.includes('\u05D1\u05D9\u05EA \u05E1\u05E4\u05E8') || row.buildingType.includes('\u05D2\u05DF')) ? 'school' : 'public',
      openClosed: row.openClosed,
    });
  }
  return shelters;
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

module.exports = {
  parseMunicipalityTable,
  preGeocodeAllMunicipalities,
  fetchMunicipalityListSource,
  fetchMunicipalityLists,
  getMunicipalityListUrlForArea,
};
