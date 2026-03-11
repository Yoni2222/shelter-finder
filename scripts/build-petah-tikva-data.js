'use strict';
const fs = require('fs'), path = require('path');
const { fetchAllArcGIS } = require('./lib/arcgis-fetcher');

const URL = 'https://services9.arcgis.com/tfeLX7LFVABzD11G/arcgis/rest/services/%D7%9E%D7%A8%D7%97%D7%91%D7%99%D7%9D/FeatureServer/0/query';

async function main() {
  console.log('Fetching Petah Tikva shelters...');
  const features = await fetchAllArcGIS(URL, { outFields: 'Address,PlaceName,SUG,complex,OBJECTID' });
  console.log(`Got ${features.length} features`);
  const shelters = features.map((feat, i) => {
    const a = feat.attributes || {}, g = feat.geometry || {};
    const fLon = g.x, fLat = g.y;
    if (!fLat || !fLon) return null;
    const addr = a.Address || '', placeName = a.PlaceName || '';
    const isSchool = a.complex === 4;
    const typeLabel = a.SUG === 2 ? 'מקלט תת-קרקעי' : isSchool ? 'מרחב מוגן – מוסד' : 'מרחב מוגן ציבורי';
    const name = placeName ? `${placeName}${addr ? ' - ' + addr : ''}` : addr ? `מרחב מוגן - ${addr}` : `מרחב מוגן פ"ת #${i+1}`;
    return { id: `ptikva_${a.OBJECTID || i}`, lat: fLat, lon: fLon, name, address: addr, city: 'פתח תקווה', capacity: '', type: typeLabel, source: 'gov', category: isSchool ? 'school' : 'public' };
  }).filter(Boolean);
  const out = path.join(__dirname, '..', 'data', 'petah-tikva-shelters.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(shelters, null, 2), 'utf8');
  console.log(`Saved ${shelters.length} shelters to ${out}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
