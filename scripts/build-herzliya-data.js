'use strict';
const fs = require('fs'), path = require('path');
const { fetchAllArcGIS } = require('./lib/arcgis-fetcher');

const URL = 'https://services3.arcgis.com/9qGhZGtb39XMVQyR/arcgis/rest/services/%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D_2025/FeatureServer/0/query';

async function main() {
  console.log('Fetching Herzliya shelters...');
  const features = await fetchAllArcGIS(URL, { outFields: 'OBJECTID,כתובת,type,number_mik,negishot' });
  console.log(`Got ${features.length} features`);
  const shelters = features.map((feat, i) => {
    const a = feat.attributes || {}, g = feat.geometry || {};
    const fLon = g.x, fLat = g.y;
    if (!fLat || !fLon) return null;
    const addr = a['כתובת'] || '', shelterType = a.type || '';
    const isSchool = shelterType.toLowerCase().includes('school');
    let typeHe = 'מקלט ציבורי';
    if (shelterType === 'School shelter') typeHe = 'מקלט בית ספרי';
    else if (shelterType === 'Protective room') typeHe = 'מרחב מוגן';
    else if (shelterType === 'Accessible shelter') typeHe = 'מקלט נגיש';
    return { id: `herzliya_${a.OBJECTID || i}`, lat: fLat, lon: fLon, name: addr ? `מקלט - ${addr}` : `מקלט הרצליה #${i+1}`, address: addr, city: 'הרצליה', capacity: '', type: typeHe, source: 'gov', category: isSchool ? 'school' : 'public' };
  }).filter(Boolean);
  const out = path.join(__dirname, '..', 'data', 'herzliya-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${shelters.length} shelters to ${out}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
