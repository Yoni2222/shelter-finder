'use strict';

const fetch = require('node-fetch');
const { REHOVOT_URL } = require('../config');
const haversine = require('../utils/haversine');

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
    timeout: 6000,
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
      const isSchool = sug.includes('\u05D1\u05D9\u05EA \u05E1\u05E4\u05E8') || sug.includes('\u05E1\u05E4\u05E8');
      const name   = a.NAME || (addr ? `\u05DE\u05E7\u05DC\u05D8 - ${addr}` : `\u05DE\u05E7\u05DC\u05D8 \u05E8\u05D7\u05D5\u05D1\u05D5\u05EA #${i + 1}`);

      return {
        id:       `rehovot_${a.OBJECTID || a.MIKLAT_ID || i}`,
        lat:      fLat,
        lon:      fLon,
        name,
        address:  addr,
        city:     '\u05E8\u05D7\u05D5\u05D1\u05D5\u05EA',
        capacity: a.area ? `${a.area} \u05DE"\u05E8` : '',
        type:     isSchool ? '\u05DE\u05E7\u05DC\u05D8 \u05D1\u05D9\u05EA \u05E1\u05E4\u05E8\u05D9' : '\u05DE\u05E7\u05DC\u05D8 \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9',
        source:   'gov',
        category: isSchool ? 'school' : 'public',
      };
    })
    .filter(Boolean);
}

module.exports = { fetchRehovot };
