'use strict';

const fetch = require('node-fetch');
const { ARCGIS_SHELTER_URL } = require('../config');
const haversine = require('../utils/haversine');

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
    outFields: '\u05DB\u05EA\u05D5\u05D1\u05EA,\u05E9\u05D9\u05DE\u05D5\u05E9,\u05D2\u05D5\u05D3\u05DC_\u05DE\u05E8',
    returnGeometry: 'true',
    f: 'geojson',
  });

  const res = await fetch(`${ARCGIS_SHELTER_URL}/query?${params}`, {
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 6000,
  });
  if (!res.ok) throw new Error(`ArcGIS HTTP ${res.status}`);
  const json = await res.json();

  return (json.features || [])
    .map((feat, i) => {
      const [fLon, fLat] = feat.geometry?.coordinates || [];
      if (!fLat || !fLon) return null;
      if (haversine(lat, lon, fLat, fLon) * 1000 > radiusM) return null;

      const props  = feat.properties || {};
      const addr   = props['\u05DB\u05EA\u05D5\u05D1\u05EA'] || '';
      const sizeSqm = props['\u05D2\u05D5\u05D3\u05DC_\u05DE\u05E8'];
      return {
        id: `arcgis_${feat.id ?? i}`,
        lat: fLat,
        lon: fLon,
        name: addr ? `\u05DE\u05E7\u05DC\u05D8 - ${addr}` : '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9',
        address: addr,
        city: '',
        capacity: sizeSqm ? `${sizeSqm} \u05DE"\u05E8` : '',
        type: '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9',
        source: 'arcgis',
        category: 'public',
      };
    })
    .filter(Boolean);
}

module.exports = { fetchArcGIS };
