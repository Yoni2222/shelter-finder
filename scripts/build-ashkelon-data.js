'use strict';
const fs = require('fs'), path = require('path');
const { fetchAllArcGIS } = require('./lib/arcgis-fetcher');

const URL = 'https://services2.arcgis.com/5gNmRQS5QY72VLq4/ArcGIS/rest/services/PUBLIC_SHELTER/FeatureServer/0/query';

async function main() {
  console.log('Fetching Ashkelon shelters...');
  const features = await fetchAllArcGIS(URL, { outFields: '*' });
  console.log(`Got ${features.length} features`);
  const shelters = features.map((feat, i) => {
    const a = feat.attributes || {}, g = feat.geometry || {};
    const fLon = g.x, fLat = g.y;
    if (!fLat || !fLon) return null;
    const addr = a['כתובת'] || '', nameHeb = a.NAME_HEB || '', sizeSqm = a['גודל_'];
    const name = nameHeb || (addr ? `מקלט - ${addr}` : `מקלט אשקלון #${i+1}`);
    return { id: `ashkelon_${a.OBJECTID || i}`, lat: fLat, lon: fLon, name, address: addr, city: 'אשקלון', capacity: sizeSqm ? `${sizeSqm} מ"ר` : '', type: 'מקלט ציבורי', source: 'gov', category: 'public' };
  }).filter(Boolean);
  const out = path.join(__dirname, '..', 'data', 'ashkelon-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${shelters.length} shelters to ${out}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
