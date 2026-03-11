'use strict';
const fetch = require('node-fetch');
const fs = require('fs'), path = require('path');

const URL = 'https://www.arcgis.com/sharing/rest/content/items/5ea507fd44a049dd9c9b4babf2ab0e3f/data?f=json';

async function main() {
  console.log('Fetching Yehud shelters...');
  const res = await fetch(URL, { headers: { 'User-Agent': 'ShelterFinderApp/1.0' }, timeout: 15000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const layer = (json.operationalLayers || [])[0];
  // Structure: featureCollection.layers[0].featureSet.features
  const fcLayer = layer?.featureCollection?.layers?.[0];
  const features = fcLayer?.featureSet?.features || layer?.featureCollection?.featureSet?.features || [];
  console.log(`Got ${features.length} features`);
  const shelters = features.map((feat, i) => {
    const a = feat.attributes || {};
    const fLat = parseFloat(a.latitude ?? a.Latitude ?? '');
    const fLon = parseFloat(a.longitude ?? a.Longitude ?? '');
    if (!fLat || !fLon || isNaN(fLat) || isNaN(fLon)) return null;
    const addr = a.ld || a.Address || '', title = a.appld || a.title || '', type = a.type || 'מקלט ציבורי';
    return { id: `yehud_${a.__OBJECTID || i}`, lat: fLat, lon: fLon, name: title || (addr ? `מקלט – ${addr}` : `מקלט יהוד #${i+1}`), address: addr, city: 'יהוד-מונוסון', capacity: '', type, source: 'gov', category: 'public' };
  }).filter(Boolean);
  const out = path.join(__dirname, '..', 'data', 'yehud-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${shelters.length} shelters to ${out}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
