'use strict';

const fetch = require('node-fetch');
const { PETAH_TIKVA_URL } = require('../config');
const haversine = require('../utils/haversine');

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
    timeout: 6000,
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
      const isSchool  = a.complex === 4;
      const typeLabel = a.SUG === 2 ? '\u05DE\u05E7\u05DC\u05D8 \u05EA\u05EA-\u05E7\u05E8\u05E7\u05E2\u05D9'
                      : isSchool    ? '\u05DE\u05E8\u05D7\u05D1 \u05DE\u05D5\u05D2\u05DF \u2013 \u05DE\u05D5\u05E1\u05D3'
                      :              '\u05DE\u05E8\u05D7\u05D1 \u05DE\u05D5\u05D2\u05DF \u05E6\u05D9\u05D1\u05D5\u05E8\u05D9';

      const name = placeName
        ? `${placeName}${addr ? ' - ' + addr : ''}`
        : addr
          ? `\u05DE\u05E8\u05D7\u05D1 \u05DE\u05D5\u05D2\u05DF - ${addr}`
          : `\u05DE\u05E8\u05D7\u05D1 \u05DE\u05D5\u05D2\u05DF \u05E4"\u05EA #${i + 1}`;

      return {
        id:       `ptikva_${a.OBJECTID || i}`,
        lat:      fLat,
        lon:      fLon,
        name,
        address:  addr,
        city:     '\u05E4\u05EA\u05D7 \u05EA\u05E7\u05D5\u05D5\u05D4',
        capacity: '',
        type:     typeLabel,
        source:   'gov',
        category: isSchool ? 'school' : 'public',
      };
    })
    .filter(Boolean);
}

module.exports = { fetchPetahTikva };
