'use strict';
/**
 * Build Jerusalem shelters data.
 * Source: Jerusalem datacity GeoJSON
 * https://jerusalem.datacity.org.il/dataset/3e97d0fc-4268-4aea-844d-12588f55d809/resource/b9bd9575-d431-4f9d-af4b-1413d3c13590/download/data.geojson
 *
 * Run: node scripts/build-jerusalem-data.js
 */

const fetch = require('node-fetch');
const fs = require('fs'), path = require('path');

const URL = 'https://jerusalem.datacity.org.il/dataset/3e97d0fc-4268-4aea-844d-12588f55d809/resource/b9bd9575-d431-4f9d-af4b-1413d3c13590/download/data.geojson';
const NAME_FIELD = 'מספר מקלט';

async function main() {
  console.log('Fetching Jerusalem shelters from datacity GeoJSON...');
  const res = await fetch(URL, {
    redirect: 'follow',
    headers: { 'User-Agent': 'ShelterFinderApp/1.0' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  const features = json.features || [];
  console.log(`Got ${features.length} features`);

  // Inspect first feature to understand structure
  if (features.length > 0) {
    console.log('Sample feature properties:', JSON.stringify(features[0].properties, null, 2));
    console.log('Sample geometry:', JSON.stringify(features[0].geometry, null, 2));
  }

  const shelters = features.map((feat, i) => {
    const geom = feat.geometry || {};
    let lon, lat;

    if (geom.type === 'Point') {
      lon = geom.coordinates[0];
      lat = geom.coordinates[1];
    } else if (geom.type === 'Polygon') {
      // Use centroid of first ring
      const coords = geom.coordinates[0] || [];
      lon = coords.reduce((s, c) => s + c[0], 0) / (coords.length || 1);
      lat = coords.reduce((s, c) => s + c[1], 0) / (coords.length || 1);
    } else {
      return null;
    }

    if (!lat || !lon || isNaN(lat) || isNaN(lon)) return null;

    // Israel bounding box check
    if (lat < 29 || lat > 34 || lon < 34 || lon > 36) return null;

    const props = feat.properties || {};
    const rawName = props[NAME_FIELD];
    const name = rawName ? `מקלט ${rawName}` : `מקלט ירושלים #${i + 1}`;

    return {
      id: `geojson_jerusalem_${props.OBJECTID || props['מספר מקלט'] || i}`,
      lat,
      lon,
      name,
      address: props['כתובת'] || props.address || props.ADDRESS || '',
      city: 'ירושלים',
      capacity: props['קיבולת'] || props.capacity || '',
      type: 'מקלט ציבורי',
      source: 'gov',
      category: 'public',
    };
  }).filter(Boolean);

  const out = path.join(__dirname, '..', 'data', 'jerusalem-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${shelters.length} shelters to ${out}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
