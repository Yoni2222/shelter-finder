'use strict';

const fetch = require('node-fetch');
const { osmDefaultName } = require('../utils/hebrewUtils');

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
  node["amenity"="school"](around:${radiusM},${lat},${lon});
  way["amenity"="school"](around:${radiusM},${lat},${lon});
  node["amenity"="kindergarten"](around:${radiusM},${lat},${lon});
  way["amenity"="kindergarten"](around:${radiusM},${lat},${lon});
);
out center meta;`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
    timeout: 10000,
  });

  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = await res.json();

  return json.elements
    .map(el => {
      const sLat = el.type === 'way' ? el.center?.lat : el.lat;
      const sLon = el.type === 'way' ? el.center?.lon : el.lon;
      if (!sLat || !sLon) return null;

      const t = el.tags || {};

      // Skip bus stops / public transport platforms that have shelter=yes
      if (t.highway === 'bus_stop' || t.public_transport === 'platform' ||
          t.public_transport === 'stop_position') return null;
      let category, name, type;

      if (t.amenity === 'school' || t.amenity === 'kindergarten') {
        category = 'school';
        name = t.name || t['name:he'] || t['name:en'] ||
               (t.amenity === 'kindergarten' ? '\u05D2\u05DF \u05D9\u05DC\u05D3\u05D9\u05DD' : '\u05D1\u05D9\u05EA \u05E1\u05E4\u05E8');
        type = t.amenity === 'kindergarten' ? '\u05D2\u05DF \u05D9\u05DC\u05D3\u05D9\u05DD' : '\u05D1\u05D9\u05EA \u05E1\u05E4\u05E8';
      } else if (t.amenity === 'parking') {
        category = 'parking';
        name = t.name || t['name:he'] || t['name:en'] ||
               (t.parking === 'multi-storey' ? '\u05D7\u05E0\u05D9\u05D5\u05DF \u05E7\u05D5\u05DE\u05D5\u05EA' : '\u05D7\u05E0\u05D9\u05D5\u05DF \u05DE\u05E7\u05D5\u05E8\u05D4');
        type = t.parking === 'multi-storey' ? '\u05D7\u05E0\u05D9\u05D5\u05DF \u05E7\u05D5\u05DE\u05D5\u05EA' : '\u05D7\u05E0\u05D9\u05D5\u05DF \u05DE\u05E7\u05D5\u05E8\u05D4';
      } else {
        category = 'public';
        name = t.name || t['name:he'] || t['name:en'] || osmDefaultName(t);
        type = t['shelter_type'] || t['emergency'] || '\u05DE\u05E7\u05DC\u05D8';
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

module.exports = { fetchOverpass };
