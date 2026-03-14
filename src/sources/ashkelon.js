'use strict';

const fetch = require('node-fetch');
const { ASHKELON_URL } = require('../config');
const haversine = require('../utils/haversine');

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
    outFields:      '*',
    returnGeometry: 'true',
    f:              'json',
  });

  const res = await fetch(`${ASHKELON_URL}?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 6000,
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

      const addr     = a['\u05DB\u05EA\u05D5\u05D1\u05EA'] || '';
      const nameHeb  = a.NAME_HEB || '';
      const hood     = a['\u05E9\u05DB\u05D5\u05E0\u05D4'] || '';
      const sizeSqm  = a['\u05D2\u05D5\u05D3\u05DC_'];
      const name     = nameHeb || (addr ? `\u05DE\u05E7\u05DC\u05D8 - ${addr}` : `\u05DE\u05E7\u05DC\u05D8 \u05D0\u05E9\u05E7\u05DC\u05D5\u05DF #${i + 1}`);

      return {
        id:       `ashkelon_${a.OBJECTID || i}`,
        lat:      fLat,
        lon:      fLon,
        name,
        address:  addr,
        city:     '\u05D0\u05E9\u05E7\u05DC\u05D5\u05DF',
        capacity: sizeSqm ? `${sizeSqm} \u05DE"\u05E8` : '',
        type:     '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9',
        source:   'gov',
        category: 'public',
      };
    })
    .filter(Boolean);
}

module.exports = { fetchAshkelon };
